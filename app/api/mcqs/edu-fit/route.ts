import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    if (
      !stem ||
      !correct_answer ||
      !Array.isArray(distractors) ||
      distractors.length === 0
    ) {
      return NextResponse.json(
        { error: "Thiếu stem, correct_answer hoặc distractors." },
        { status: 400 }
      );
    }

    if (!learner_level || !bloom_level || !llos_text) {
      return NextResponse.json(
        { error: "Thiếu learner_level, bloom_level hoặc llos_text." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trên server." },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_EDUFIT_MODEL?.trim() || "gpt-5.1";

    const mcqText = `
STEM:
${stem}

Correct answer:
${correct_answer}

Distractors:
${distractors.map((d, i) => `(${String.fromCharCode(65 + i + 1)}) ${d}`).join("\n")}

Explanation:
${explanation || "(không có)"}
`.trim();

    const prompt = `
Bạn là chuyên gia giáo dục Y khoa & xây dựng chương trình đào tạo.

Nhiệm vụ: ĐÁNH GIÁ SỰ PHÙ HỢP GIÁO DỤC (Educational Fit) của câu MCQ với:
- Bậc đào tạo: ${learner_level}
- Mức Bloom mục tiêu: ${bloom_level}
- LLOs của bài học
- Chuyên ngành: ${specialty_name || "không rõ"}

LLOs (learning outcomes) của bài:
${llos_text}

Câu MCQ cần đánh giá:
${mcqText}

Các bước suy luận:
1) Suy luận MỨC BLOOM THỰC TẾ của câu hỏi (dựa vào stem + skill cần dùng).
2) So sánh mức Bloom thực tế với mức Bloom mục tiêu.
   - bloom_match = "good" | "too_low" | "too_high"
3) Đánh giá độ phù hợp với BẬC HỌC (learner_level).
   - level_fit = "good" | "too_easy" | "too_hard"
4) Đánh giá câu MCQ có thực sự đo được LLOs nào trong danh sách hay không:
   - LLO nào được đo trực tiếp
   - LLO nào chỉ liên quan gián tiếp
   - LLO nào không liên quan
5) Gợi ý chỉnh sửa nếu muốn nâng / hạ độ khó, hoặc gắn sát hơn với LLO.

YÊU CẦU: Trả về JSON ĐÚNG CẤU TRÚC sau (tiếng Việt):

{
  "inferred_bloom": "remember|understand|apply|analyze|evaluate|create",
  "bloom_match": "good|too_low|too_high",
  "level_fit": "good|too_easy|too_hard",
  "summary": "Tóm tắt ngắn (3-5 câu) về mức độ phù hợp của câu hỏi.",
  "llo_coverage": [
    {
      "llo": "nội dung LLO gốc (từ llos_text)",
      "coverage": "direct|indirect|none",
      "comment": "nhận xét ngắn"
    }
  ],
  "recommendations": [
    "gợi ý 1...",
    "gợi ý 2..."
  ]
}

Không thêm trường nào khác.
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

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Lỗi khi gọi GPT Educational Fit.", detail: text },
        { status: 500 }
      );
    }

    const data = await response.json();
    const outText = data.output_text;

    if (!outText) {
      return NextResponse.json(
        { error: "GPT không trả về nội dung edu-fit." },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(outText);
    } catch (e) {
      return NextResponse.json(
        { error: "JSON edu-fit không hợp lệ.", raw: outText },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server Educational Fit.", detail: String(err) },
      { status: 500 }
    );
  }
}
