import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stem } = body;

    if (!stem || typeof stem !== "string") {
      return NextResponse.json(
        { error: "Thiếu stem để refine." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    const prompt = `
Bạn là chuyên gia NBME Item-Writing với 20 năm kinh nghiệm.

Hãy tinh chỉnh STEM sau:
- Rõ ràng hơn, chính xác hơn
- Tập trung vào ONE BEST ANSWER
- Không thêm thông tin mới
- Không thay đổi bản chất tình huống lâm sàng
- Viết theo phong cách USMLE

Chỉ trả về duy nhất 1 chuỗi văn bản là stem đã refine.

STEM:
"${stem}"
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
        { error: "GPT không trả về refined stem." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      refined: text.trim()
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server refine stem", detail: String(err) },
      { status: 500 }
    );
  }
}
