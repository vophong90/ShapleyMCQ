import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MCQPayload = {
  stem: string;
  correct_answer: string;
  distractors: string[];
  explanation: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as MCQPayload | null;

    if (
      !body ||
      !body.stem?.trim() ||
      !body.correct_answer?.trim() ||
      !Array.isArray(body.distractors) ||
      body.distractors.length === 0
    ) {
      return NextResponse.json(
        { error: "Thiếu dữ liệu MCQ (stem, correct_answer, distractors)." },
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

    const { stem, correct_answer, distractors, explanation } = body;

    const prompt = `
Bạn là chuyên gia NBME/USMLE Item Writing.

Đánh giá câu MCQ sau theo hai phần:
1) Hard rules: các lỗi "tối kỵ" (ví dụ: clue trong stem, đáp án dài khác biệt, phủ định kép, nhiều hơn một đáp án đúng, v.v.)
2) Rubric chấm điểm chi tiết.

Câu MCQ:
- Stem: ${stem}
- Correct answer: ${correct_answer}
- Distractors: ${distractors
      .map((d, i) => `(${i + 1}) ${d}`)
      .join("; ")}
- Explanation: ${explanation}

YÊU CẦU:
- Phần hard_rules:
  - passed: true/false (true nếu KHÔNG vi phạm lỗi tối kỵ nào nghiêm trọng).
  - flags: mảng string, mỗi phần tử mô tả 1 lỗi cụ thể (nếu có).

- Phần rubric:
  - overall_score: số từ 1–5 (5 là tốt nhất).
  - summary: tóm tắt nhận xét.
  - dimensions: object gồm các key:
    - stem_clarity
    - one_best_answer
    - distractor_quality
    - clinical_relevance
    - technical_flaws
    Mỗi dimension có:
      { "score": số 1–5, "comment": string ngắn }
  - suggestions: đoạn text liệt kê các gợi ý chỉnh sửa.

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON THUẦN, KHÔNG GIẢI THÍCH THÊM, KHÔNG THÊM TEXT NGOÀI JSON:

{
  "hard_rules": {
    "passed": true,
    "flags": ["...", "..."]
  },
  "rubric": {
    "overall_score": 4,
    "summary": "...",
    "dimensions": {
      "stem_clarity": { "score": 4, "comment": "..." },
      "one_best_answer": { "score": 4, "comment": "..." },
      "distractor_quality": { "score": 3, "comment": "..." },
      "clinical_relevance": { "score": 4, "comment": "..." },
      "technical_flaws": { "score": 5, "comment": "..." }
    },
    "suggestions": "..."
  }
}
`.trim();

    // 🚀 Chat Completions – JSON mode
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
              "Bạn là chuyên gia NBME/USMLE, CHỈ trả lời bằng JSON đúng schema yêu cầu.",
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
      console.error("OpenAI error tại /api/mcqs/nbme-check:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT (nbme-check)",
          detail: JSON.stringify(data, null, 2),
        },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ (nbme-check):", data);
      return NextResponse.json(
        { error: "Không nhận được content hợp lệ từ GPT (nbme-check)" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error(
        "JSON parse error ở /api/mcqs/nbme-check:",
        e,
        "raw:",
        content
      );
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ (nbme-check)", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (err: any) {
    console.error("nbme-check error:", err);
    return NextResponse.json(
      { error: "Lỗi server NBME check.", detail: String(err) },
      { status: 500 }
    );
  }
}
