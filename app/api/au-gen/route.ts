// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let llos_text = "";
    let learner_level = "";
    let bloom_level = "";
    let specialty_name = "";
    let course_title = "";
    let lesson_title = "";

    // 1) Lấy dữ liệu từ FormData (frontend đang dùng FormData) hoặc JSON
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      llos_text = (formData.get("llos_text") || "").toString();
      learner_level = (formData.get("learner_level") || "").toString();
      bloom_level = (formData.get("bloom_level") || "").toString();
      specialty_name = (formData.get("specialty_name") || "").toString();
      course_title = (formData.get("course_title") || "").toString();
      lesson_title = (formData.get("lesson_title") || "").toString();

      // Lưu ý: hiện tại **chưa** parse nội dung file phía backend
      // Files được dùng qua /api/file-extract ở bước khác nếu cần.
    } else {
      const body = (await req.json().catch(() => ({}))) as any;
      llos_text = (body.llos_text || "").toString();
      learner_level = (body.learner_level || "").toString();
      bloom_level = (body.bloom_level || "").toString();
      specialty_name = (body.specialty_name || "").toString();
      course_title = (body.course_title || "").toString();
      lesson_title = (body.lesson_title || "").toString();
      // Có thể thêm body.doc_text nếu sau này bạn truyền text tài liệu vào.
    }

    if (!llos_text.trim()) {
      return NextResponse.json(
        { error: "Thiếu LLOs để tạo AU" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY không tồn tại trong môi trường server");
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trên server" },
        { status: 500 }
      );
    }

    const model = (process.env.OPENAI_LLO_MODEL || "gpt-5.1").trim();

    const prompt = `
Bạn là chuyên gia giáo dục Y khoa.

Nhiệm vụ: Tạo danh sách Assessment Units (AU) – đơn vị kiến thức nhỏ nhất có thể kiểm tra – từ danh sách LLO sau:

LLOs:
${llos_text}

Ngữ cảnh:
- Chuyên ngành: ${specialty_name || "không rõ"}
- Học phần: ${course_title || "không rõ"}
- Bài học: ${lesson_title || "không rõ"}
- Bậc học (learner_level): ${learner_level || "không rõ"}
- Mức Bloom mục tiêu: ${bloom_level || "không rõ"}

Yêu cầu:
- Mỗi AU phải ngắn, rõ, cụ thể, không mơ hồ.
- Mỗi AU là một fact/statement độc lập, không ghép 2–3 ý trong một AU.
- AU phải phù hợp với bậc học ${learner_level || "(nếu có)"}
- AU phải có dạng có thể kiểm tra bằng MCQ.

Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC sau, không thêm trường khác:

{
  "aus": [
    {
      "core_statement": "string",
      "short_explanation": "string (có thể null hoặc bỏ)",
      "bloom_min": "remember|understand|apply|analyze|evaluate|create"
    }
  ]
}
`.trim();

    // 🚀 Gọi CHAT COMPLETIONS API – JSON mode, giống hệt /api/llo-eval
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý giáo dục y khoa, CHỈ trả lời bằng JSON đúng schema yêu cầu."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok) {
      console.error("OpenAI error tại /api/au-gen:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT",
          detail: JSON.stringify(data, null, 2)
        },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ (AU-gen):", data);
      return NextResponse.json(
        { error: "Không nhận được content hợp lệ từ GPT" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error ở /api/au-gen:", e, "raw:", content);
      return NextResponse.json(
        {
          error: "GPT trả về JSON không hợp lệ",
          raw: content
        },
        { status: 500 }
      );
    }

    if (!parsed.aus || !Array.isArray(parsed.aus)) {
      console.error("JSON không có trường 'aus' đúng định dạng:", parsed);
      return NextResponse.json(
        { error: "JSON không có trường 'aus' đúng định dạng", raw: parsed },
        { status: 500 }
      );
    }

    // Chuẩn hóa kết quả trả về cho frontend
    const aus = parsed.aus.map((x: any) => ({
      core_statement: x.core_statement ?? x.text ?? "",
      short_explanation: x.short_explanation ?? null,
      bloom_min: x.bloom_min ?? null
    }));

    return NextResponse.json({ aus }, { status: 200 });
  } catch (err: any) {
    console.error("Lỗi server /api/au-gen:", err);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
