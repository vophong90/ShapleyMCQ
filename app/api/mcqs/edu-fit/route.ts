import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type EduFitPayload = {
  stem: string;
  correct_answer: string;
  distractors: string[];
  explanation: string;
  learner_level?: string;
  bloom_level?: string;
  llos_text?: string;
  specialty_name?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as EduFitPayload | null;

    if (
      !body ||
      !body.stem?.trim() ||
      !body.correct_answer?.trim() ||
      !Array.isArray(body.distractors) ||
      body.distractors.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu dữ liệu MCQ cho Educational Fit (stem, correct_answer, distractors).",
        },
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

    // Có thể override bằng OPENAI_MCQ_MODEL, mặc định dùng gpt-5.1
    const model = (process.env.OPENAI_MCQ_MODEL || "gpt-5.1").trim();

    const {
      stem,
      correct_answer,
      distractors,
      explanation,
      learner_level,
      bloom_level,
      llos_text,
      specialty_name,
    } = body;

    const prompt = `
Bạn là chuyên gia giáo dục y khoa và thiết kế đề thi.

Nhiệm vụ: Đánh giá mức độ "phù hợp giáo dục" (Educational Fit) của câu MCQ sau với:
- Bậc học (learner level)
- Mức Bloom mục tiêu
- Danh sách LLOs của bài học

Thông tin:
- Chuyên ngành: ${specialty_name || "Y học cổ truyền / y khoa"}
- Bậc học: ${learner_level || "Không rõ"}
- Bloom mục tiêu: ${bloom_level || "Không rõ"}

Câu MCQ:
- Stem: ${stem}
- Correct answer: ${correct_answer}
- Distractors: ${distractors
      .map((d, i) => `(${i + 1}) ${d}`)
      .join("; ")}
- Explanation: ${explanation}

LLOs (mỗi dòng là một LLO):
${llos_text || "(không cung cấp rõ, hãy suy luận tổng quát)"}

YÊU CẦU:
1) Suy luận mức Bloom thực tế của câu hỏi này (inferred_bloom).
2) So sánh với Bloom mục tiêu (bloom_level):
   - bloom_match: "good" | "too_low" | "too_high" (hoặc mô tả khác nếu cần).
3) Đánh giá độ phù hợp với bậc học:
   - level_fit: "good" | "too_easy" | "too_hard" (hoặc mô tả khác).
4) Phân tích mức độ "coverage" của câu hỏi đối với từng LLO:
   - llo: nội dung LLO (string).
   - coverage: "direct" | "indirect" | "none".
   - comment: nhận xét ngắn (tại sao).
5) Đưa ra recommendations: mảng string, mỗi string là 1 gợi ý cụ thể để:
   - nâng/giảm mức Bloom cho phù hợp
   - điều chỉnh stem/distractors/explanation để align tốt hơn với LLOs và bậc học.

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON THUẦN (KHÔNG TEXT THỪA):

{
  "inferred_bloom": "apply / analyze / evaluate / ...",
  "bloom_match": "good" | "too_low" | "too_high",
  "level_fit": "good" | "too_easy" | "too_hard",
  "summary": "đoạn tóm tắt ngắn bằng tiếng Việt",
  "llo_coverage": [
    {
      "llo": "string",
      "coverage": "direct" | "indirect" | "none",
      "comment": "string"
    }
  ],
  "recommendations": [
    "string",
    "string"
  ]
}
`.trim();

    // 🚀 Gọi CHAT COMPLETIONS API – JSON mode
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
    });

    const data = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok) {
      console.error("OpenAI error tại /api/mcqs/edu-fit:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT (edu-fit)",
          detail: JSON.stringify(data, null, 2),
        },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ (edu-fit):", data);
      return NextResponse.json(
        { error: "Không nhận được content hợp lệ từ GPT (edu-fit)" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error ở /api/mcqs/edu-fit:", e, "raw:", content);
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ (edu-fit)", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (err: any) {
    console.error("edu-fit error:", err);
    return NextResponse.json(
      { error: "Lỗi server Educational Fit.", detail: String(err) },
      { status: 500 }
    );
  }
}
