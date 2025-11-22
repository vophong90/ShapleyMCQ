import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LloEvalRequest = {
  specialty_name?: string;
  learner_level: string; 
  bloom_level: string;
  llos_text: string; 
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LloEvalRequest;

    if (!body.learner_level || !body.bloom_level || body.llos_text.trim() === "") {
      return NextResponse.json(
        { error: "Thiếu learner_level, bloom_level hoặc llos_text" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trên server" },
        { status: 500 }
      );
    }

    // Model cao nhất bạn đang dùng
    const model =
      process.env.OPENAI_LLO_MODEL?.trim() || "gpt-5.1";

    const { learner_level, bloom_level, llos_text, specialty_name } = body;

    const prompt = `
Bạn là chuyên gia giáo dục y khoa, am hiểu thang Bloom (revised) và các bậc đào tạo y khoa.

Nhiệm vụ:
1) Phân tích từng LLO (learning outcome) được cung cấp.
2) Suy luận mức Bloom thực tế của từng LLO dựa trên động từ & nội dung.
3) Đánh giá mức Bloom người dùng chọn có phù hợp không.
4) Đánh giá độ phù hợp của LLO với bậc đào tạo:
   - undergrad = sinh viên y khoa
   - postgrad = học viên sau đại học
   - phd = nghiên cứu sinh

Trả lời CHỈ bằng JSON với cấu trúc:

{
  "overall_comment": "string",
  "items": [
    {
      "llo": "string",
      "inferred_bloom": "remember|understand|apply|analyze|evaluate|create",
      "bloom_match": "good|too_low|too_high",
      "level_fit": "good|too_easy|too_hard",
      "comments": "string"
    }
  ]
}

Không được thêm trường nào khác.

Dữ liệu:
- Chuyên ngành: ${specialty_name || "không rõ"}
- Bậc đào tạo: ${learner_level}
- Mức Bloom mục tiêu: ${bloom_level}

Các LLO:
${llos_text}
`.trim();

    // 🔥 GPT-5.1 API mới – không dùng messages nữa
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: prompt
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", errorText);
      return NextResponse.json(
        { error: "Lỗi khi gọi GPT", detail: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.output_text;

    if (!content) {
      return NextResponse.json(
        { error: "Không nhận được content từ GPT" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error:", e, "raw:", content);
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
