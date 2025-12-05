import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = body?.text as string | undefined;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Thiếu distractor cần refine." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình trên server." },
        { status: 500 }
      );
    }

    const prompt = `
Bạn là chuyên gia viết distractor cho câu hỏi trắc nghiệm NBME/USMLE.

Hãy viết lại distractor sau:
- Nghe có vẻ hợp lý và "plausible".
- Không trùng wording với đáp án đúng (giả định đúng).
- Không quá vô lý, không đúng một phần.
- Ngắn gọn, rõ ràng, phù hợp phong cách NBME.

Distractor gốc:
${text}

Chỉ trả về distractor mới, KHÔNG giải thích, KHÔNG thêm ghi chú.
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
      }),
    });

    const data = await response.json();
    const out: string | undefined = (data as any)?.output_text;

    if (!out) {
      return NextResponse.json(
        { error: "GPT không trả về distractor mới." },
        { status: 500 }
      );
    }

    return NextResponse.json({ refined: out.trim() });
  } catch (err: any) {
    console.error("refine-distractor error:", err);
    return NextResponse.json(
      { error: "Lỗi server khi refine distractor.", detail: String(err) },
      { status: 500 }
    );
  }
}
