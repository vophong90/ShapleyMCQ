import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      au_text,
      misconceptions,
      specialty_name,
      learner_level,
      bloom_level
    } = body;

    if (!au_text || !Array.isArray(misconceptions)) {
      return NextResponse.json(
        { error: "Thiếu au_text hoặc danh sách misconceptions." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    const prompt = `
Bạn là chuyên gia viết câu hỏi NBME/USMLE Step 1–2–3.

Sinh 01 câu hỏi MCQ dựa trên:

- Assessment Unit (AU): "${au_text}"
- Chuyên ngành: ${specialty_name}
- Bậc học: ${learner_level}
- Mức Bloom: ${bloom_level}

Danh sách Misconceptions cần chuyển thành distractors:
${misconceptions.map((m, i) => `(${i + 1}) ${m.description}`).join("\n")}

YÊU CẦU BẮT BUỘC:
- Stem rõ ràng, tập trung vào ONE BEST ANSWER.
- 4 lựa chọn A–D.
- Distractors phải sinh ra từ chính các misconceptions ở trên.
- Không sử dụng wording giống đáp án đúng.
- Không tạo distractor vô lý quá mức.
- Không tạo distractor đúng một phần.
- Phù hợp chuẩn NBME Item Writing Guidelines.
- Đúng mức Bloom ${bloom_level}.
- Không dùng câu phủ định kiểu "KHÔNG phải".

Định dạng JSON:

{
  "stem": "…",
  "correct_answer": "…",
  "distractors": ["...", "...", "..."],
  "explanation": "Giải thích tại sao đáp án đúng và tại sao distractors sai."
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
        { error: "GPT không trả về nội dung MCQ." },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return NextResponse.json(
        { error: "JSON GPT trả về sai định dạng", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server MCQ gen", detail: String(err) },
      { status: 500 }
    );
  }
}
