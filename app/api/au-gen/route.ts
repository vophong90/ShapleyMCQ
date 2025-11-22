import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { specialty_name, learner_level, bloom_level, llos_text } = body;

    if (!llos_text?.trim()) {
      return NextResponse.json(
        { error: "Thiếu LLOs để tạo AU" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_LLO_MODEL?.trim() || "gpt-5.1";

    const prompt = `
Bạn là chuyên gia giáo dục Y khoa.

Nhiệm vụ: Tạo danh sách Assessment Units (AU) – đơn vị kiến thức nhỏ nhất có thể kiểm tra, từ danh sách LLO sau:

LLO:
${llos_text}

Yêu cầu:
- AU phải ngắn, rõ, cụ thể, không mơ hồ.
- AU phải là fact độc lập, không ghép 2–3 ý trong một AU.
- AU phải ở mức phù hợp với bậc học: ${learner_level}
- Chuyên ngành: ${specialty_name}
- AU là đơn vị sẽ dùng tạo MCQ → viết câu dạng kiểm tra được.

Trả lại JSON:

{
  "aus": [
    { "text": "AU 1 ..." },
    { "text": "AU 2 ..." }
  ]
}
`.trim();

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

    const data = await response.json();

    const content = data.output_text;
    if (!content) {
      return NextResponse.json(
        { error: "GPT không trả về nội dung" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return NextResponse.json(
        { error: "GPT trả về JSON sai format", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);

  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server", detail: String(err) },
      { status: 500 }
    );
  }
}
