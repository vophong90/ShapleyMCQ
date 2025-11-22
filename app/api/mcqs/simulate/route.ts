import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      correct_answer,
      distractors,
      N = 2000
    } = body;

    if (!correct_answer || !Array.isArray(distractors)) {
      return NextResponse.json(
        { error: "Thiếu correct_answer hoặc distractors." },
        { status: 400 }
      );
    }

    const options = [correct_answer, ...distractors];
    const optionLabels = ["A", "B", "C", "D"];

    const personas = [
      { name: "Expert", p_correct: 0.95 },
      { name: "Proficient", p_correct: 0.80 },
      { name: "Average", p_correct: 0.55 },
      { name: "Novice", p_correct: 0.35 },
      { name: "Weak", p_correct: 0.15 },
      { name: "Guesser", p_correct: 0.25 }
    ];

    const response_matrix: any[] = [];

    function pickRandomIncorrectOption() {
      const wrong = options.slice(1);
      const idx = Math.floor(Math.random() * wrong.length);
      return wrong[idx];
    }

    for (let i = 0; i < N; i++) {
      const persona = personas[i % personas.length];

      const rnd = Math.random();
      let chosen: string;

      if (rnd <= persona.p_correct) {
        chosen = correct_answer;
      } else {
        chosen = pickRandomIncorrectOption();
      }

      const label = optionLabels[options.indexOf(chosen)] || "?";

      response_matrix.push({
        persona: persona.name,
        chosen_option: label,
        chosen_text: chosen
      });
    }

    return NextResponse.json({
      personas,
      total: N,
      response_matrix
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi Monte Carlo Simulator", detail: String(err) },
      { status: 500 }
    );
  }
}
