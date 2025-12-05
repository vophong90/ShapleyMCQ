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
    if (!apiKey) {
      console.error("OPENAI_API_KEY không tồn tại trong môi trường server");
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trên server" },
        { status: 500 }
      );
    }

    const model = (process.env.OPENAI_MCQ_MODEL || "gpt-5.1").trim();

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

    // 🚀 Chat Completions – trả về text thường
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Bạn là chuyên gia viết distractor NBME/USMLE. Chỉ trả lời bằng distractor mới, không giải thích.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok) {
      console.error("OpenAI error tại /api/mcqs/refine-distractor:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT (refine-distractor)",
          detail: JSON.stringify(data, null, 2),
        },
        { status: 500 }
      );
    }

    const content: string | undefined = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error(
        "Không có message.content hợp lệ (refine-distractor):",
        data
      );
      return NextResponse.json(
        { error: "GPT không trả về distractor mới." },
        { status: 500 }
      );
    }

    return NextResponse.json({ refined: content.trim() }, { status: 200 });
  } catch (err: any) {
    console.error("refine-distractor error:", err);
    return NextResponse.json(
      { error: "Lỗi server khi refine distractor.", detail: String(err) },
      { status: 500 }
    );
  }
}
