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
      N = 1200
    } = body;

    if (!stem || !correct_answer || !Array.isArray(distractors)) {
      return NextResponse.json(
        { error: "Thiếu stem, correct_answer hoặc distractors." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_MCSIM_MODEL?.trim() || "gpt-5.1";

    // Map option labels
    const options = [correct_answer, ...distractors];
    const labels = ["A", "B", "C", "D"];

    const labeledOptions = options.map((text, idx) => ({
      label: labels[idx],
      text,
      is_correct: idx === 0
    }));

    // Định nghĩa persona
    const personas = [
      {
        name: "Expert",
        description:
          "Bác sĩ/ sinh viên rất giỏi, hiểu sâu lý thuyết và lâm sàng, mắc lỗi rất ít."
      },
      {
        name: "Proficient",
        description:
          "Người học khá, nắm tốt kiến thức cốt lõi, đôi khi nhầm ở chi tiết khó."
      },
      {
        name: "Average",
        description:
          "Người học trung bình, nắm được ý chính nhưng dễ bị distractor đánh lừa."
      },
      {
        name: "Novice",
        description:
          "Mới học, chưa hệ thống hóa kiến thức, hay nhầm lẫn khái niệm."
      },
      {
        name: "Weak",
        description:
          "Ít học, chủ yếu dựa vào đoán mò hoặc ấn tượng mơ hồ, rất dễ sai."
      },
      {
        name: "Guesser",
        description:
          "Hoàn toàn đoán mò, không có kiến thức liên quan, chọn ngẫu nhiên."
      }
    ];

    const mcqBlock = `
STEM:
${stem}

OPTIONS:
${labeledOptions.map(o => `${o.label}. ${o.text}`).join("\n")}

Correct answer: ${labeledOptions[0].label}
Explanation (nếu có):
${explanation || "(không có)"}
`.trim();

    const personaText = personas
      .map(
        (p, idx) =>
          `${idx + 1}. ${p.name}: ${p.description}`
      )
      .join("\n");

    const prompt = `
Bạn là chuyên gia đo lường đánh giá trong giáo dục Y khoa.

Nhiệm vụ:
- Với mỗi kiểu người học (persona) dưới đây, hãy ước lượng XÁC SUẤT họ chọn từng phương án A, B, C, D cho câu MCQ đã cho.
- Xác suất phải >=0 và tổng 4 phương án = 1.
- Expert có xác suất chọn đáp án đúng rất cao.
- Weak/Guesser chọn sai nhiều hơn, thường tập trung vào distractors "hấp dẫn".
- Không cần tạo dữ liệu Monte Carlo, chỉ cần trả về phân bố xác suất (probability) cho từng persona.

Các persona:
${personaText}

Câu MCQ:
${mcqBlock}

YÊU CẦU TRẢ VỀ JSON ĐÚNG CẤU TRÚC:

{
  "personas": [
    {
      "name": "Expert",
      "probs": { "A": 0.9, "B": 0.05, "C": 0.03, "D": 0.02 }
    },
    {
      "name": "Proficient",
      "probs": { "A": 0.8, "B": 0.1, "C": 0.05, "D": 0.05 }
    }
    ...
  ]
}

Không thêm trường nào khác.
`.trim();

    // Gọi GPT để lấy phân bố xác suất theo persona
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

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json(
        { error: "Lỗi khi gọi GPT Monte Carlo persona.", detail: t },
        { status: 500 }
      );
    }

    const data = await res.json();
    const text = data.output_text;

    if (!text) {
      return NextResponse.json(
        { error: "GPT không trả về nội dung persona probs." },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return NextResponse.json(
        { error: "JSON persona probs không hợp lệ.", raw: text },
        { status: 500 }
      );
    }

    const personaProbs: {
      name: string;
      probs: Record<string, number>;
    }[] = parsed.personas || [];

    // MONTE CARLO SAMPLING
    const response_matrix: any[] = [];
    const accuracy_summary: {
      persona: string;
      accuracy: number;
      total: number;
    }[] = [];

    const personasUsed = personas.map(p => p.name);

    const N_per_persona = Math.floor(N / personasUsed.length);

    function sampleFromProbs(probs: Record<string, number>): string {
      const keys = ["A", "B", "C", "D"];
      const cumulative: number[] = [];
      let acc = 0;
      for (const k of keys) {
        acc += probs[k] ?? 0;
        cumulative.push(acc);
      }
      const r = Math.random() * acc;
      for (let i = 0; i < keys.length; i++) {
        if (r <= cumulative[i]) return keys[i];
      }
      return "A";
    }

    for (const personaName of personasUsed) {
      const pObj =
        personaProbs.find(p => p.name === personaName) ||
        personaProbs[0];

      const probs = pObj?.probs || { A: 0.25, B: 0.25, C: 0.25, D: 0.25 };
      let correctCount = 0;

      for (let i = 0; i < N_per_persona; i++) {
        const chosenLabel = sampleFromProbs(probs);
        const idx = labels.indexOf(chosenLabel);
        const chosenText =
          idx >= 0 && idx < options.length ? options[idx] : options[0];

        const isCorrect = chosenLabel === labeledOptions[0].label;
        if (isCorrect) correctCount++;

        response_matrix.push({
          persona: personaName,
          chosen_option: chosenLabel,
          chosen_text: chosenText,
          is_correct: isCorrect
        });
      }

      accuracy_summary.push({
        persona: personaName,
        accuracy: correctCount / N_per_persona,
        total: N_per_persona
      });
    }

    return NextResponse.json({
      options: labeledOptions,
      personas: personaProbs,
      N_per_persona,
      response_matrix,
      accuracy_summary
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi Monte Carlo Simulator", detail: String(err) },
      { status: 500 }
    );
  }
}
