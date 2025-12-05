import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      au_text,
      misconceptions,
      specialty_name,
      learner_level,
      bloom_level,
      count,
      clinical_vignette,
    } = body;

    if (!au_text || !Array.isArray(misconceptions)) {
      return NextResponse.json(
        { error: "Thiếu au_text hoặc danh sách misconceptions." },
        { status: 400 }
      );
    }

    const n =
      typeof count === "number" && count > 0 && count <= 10 ? count : 3;

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    const misText =
      misconceptions.length > 0
        ? misconceptions
            .map(
              (m: any, i: number) =>
                `(${i + 1}) [${m.error_type ?? "mis"}] ${m.description}`
            )
            .join("\n")
        : "(Không có misconception rõ ràng, tự thiết kế distractors hợp lý nhưng vẫn phản ánh lỗi tư duy thường gặp).";

    const vignetteHint = clinical_vignette
      ? `
BẮT BUỘC: Mỗi câu phải viết dưới dạng TÌNH HUỐNG LÂM SÀNG (clinical vignette):
- Có bối cảnh bệnh nhân (tuổi, giới, triệu chứng chính, bối cảnh khám…).
- Stem kết thúc bằng câu hỏi rõ ràng, yêu cầu ONE BEST ANSWER.
- Tránh chi tiết thừa, nhưng phải đủ để định hướng lập luận lâm sàng.
`
      : `
Nếu không yêu cầu tình huống lâm sàng, có thể dùng stem dạng tình huống ngắn hoặc mô tả cơ chế, nhưng vẫn đảm bảo ONE BEST ANSWER.
`;

    const prompt = `
Bạn là chuyên gia viết câu hỏi NBME/USMLE Step 1–2–3.

Nhiệm vụ: Viết CHÍNH XÁC ${n} câu MCQ dựa trên:

- Assessment Unit (AU): "${au_text}"
- Chuyên ngành: ${specialty_name}
- Bậc học: ${learner_level}
- Mức Bloom mục tiêu: ${bloom_level}

Danh sách Misconceptions dùng để tạo distractors:
${misText}

YÊU CẦU CHUNG:
- Mỗi câu phải có ONE BEST ANSWER.
- 4 lựa chọn A–D.
- Distractors phải sinh ra từ chính các misconceptions ở trên (hoặc biến thể hợp lý của chúng).
- Không sử dụng wording giống hệt đáp án đúng.
- Không tạo distractor vô lý quá mức.
- Không tạo distractor đúng một phần (không rõ đúng/sai).
- Phù hợp chuẩn NBME Item Writing Guidelines.
- Đúng mức Bloom ${bloom_level}.
- Không dùng câu phủ định kiểu "KHÔNG phải", "TẤT CẢ NGOẠI TRỪ" nếu tránh được.

${vignetteHint}

ĐỊNH DẠNG JSON DUY NHẤT ĐƯỢC CHẤP NHẬN:

{
  "items": [
    {
      "stem": "…",
      "correct_answer": "…",
      "distractors": ["...", "...", "..."],
      "explanation": "Giải thích tại sao đáp án đúng và tại sao các distractors sai."
    },
    {
      "stem": "…",
      "correct_answer": "…",
      "distractors": ["...", "...", "..."],
      "explanation": "…"
    }
    ...
  ]
}

- "items" phải là một mảng gồm đúng ${n} phần tử.
- Không thêm text ngoài JSON.
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

    const text: string =
      (data as any).output_text ??
      (data as any).output?.[0]?.content?.[0]?.text ??
      "";

    if (!text) {
      return NextResponse.json(
        { error: "GPT không trả về nội dung MCQ." },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return NextResponse.json(
        {
          error: "JSON GPT trả về sai định dạng",
          raw: text,
        },
        { status: 500 }
      );
    }

    let items = Array.isArray(parsed?.items) ? parsed.items : null;
    if (!items && Array.isArray(parsed)) {
      items = parsed;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy mảng items hợp lệ trong JSON GPT." },
        { status: 500 }
      );
    }

    // Optionally cắt đúng n phần tử đầu
    const trimmed = items.slice(0, n);

    return NextResponse.json(trimmed);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server MCQ gen", detail: String(err) },
      { status: 500 }
    );
  }
}
