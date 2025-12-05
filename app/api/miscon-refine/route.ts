// app/api/miscon-refine/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MisconRefineRequest = {
  description?: string;
  error_type?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as MisconRefineRequest | null;

    if (!body) {
      return NextResponse.json(
        { error: "Body request trống" },
        { status: 400 }
      );
    }

    const { description, error_type } = body;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Thiếu description để refine." },
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

    const model = (process.env.OPENAI_MISCON_MODEL || "gpt-5.1").trim();

    const prompt = `
Bạn là chuyên gia xây dựng câu hỏi MCQ và psychologist với 20 năm kinh nghiệm.

Nhiệm vụ: tinh chỉnh câu MISCONCEPTION sau:
- Giữ nguyên ý sai (vẫn là nhận thức sai lầm).
- Làm cho câu rõ ràng hơn, tự nhiên hơn, ngắn gọn hơn.
- Đảm bảo phù hợp để dùng làm distractor trong MCQ.
- Không mở rộng thêm kiến thức.
- Không làm quá vô lý.
- Không biến nó thành đúng hoặc gần đúng.

Thông tin bổ sung:
- Loại sai lầm (error_type): ${error_type || "không rõ"}.

Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc:

{
  "refined_description": "string"
}

Misconception đầu vào:
"${description}"
`.trim();

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Bạn là trợ lý thiết kế MCQ, CHỈ trả lời bằng JSON đúng schema yêu cầu.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const data = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok) {
      console.error("OpenAI error tại /api/miscon-refine:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT để refine Misconception",
          detail: JSON.stringify(data, null, 2),
        },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      console.error(
        "Không có message.content hợp lệ ở /api/miscon-refine:",
        data
      );
      return NextResponse.json(
        { error: "Không nhận được content hợp lệ từ GPT" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error(
        "JSON parse error ở /api/miscon-refine:",
        e,
        "raw content:",
        content
      );
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ", raw: content },
        { status: 500 }
      );
    }

    if (!parsed || typeof parsed.refined_description !== "string") {
      return NextResponse.json(
        { error: "Thiếu trường refined_description trong JSON GPT." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { refined_description: parsed.refined_description },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Lỗi server /api/miscon-refine:", e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
