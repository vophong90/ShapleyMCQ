import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Thiếu distractor để refine." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    const prompt = `
Bạn là chuyên gia NBME/USMLE chuyên viết distractor.

Hãy tinh chỉnh distractor sau:
- Ngắn gọn, tự nhiên
- Sai nhưng hợp lý
- Không được đúng một phần
- Không được trùng wording với đáp án đúng
- Dựa trên typical misconception của sinh viên
- Dễ đánh lừa nhưng không vô lý

Chỉ trả về duy nhất 1 chuỗi: distractor đã refine.

DISTRACTOR:
"${text}"
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
    const textOut = data.output_text;

    if (!textOut) {
      return NextResponse.json(
        { error: "GPT không trả về refined distractor." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      refined: textOut.trim()
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server refine distractor", detail: String(err) },
      { status: 500 }
    );
  }
}
