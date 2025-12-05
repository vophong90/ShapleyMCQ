import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const stem = body?.stem as string | undefined;

    if (!stem || !stem.trim()) {
      return NextResponse.json(
        { error: "Thiếu stem cần refine." },
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
Bạn là chuyên gia viết câu hỏi NBME/USMLE.

Hãy viết lại stem sau đây sao cho:
- Rõ ràng hơn, mạch lạc hơn.
- Giữ nguyên ý nghĩa và mức độ khó.
- Không thay đổi đáp án đúng tiềm ẩn.
- Ngắn gọn, không lan man.

Chỉ trả về stem mới, KHÔNG giải thích, KHÔNG thêm ghi chú.

Stem gốc:
${stem}
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
              "Bạn là chuyên gia NBME/USMLE. Chỉ trả lời bằng stem mới, không giải thích.",
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
      console.error("OpenAI error tại /api/mcqs/refine-stem:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT (refine-stem)",
          detail: JSON.stringify(data, null, 2),
        },
        { status: 500 }
      );
    }

    const content: string | undefined = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ (refine-stem):", data);
      return NextResponse.json(
        { error: "GPT không trả về kết quả refine stem." },
        { status: 500 }
      );
    }

    return NextResponse.json({ refined: content.trim() }, { status: 200 });
  } catch (err: any) {
    console.error("refine-stem error:", err);
    return NextResponse.json(
      { error: "Lỗi server khi refine stem.", detail: String(err) },
      { status: 500 }
    );
  }
}
