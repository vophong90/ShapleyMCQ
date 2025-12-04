// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type AuGenRequest = {
  specialty_name?: string;
  learner_level?: string;
  bloom_level?: string;
  llos_text?: string;
  support_text?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AuGenRequest | null;

    if (!body) {
      return NextResponse.json(
        { error: "Body request trống" },
        { status: 400 }
      );
    }

    const {
      specialty_name,
      learner_level,
      bloom_level,
      llos_text,
      support_text,
    } = body;

    if (!llos_text || !llos_text.trim()) {
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

Nhiệm vụ: Tạo danh sách Assessment Units (AU) – đơn vị kiến thức nhỏ nhất có thể kiểm tra, từ danh sách LLO sau:

LLO:
${llos_text}

Văn bản hỗ trợ (từ tài liệu bài học, file user upload):
${support_text && support_text.trim().length > 0 ? support_text : "Không có văn bản hỗ trợ."}

Thông tin bối cảnh:
- Chuyên ngành: ${specialty_name || "không rõ"}
- Bậc học: ${learner_level || "không rõ"}  (undergrad | postgrad | phd)
- Mức Bloom mục tiêu: ${bloom_level || "không rõ"}

Yêu cầu:
- AU phải ngắn, rõ, cụ thể, không mơ hồ.
- Mỗi AU chỉ chứa một ý duy nhất, có thể kiểm tra độc lập.
- Viết AU dưới dạng mệnh đề có thể kiểm tra được (dùng để sinh MCQ).
- Nội dung AU phải phù hợp với bậc học và mức Bloom mục tiêu.

Trả lại JSON với cấu trúc CHÍNH XÁC:

{
  "aus": [
    { "text": "AU 1 ..." },
    { "text": "AU 2 ..." }
  ]
}

Không được thêm trường nào khác ngoài "aus" và "text".
`.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        // Bảo GPT xuất đúng JSON object
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI /v1/responses error:", errorText);
      return NextResponse.json(
        { error: "Lỗi khi gọi GPT", detail: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Lấy text từ output -> content -> text
    const rawText: string =
      data?.output?.[0]?.content?.find(
        (c: any) => c.type === "output_text"
      )?.text ?? "";

    if (!rawText) {
      console.error("Không tìm thấy output_text trong Responses:", data);
      return NextResponse.json(
        { error: "Không nhận được nội dung từ GPT" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error("JSON parse error (AU):", err, "raw:", rawText);
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ", raw: rawText },
        { status: 500 }
      );
    }

    // Đảm bảo có mảng aus
    if (!parsed.aus || !Array.isArray(parsed.aus)) {
      console.error("JSON không có field 'aus':", parsed);
      return NextResponse.json(
        { error: "JSON không có trường 'aus'", raw: parsed },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        aus: parsed.aus,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Lỗi server /api/au-gen:", err);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
