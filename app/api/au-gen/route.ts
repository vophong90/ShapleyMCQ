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
Bạn là chuyên gia thiết kế đánh giá trong giáo dục y khoa.

Mục tiêu: Tạo danh sách Assessment Units (AU) — “đơn vị kiến thức nhỏ nhất có thể kiểm tra được” — từ danh sách LLOs.

INPUT
LLOs:
${llos_text}

NGỮ CẢNH
- Chuyên ngành (specialty): ${specialty_name || "không rõ"}
- Học phần: ${course_title || "không rõ"}
- Bài học: ${lesson_title || "không rõ"}
- Bậc học (learner_level): ${learner_level || "không rõ"}
- Bloom mục tiêu (bloom_level): ${bloom_level || "không rõ"}

ĐỊNH NGHĨA AU
- Một AU = 1 mệnh đề/fact/khẳng định độc lập (không gộp 2–3 ý).
- Có thể kiểm tra bằng MCQ (có “đáp án đúng” rõ).
- Ngắn, rõ, không mơ hồ, không nêu chung chung.
- Phù hợp trình độ learner_level.

QUY TẮC BẮT BUỘC THEO CHUYÊN NGÀNH
1) 100% AU phải thuộc phạm vi hợp lệ của chuyên ngành "${specialty_name || "không rõ"}".
   - Nếu LLO có nội dung liên chuyên ngành: chỉ lấy phần liên quan trực tiếp đến specialty.
2) CẤM “trôi chuyên ngành”:
   - Không được sinh kiến thức của chuyên ngành khác khi LLO không yêu cầu.
   - Ví dụ: specialty là YHCT thì không sinh guideline tân dược; specialty là Dược thì không sinh kỹ thuật phẫu thuật; specialty là Răng-Hàm-Mặt thì không sinh sản khoa…
3) Nếu specialty là Y học cổ truyền (YHCT/TCM/Traditional Medicine/Kampo):
   - Ưu tiên: tứ chẩn, bát cương, tạng phủ, khí-huyết-tân dịch, kinh lạc/huyệt, biện chứng luận trị, pháp trị, phương dược, châm cứu/xoa bóp/dưỡng sinh.
   - Chỉ dùng kiến thức Tây y khi LLO yêu cầu “đối chiếu/so sánh”.
4) Nếu specialty không rõ / quá chung chung:
   - Tạo AU theo “kiến thức y khoa nền tảng” đúng learner_level và bám sát câu chữ LLO; không tự bịa thêm phạm vi mới.

KIỂM SOÁT CHẤT LƯỢNG
- Mỗi AU phải bám trực tiếp vào ít nhất 1 LLO (không phát minh chủ đề mới).
- Tránh AU kiểu “hiểu vai trò…”, “biết tầm quan trọng…”. Hãy chuyển thành mệnh đề kiểm tra được.
- bloom_min: mức Bloom tối thiểu để trả lời đúng MCQ cho AU đó.
- Thêm trường "specialty_tag" để tự xác nhận AU thuộc specialty (string ngắn).
- Thêm trường "evidence_anchor": trích 3–12 từ khóa ngắn lấy từ LLO liên quan nhất (để chứng minh không lạc đề).

YÊU CẦU OUTPUT (CHỈ JSON, không thêm chữ ngoài)
Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC sau, không thêm trường khác:

{
  "aus": [
    {
      "core_statement": "string",
      "short_explanation": "string|null",
      "bloom_min": "remember|understand|apply|analyze|evaluate|create",
      "specialty_tag": "string",
      "evidence_anchor": ["string","string","string"]
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
