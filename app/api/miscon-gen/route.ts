// app/api/miscon-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MisconGenRequest = {
  specialty_name?: string;
  learner_level?: string;
  bloom_level?: string;
  aus?: { id: string; text: string }[];
  existing?: { au_id: string; descriptions: string[] }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as MisconGenRequest | null;

    if (!body) {
      return NextResponse.json(
        { error: "Body request trống" },
        { status: 400 }
      );
    }

    const { specialty_name, learner_level, bloom_level, aus, existing } = body;

    if (!Array.isArray(aus) || aus.length === 0) {
      return NextResponse.json(
        { error: "Thiếu danh sách AU để sinh Misconceptions." },
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

    const existingBlock =
      existing && existing.length
        ? existing
            .map(
              (ex, idx) =>
                `AU #${idx + 1} (au_id=${ex.au_id}):\n- Mis đã có:\n${ex.descriptions
                  .map((d, i) => `  (${i + 1}) ${d}`)
                  .join("\n")}`
            )
            .join("\n\n")
        : "Không có Misconception đã lưu trước đó.";

    const ausBlock = aus
      .map((a, i) => `(${i + 1}) [${a.id}] ${a.text}`)
      .join("\n");

    const prompt = `
Bạn là chuyên gia giáo dục Y khoa và cognitive science.

Nhiệm vụ: Tạo danh sách MISCONCEPTIONS cho từng Assessment Unit (AU).

Định nghĩa Misconception:
- Là một sai lầm phổ biến nhưng có tính hợp lý (plausible), có thể dùng làm distractor trong MCQ.
- Gắn trực tiếp với nội dung AU (không lan man sang kiến thức khác).
- Có thể xuất phát từ: hiểu sai khái niệm, nhầm lẫn cơ chế, nhầm thuật ngữ, thiếu kiến thức nền, xuyên suy diễn sai, thiên kiến nhận thức (availability, anchoring, representativeness...).
- Không được quá cực đoan hay vô lý.
- Không biến thành câu đúng hoặc gần đúng.

Bối cảnh:
- Chuyên ngành: ${specialty_name || "không rõ"}
- Bậc học (learner_level): ${learner_level || "không rõ"}
- Mức Bloom mục tiêu: ${bloom_level || "không rõ"}

Danh sách AU đầu vào:
${ausBlock}

Misconceptions đã lưu trước đó (phải tránh lặp lại hoặc rất giống):
${existingBlock}

Yêu cầu:
1) Với mỗi AU, tạo ra một số Misconceptions mới, phù hợp với AU đó.
2) KHÔNG được lặp lại hoặc quá giống với các Misconceptions đã liệt kê ở phần "Misconceptions đã lưu trước đó".
3) Mỗi Misconception phải đủ rõ ràng, súc tích, có thể dùng làm distractor trong MCQ.

Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC sau (không thêm trường khác):

{
  "misconceptions": [
    {
      "au_id": "id của AU (giống với input aus[].id)",
      "au_text": "string",
      "items": [
        {
          "description": "string",
          "error_type": "conceptual|procedural|bias|clinical_reasoning|terminology"
        }
      ]
    }
  ]
}
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
                "Bạn là trợ lý giáo dục y khoa, CHỈ trả lời bằng JSON đúng schema yêu cầu.",
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
      console.error("OpenAI error tại /api/miscon-gen:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT để sinh Misconceptions",
          detail: JSON.stringify(data, null, 2),
        },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ ở /api/miscon-gen:", data);
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
        "JSON parse error ở /api/miscon-gen:",
        e,
        "raw content:",
        content
      );
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (e: any) {
    console.error("Lỗi server /api/miscon-gen:", e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
