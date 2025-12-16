// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let llos_text = "";
    let learner_level = "";
    let bloom_level = "";
    let specialty_name = "";
    let course_title = "";
    let lesson_title = "";
    let au_count_raw = "12"; // default

    // 1) Lấy dữ liệu từ FormData (frontend đang dùng FormData) hoặc JSON
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      llos_text = (formData.get("llos_text") || "").toString();
      learner_level = (formData.get("learner_level") || "").toString();
      bloom_level = (formData.get("bloom_level") || "").toString();
      specialty_name = (formData.get("specialty_name") || "").toString();
      course_title = (formData.get("course_title") || "").toString();
      lesson_title = (formData.get("lesson_title") || "").toString();
      au_count_raw = (formData.get("au_count") || "12").toString();

      // Lưu ý: hiện tại **chưa** parse nội dung file phía backend
    } else {
      const body = (await req.json().catch(() => ({}))) as any;
      llos_text = (body.llos_text || "").toString();
      learner_level = (body.learner_level || "").toString();
      bloom_level = (body.bloom_level || "").toString();
      specialty_name = (body.specialty_name || "").toString();
      course_title = (body.course_title || "").toString();
      lesson_title = (body.lesson_title || "").toString();
      au_count_raw = (body.au_count ?? "12").toString();
    }

    if (!llos_text.trim()) {
      return NextResponse.json({ error: "Thiếu LLOs để tạo AU" }, { status: 400 });
    }

    // 2) Parse & giới hạn số lượng AU
    const auCount = clampInt(parseInt(au_count_raw, 10), 1, 30); // bạn có thể đổi max 50 nếu muốn

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY không tồn tại trong môi trường server");
      return NextResponse.json({ error: "Thiếu OPENAI_API_KEY trên server" }, { status: 500 });
    }

    const model = (process.env.OPENAI_LLO_MODEL || "gpt-5.1").trim();

    // ✅ Prompt đã được làm “NHẤT QUÁN SCHEMA”
    // - Không yêu cầu thêm field ngoài 3 field bạn đang dùng ở UI
    // - Ép sinh đúng N AU
    // - Ép không trôi chuyên ngành
    const prompt = `
Bạn là chuyên gia thiết kế đánh giá trong giáo dục y khoa.

MỤC TIÊU
Tạo đúng ${auCount} Assessment Units (AU) — “đơn vị kiến thức nhỏ nhất có thể kiểm tra được” — dựa CHẶT vào LLOs bên dưới.

INPUT (LLOs)
${llos_text}

NGỮ CẢNH
- Chuyên ngành (specialty): ${specialty_name || "không rõ"}
- Học phần: ${course_title || "không rõ"}
- Bài học: ${lesson_title || "không rõ"}
- Bậc học (learner_level): ${learner_level || "không rõ"}
- Bloom mục tiêu (bloom_level): ${bloom_level || "không rõ"}

ĐỊNH NGHĨA AU (BẮT BUỘC)
- Một AU = 1 mệnh đề/fact/khẳng định độc lập (không gộp 2–3 ý).
- Phải có “đáp án đúng” rõ ràng nếu dùng MCQ.
- Ngắn, rõ, không mơ hồ, không nêu chung chung.
- Mỗi AU phải bám trực tiếp vào LLO (không phát minh chủ đề mới).
- Tránh AU kiểu: “hiểu vai trò…”, “biết tầm quan trọng…”. Hãy chuyển thành mệnh đề kiểm tra được.

QUY TẮC THEO CHUYÊN NGÀNH (CHỐNG TRÔI)
1) 100% AU phải thuộc phạm vi hợp lệ của chuyên ngành "${specialty_name || "không rõ"}".
2) Nếu LLO có nội dung liên chuyên ngành: CHỈ lấy phần liên quan trực tiếp đến specialty.
3) CẤM “trôi chuyên ngành”: không tự sinh kiến thức của chuyên ngành khác khi LLO không yêu cầu.
4) Nếu specialty là Y học cổ truyền (YHCT/TCM/Traditional Medicine/Kampo):
   - Ưu tiên: tứ chẩn, bát cương, tạng phủ, khí-huyết-tân dịch, kinh lạc/huyệt, biện chứng luận trị, pháp trị, phương dược, châm cứu/xoa bóp/dưỡng sinh.
   - Chỉ dùng kiến thức Tây y khi LLO yêu cầu “đối chiếu/so sánh”.
5) Nếu specialty không rõ/quá chung chung:
   - Bám sát câu chữ LLO và tạo AU theo kiến thức nền tảng đúng learner_level. Không tự mở rộng phạm vi.

YÊU CẦU VỀ SỐ LƯỢNG
- Sinh ĐÚNG ${auCount} AU. Không ít hơn, không nhiều hơn.
- Nếu LLO quá ít: vẫn cố tạo đủ ${auCount} AU bằng cách chia nhỏ thành các mệnh đề kiểm tra được, nhưng KHÔNG thêm chủ đề mới ngoài LLO.

OUTPUT (CHỈ JSON, KHÔNG THÊM CHỮ)
Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC sau (không thêm trường khác):

{
  "aus": [
    {
      "core_statement": "string",
      "short_explanation": "string|null",
      "bloom_min": "remember|understand|apply|analyze|evaluate|create"
    }
  ]
}
`.trim();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Bạn là trợ lý giáo dục y khoa. CHỈ trả lời bằng JSON đúng schema yêu cầu, không thêm chữ.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok) {
      console.error("OpenAI error tại /api/au-gen:", data);
      return NextResponse.json(
        { error: "Lỗi khi gọi GPT", detail: JSON.stringify(data, null, 2) },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ (AU-gen):", data);
      return NextResponse.json({ error: "Không nhận được content hợp lệ từ GPT" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error ở /api/au-gen:", e, "raw:", content);
      return NextResponse.json({ error: "GPT trả về JSON không hợp lệ", raw: content }, { status: 500 });
    }

    if (!parsed?.aus || !Array.isArray(parsed.aus)) {
      console.error("JSON không có trường 'aus' đúng định dạng:", parsed);
      return NextResponse.json(
        { error: "JSON không có trường 'aus' đúng định dạng", raw: parsed },
        { status: 500 }
      );
    }

    // Chuẩn hóa + ép số lượng đúng auCount
    const aus = parsed.aus
      .map((x: any) => ({
        core_statement: (x.core_statement ?? x.text ?? "").toString(),
        short_explanation: x.short_explanation ?? null,
        bloom_min: x.bloom_min ?? null,
      }))
      .filter((x: any) => x.core_statement && x.core_statement.trim().length > 0)
      .slice(0, auCount);

    // Nếu GPT vẫn trả thiếu, báo rõ (để bạn debug nhanh)
    if (aus.length < auCount) {
      return NextResponse.json(
        {
          error: `GPT trả về ${aus.length}/${auCount} AU (thiếu).`,
          raw: parsed,
          aus,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ aus }, { status: 200 });
  } catch (err: any) {
    console.error("Lỗi server /api/au-gen:", err);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
