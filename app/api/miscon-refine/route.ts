import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, error_type } = body;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Thiếu description để refine." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MISCON_MODEL?.trim() || "gpt-5.1";

    const prompt = `
Bạn là chuyên gia xây dựng câu hỏi MCQ và psychologist với 20 năm kinh nghiệm.

Nhiệm vụ: tinh chỉnh câu MISCONCEPTION sau:
- Giữ nguyên ý sai
- Làm rõ ràng hơn, tự nhiên hơn, ngắn gọn hơn
- Đảm bảo phù hợp để dùng làm distractor trong MCQ
- Không mở rộng thêm kiến thức
- Không làm quá vô lý
- Không biến nó thành đúng hoặc gần đúng
- Phù hợp cho người học mức độ ${error_type}

Chỉ trả về duy nhất một chuỗi văn bản: phiên bản đã tinh chỉnh.

Misconception đầu vào:
"${description}"
`.trim();

    const res = await fetch("https://api.openai.com/v1/responses", {
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

    const data = await res.json();

    const text = data.output_text;
    if (!text) {
      return NextResponse.json(
        { error: "GPT không trả về nội dung refine." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      refined_description: text.trim()
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server", detail: String(err) },
      { status: 500 }
    );
  }
}
