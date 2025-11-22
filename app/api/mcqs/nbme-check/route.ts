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

    // 1. HARD RULES CHECK
    const flags: string[] = [];

    // Stem đủ dài để có context
    if (stem.trim().length < 40) {
      flags.push("Stem quá ngắn, thiếu bối cảnh lâm sàng hoặc thông tin.");
    }

    // Số lựa chọn
    if (distractors.length < 3) {
      flags.push("Số distractor < 3 (nên có 3 distractor cho MCQ 4 lựa chọn).");
    }

    // Duplicate option text
    const options = [correct_answer, ...distractors];
    const uniqueOptions = new Set(options.map((o) => o.trim().toLowerCase()));
    if (uniqueOptions.size < options.length) {
      flags.push("Có lựa chọn trùng lặp hoặc gần như trùng lặp.");
    }

    // Negative wording
    const negativePattern = /\b(KHÔNG|KHONG|NOT|EXCEPT|KHÔNG PHẢI)\b/i;
    if (negativePattern.test(stem)) {
      flags.push(
        "Stem có từ phủ định kiểu 'KHÔNG/EXCEPT/NOT', NBME khuyến cáo hạn chế."
      );
    }

    // Absolute terms
    const absolutePattern = /\b(always|never|luôn luôn|không bao giờ)\b/i;
    if (absolutePattern.test(options.join(" "))) {
      flags.push(
        "Lựa chọn có từ tuyệt đối (always/never...), NBME khuyến cáo hạn chế."
      );
    }

    const hardPassed = flags.length === 0;

    // 2. GPT RUBRIC CHECK (USMLE/NBME style)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trên server." },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

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
Bạn là chuyên gia viết câu hỏi NBME/USMLE với 20 năm kinh nghiệm.

Nhiệm vụ: ĐÁNH GIÁ câu MCQ theo tiêu chuẩn USMLE/NBME.

Tiêu chí đánh giá (1–5):
- stem_clarity: Stem rõ ràng, tập trung, không mơ hồ, không dư thông tin.
- one_best_answer: Có đúng 1 lựa chọn tốt nhất, không có lựa chọn đúng cạnh tranh.
- distractor_quality: Distractor sai nhưng hợp lý, phản ánh misconception phổ biến, không vô lý.
- clinical_relevance: Câu hỏi tập trung vào ý chính, phù hợp bối cảnh lâm sàng/ khoa học.
- technical_flaws: Tránh lỗi kỹ thuật (manh mối ngữ pháp, chiều dài đáp án, dùng ALL/NEVER, ...).

Yêu cầu output JSON:

{
  "overall_score": 1-5 (số nguyên),
  "summary": "tóm tắt chất lượng câu hỏi, tiếng Việt, 2-3 câu",
  "dimensions": {
    "stem_clarity": { "score": 1-5, "comment": "..." },
    "one_best_answer": { "score": 1-5, "comment": "..." },
    "distractor_quality": { "score": 1-5, "comment": "..." },
    "clinical_relevance": { "score": 1-5, "comment": "..." },
    "technical_flaws": { "score": 1-5, "comment": "..." }
  },
  "suggestions": "gợi ý cụ thể để chỉnh sửa câu hỏi, tiếng Việt, 3-5 gợi ý dạng bullet."
}

Không thêm trường nào khác.
Đây là câu MCQ cần đánh giá:

${mcqText}
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
        { error: "Lỗi khi gọi GPT NBME checker.", detail: text },
        { status: 500 }
      );
    }

    const data = await response.json();
    const outText = data.output_text;

    if (!outText) {
      return NextResponse.json(
        { error: "GPT không trả về nội dung NBME rubric." },
        { status: 500 }
      );
    }

    let rubric: any;
    try {
      rubric = JSON.parse(outText);
    } catch (e) {
      return NextResponse.json(
        { error: "JSON NBME rubric không hợp lệ.", raw: outText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hard_rules: {
        passed: hardPassed,
        flags,
      },
      rubric,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server NBME checker.", detail: String(err) },
      { status: 500 }
    );
  }
}
