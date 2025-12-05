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
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY chưa được cấu hình trên server." },
        { status: 500 }
      );
    }

    const { stem, correct_answer, distractors, explanation } = body;

    const prompt = `
Bạn là chuyên gia NBME/USMLE Item Writing.

Đánh giá câu MCQ sau theo hai phần:
1) Hard rules: các lỗi "tối kỵ" (ví dụ: clue trong stem, đáp án dài khác biệt, phủ định kép, nhiều hơn một đáp án đúng, v.v.)
2) Rubric chấm điểm chi tiết.

Câu MCQ:
- Stem: ${stem}
- Correct answer: ${correct_answer}
- Distractors: ${distractors.map((d, i) => `(${i + 1}) ${d}`).join("; ")}
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
        { error: "GPT không trả về nội dung NBME check." },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("NBME JSON parse error:", e, text);
      return NextResponse.json(
        { error: "JSON GPT trả về sai định dạng", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("nbme-check error:", err);
    return NextResponse.json(
      { error: "Lỗi server NBME check.", detail: String(err) },
      { status: 500 }
    );
  }
}
