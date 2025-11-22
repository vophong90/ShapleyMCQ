import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      specialty_name,
      learner_level,
      bloom_level,
      aus // [{ id, text }]
    } = body;

    if (!Array.isArray(aus) || aus.length === 0) {
      return NextResponse.json(
        { error: "Thiếu danh sách AU để sinh Misconceptions." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MISCON_MODEL?.trim() || "gpt-5.1";

    const prompt = `
Bạn là chuyên gia giáo dục Y khoa và cognitive science.

Nhiệm vụ: Tạo danh sách MISCONCEPTIONS cho từng Assessment Unit (AU).

Dựa trên:
- Chuyên ngành: ${specialty_name}
- Bậc học: ${learner_level}
- Mức Bloom: ${bloom_level}

AU danh sách:
${aus.map((a, i) => `(${i + 1}) ${a.text}`).join("\n")}

Định nghĩa Misconception:
- Là một sai lầm phổ biến nhưng có tính hợp lý (plausible).
- Gắn trực tiếp với AU (không lan man sang kiến thức khác).
- Có thể xuất phát từ: hiểu sai khái niệm, nhầm lẫn cơ chế, nhầm thuật ngữ, thiếu kiến thức nền, xuyên suy diễn sai, thiên kiến nhận thức (availability, anchoring, representativeness...).
- Không được quá cực đoan hay vô lý.
- Có thể dùng làm distractor trong MCQ.

Yêu cầu output JSON:

{
  "misconceptions": [
    {
      "au_text": "AU …",
      "items": [
        {
          "description": "Sai lầm…",
          "error_type": "conceptual | procedural | bias | clinical reasoning | terminology"
        }
      ]
    }
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

    const text = data.output_text;
    if (!text) {
      return NextResponse.json(
        { error: "GPT không trả về nội dung misconceptions." },
        { status: 500 }
      );
    }

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return NextResponse.json(
        {
          error: "GPT trả về JSON sai format.",
          raw: text
        },
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
