import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const {
      stem,
      correct_answer,
      distractors,
      explanation,
      N,
      personaWeights, // <<– NEW
    } = body || {};

    if (
      !stem ||
      !String(stem).trim() ||
      !correct_answer ||
      !String(correct_answer).trim() ||
      !Array.isArray(distractors)
    ) {
      return NextResponse.json(
        { error: "Thiếu stem, correct_answer hoặc distractors." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY không tồn tại trong môi trường server");
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const model = (process.env.OPENAI_MCSIM_MODEL || "gpt-5.1").trim();

    // tổng số "sinh viên ảo"
    const totalN = typeof N === "number" && N > 0 ? N : 1200;

    // Map option labels (tạm thời giới hạn 4 phương án A–D)
    const options = [correct_answer, ...distractors].slice(0, 4);
    const labels = ["A", "B", "C", "D"].slice(0, options.length);

    const labeledOptions = options.map((text: string, idx: number) => ({
      label: labels[idx],
      text,
      is_correct: idx === 0,
    }));

    const personas = [
      {
        name: "Expert",
        description:
          "Bác sĩ/ sinh viên rất giỏi, hiểu sâu lý thuyết và lâm sàng, mắc lỗi rất ít.",
      },
      {
        name: "Proficient",
        description:
          "Người học khá, nắm tốt kiến thức cốt lõi, đôi khi nhầm ở chi tiết khó.",
      },
      {
        name: "Average",
        description:
          "Người học trung bình, nắm được ý chính nhưng dễ bị distractor đánh lừa.",
      },
      {
        name: "Novice",
        description:
          "Mới học, chưa hệ thống hóa kiến thức, hay nhầm lẫn khái niệm.",
      },
      {
        name: "Weak",
        description:
          "Ít học, chủ yếu dựa vào đoán mò hoặc ấn tượng mơ hồ, rất dễ sai.",
      },
      {
        name: "Guesser",
        description:
          "Hoàn toàn đoán mò, không có kiến thức liên quan, chọn ngẫu nhiên.",
      },
    ];

    const mcqBlock = `
STEM:
${stem}

OPTIONS:
${labeledOptions.map((o) => `${o.label}. ${o.text}`).join("\n")}

Correct answer: ${labeledOptions[0].label}
Explanation (nếu có):
${explanation || "(không có)"}
`.trim();

    const personaText = personas
      .map((p, idx) => `${idx + 1}. ${p.name}: ${p.description}`)
      .join("\n");

    const prompt = `
Bạn là chuyên gia đo lường đánh giá trong giáo dục Y khoa.

Nhiệm vụ:
- Với mỗi kiểu người học (persona) dưới đây, hãy ước lượng XÁC SUẤT họ chọn từng phương án A, B, C, D cho câu MCQ đã cho.
- Xác suất phải >=0 và tổng các phương án = 1.
- Expert có xác suất chọn đáp án đúng rất cao.
- Weak/Guesser chọn sai nhiều hơn, thường tập trung vào distractors "hấp dẫn".
- Không cần tạo dữ liệu Monte Carlo, chỉ cần trả về phân bố xác suất (probability) cho từng persona.

Các persona:
${personaText}

Câu MCQ:
${mcqBlock}

YÊU CẦU TRẢ VỀ JSON ĐÚNG CẤU TRÚC (KHÔNG THÊM FIELD KHÁC):

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
`.trim();

    // 🚀 Gọi Chat Completions – JSON mode
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
              "Bạn là chuyên gia đo lường đánh giá trong giáo dục y khoa, CHỈ trả lời bằng JSON đúng schema yêu cầu.",
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
      console.error("OpenAI error tại /api/mcqs/simulate:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT Monte Carlo persona.",
          detail: JSON.stringify(data, null, 2),
        },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ (simulate):", data);
      return NextResponse.json(
        { error: "GPT không trả về nội dung persona probs." },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error(
        "JSON persona probs không hợp lệ (simulate):",
        e,
        "raw:",
        content
      );
      return NextResponse.json(
        { error: "JSON persona probs không hợp lệ.", raw: content },
        { status: 500 }
      );
    }

    const personaProbs: { name: string; probs: Record<string, number> }[] =
      parsed.personas || [];

    // =============== XỬ LÝ WEIGHT TỪ FRONTEND ===============
    const personaNames = personas.map((p) => p.name);

    // Map weight: mặc định 1 cho tất cả nếu không gửi gì
    const rawWeights: number[] = personaNames.map((name) => {
      if (
        personaWeights &&
        typeof personaWeights === "object" &&
        typeof personaWeights[name] === "number"
      ) {
        return Math.max(0, personaWeights[name]); // không cho âm
      }
      return 1; // default equal weight
    });

    let sumWeight = rawWeights.reduce((s, w) => s + w, 0);
    if (sumWeight <= 0) {
      // fallback: tất cả = 1
      for (let i = 0; i < rawWeights.length; i++) rawWeights[i] = 1;
      sumWeight = rawWeights.length;
    }

    // Chuyển weight -> số lượt mô phỏng cho từng persona
    const personaNs: number[] = [];
    let sumAssigned = 0;
    for (let i = 0; i < rawWeights.length; i++) {
      const ideal = (rawWeights[i] / sumWeight) * totalN;
      const n_i = Math.max(0, Math.floor(ideal));
      personaNs.push(n_i);
      sumAssigned += n_i;
    }

    // Phân bổ phần còn dư (nếu có) cho các persona đầu tiên
    let remaining = totalN - sumAssigned;
    let idx = 0;
    while (remaining > 0 && personaNs.length > 0) {
      personaNs[idx % personaNs.length] += 1;
      remaining--;
      idx++;
    }

    // =============== MONTE CARLO SAMPLING ===============
    const response_matrix: any[] = [];
    const accuracy_summary: { persona: string; accuracy: number; total: number }[] =
      [];

    function sampleFromProbs(probs: Record<string, number>): string {
      const keys = labels; // dùng đúng số phương án đang có
      const cumulative: number[] = [];
      let acc = 0;
      for (const k of keys) {
        acc += probs[k] ?? 0;
        cumulative.push(acc);
      }
      if (acc <= 0) {
        // fallback đều
        const r = Math.random();
        const step = 1 / keys.length;
        let threshold = step;
        for (let i = 0; i < keys.length; i++) {
          if (r < threshold) return keys[i];
          threshold += step;
        }
        return keys[0];
      }
      const r = Math.random() * acc;
      for (let i = 0; i < keys.length; i++) {
        if (r <= cumulative[i]) return keys[i];
      }
      return keys[0];
    }

    personaNames.forEach((personaName, i) => {
      const personaN = Math.max(0, personaNs[i] || 0);
      if (personaN === 0) {
        // nếu weight = 0 thì bỏ qua persona này
        return;
      }

      const pObj =
        personaProbs.find((p) => p.name === personaName) ||
        personaProbs[0] || {
          name: personaName,
          probs: Object.fromEntries(
            labels.map((l) => [l, 1 / labels.length])
          ) as Record<string, number>,
        };

      // đảm bảo có đầy đủ key A–D (hoặc ít hơn tùy số options)
      const probs: Record<string, number> = {};
      const base = pObj.probs || {};
      if (Object.keys(base).length === 0) {
        labels.forEach((l) => (probs[l] = 1 / labels.length));
      } else {
        labels.forEach((l) => {
          probs[l] = typeof base[l] === "number" ? base[l] : 0;
        });
      }

      let correctCount = 0;

      for (let k = 0; k < personaN; k++) {
        const chosenLabel = sampleFromProbs(probs);
        const idxOpt = labels.indexOf(chosenLabel);
        const chosenText =
          idxOpt >= 0 && idxOpt < options.length ? options[idxOpt] : options[0];

        const isCorrect = chosenLabel === labeledOptions[0].label;
        if (isCorrect) correctCount++;

        response_matrix.push({
          persona: personaName,
          chosen_option: chosenLabel,
          chosen_text: chosenText,
          is_correct: isCorrect,
        });
      }

      accuracy_summary.push({
        persona: personaName,
        accuracy: personaN > 0 ? correctCount / personaN : 0,
        total: personaN,
      });
    });

    return NextResponse.json(
      {
        options: labeledOptions,
        personas: personaProbs,
        N_per_persona: totalN, // field này frontend không dùng; tạm trả totalN
        response_matrix,
        accuracy_summary,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Lỗi Monte Carlo Simulator:", err);
    return NextResponse.json(
      { error: "Lỗi Monte Carlo Simulator", detail: String(err) },
      { status: 500 }
    );
  }
}
