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
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình trên server." },
        { status: 500 }
      );
    }

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

    const text: string | undefined = (data as any)?.output_text;
    if (!text) {
      return NextResponse.json(
        { error: "GPT không trả về kết quả refine stem." },
        { status: 500 }
      );
    }

    return NextResponse.json({ refined: text.trim() });
  } catch (err: any) {
    console.error("refine-stem error:", err);
    return NextResponse.json(
      { error: "Lỗi server khi refine stem.", detail: String(err) },
      { status: 500 }
    );
  }
}
