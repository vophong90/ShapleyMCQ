// app/api/mcq-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";

type StemLength = "short" | "medium" | "long";
type DifficultyLevel = "easy" | "medium" | "hard";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      au_text,
      misconceptions,
      specialty_name,
      learner_level,
      bloom_level,
      clinical_vignette,
      stem_length,
      difficulty,
      // count bị bỏ qua, luôn ép n = 3
    } = body;

    if (!au_text || !Array.isArray(misconceptions)) {
      return NextResponse.json(
        { error: "Thiếu au_text hoặc danh sách misconceptions." },
        { status: 400 }
      );
    }

    // ✅ Luôn ép mỗi lần chỉ tạo 3 câu
    const n = 3;

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MCQ_MODEL?.trim() || "gpt-5.1";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    // ====== Chuẩn bị text cho misconceptions ======
    const misText =
      misconceptions.length > 0
        ? misconceptions
            .map(
              (m: any, i: number) =>
                `(${i + 1}) [${m.error_type ?? "mis"}] ${m.description}`
            )
            .join("\n")
        : "(Không có misconception rõ ràng, tự thiết kế distractors hợp lý nhưng vẫn phản ánh lỗi tư duy thường gặp).";

    // ====== Hint cho clinical vignette ======
    const vignetteHint = clinical_vignette
      ? `
BẮT BUỘC: Mỗi câu phải viết dưới dạng TÌNH HUỐNG LÂM SÀNG (clinical vignette):
- Có bối cảnh bệnh nhân (tuổi, giới, bối cảnh khám, triệu chứng chính).
- Stem kết thúc bằng câu hỏi rõ ràng, yêu cầu ONE BEST ANSWER.
- Tránh chi tiết thừa, nhưng phải đủ để định hướng lập luận lâm sàng.
`
      : `
Nếu không yêu cầu tình huống lâm sàng, có thể dùng stem dạng tình huống ngắn hoặc mô tả cơ chế, nhưng vẫn đảm bảo ONE BEST ANSWER.
`;

    // ====== Quy tắc stem_length ======
    const stemLengthDesc = (() => {
      const s = (stem_length as StemLength) || "medium";
      if (s === "short") {
        return `
- Độ dài stem: NGẮN (short) ≈ 1–2 câu, tối đa ~50 từ.
- Chỉ giữ chi tiết tối thiểu cần thiết để hiểu câu hỏi.
`;
      }
      if (s === "long") {
        return `
- Độ dài stem: DÀI (long) ≈ 120–250 từ.
- Có thể mô tả diễn tiến bệnh, xét nghiệm, điều trị đã dùng, chi tiết đủ cho suy luận nhiều bước.
`;
      }
      // medium
      return `
- Độ dài stem: TRUNG BÌNH (medium) ≈ 50–120 từ.
- Có bối cảnh vừa đủ, không quá sơ sài, không lan man.
`;
    })();

    // ====== Quy tắc difficulty ======
    const difficultyDesc = (() => {
      const d = (difficulty as DifficultyLevel) || "medium";
      if (d === "easy") {
        return `
- Độ khó: DỄ (easy).
- Chủ yếu kiểm tra nhớ/hiểu (Bloom: remember/understand).
- Distractors không quá tinh vi, nhưng vẫn hợp lý.
- Ít hoặc không có "red herrings" phức tạp.
`;
      }
      if (d === "hard") {
        return `
- Độ khó: KHÓ (hard).
- Yêu cầu lập luận nhiều bước, xử lý thông tin mơ hồ, phân biệt giữa các lựa chọn gần đúng.
- Distractors phải rất sát với đáp án đúng, phản ánh lỗi lập luận tinh vi.
- Bloom: ít nhất analyze/evaluate.
`;
      }
      // medium
      return `
- Độ khó: TRUNG BÌNH (medium).
- Yêu cầu áp dụng kiến thức vào tình huống (Bloom: apply/analyze).
- Distractors hợp lý, nhưng không tinh vi đến mức "trick question".
`;
    })();

    // ====== PROMPT 1: GENERATE ======
    const generatePrompt = `
Bạn là chuyên gia viết câu hỏi NBME/USMLE Step 1–2–3.

Nhiệm vụ: Viết CHÍNH XÁC ${n} câu hỏi trắc nghiệm nhiều lựa chọn (MCQ) dựa trên:

- Assessment Unit (AU): "${au_text}"
- Chuyên ngành: ${specialty_name || "Y học cổ truyền"}
- Bậc học: ${learner_level || "Sinh viên y khoa"}
- Mức Bloom mục tiêu (tham chiếu): ${bloom_level || "apply/analyze"}

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
- Không dùng câu phủ định kiểu "KHÔNG phải", "TẤT CẢ NGOẠI TRỪ" nếu tránh được.

${vignetteHint}

YÊU CẦU VỀ ĐỘ DÀI STEM:
${stemLengthDesc}

YÊU CẦU VỀ ĐỘ KHÓ:
${difficultyDesc}

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

    // ====== CALL 1: GPT GENERATE ======
    const genRes = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: generatePrompt,
        response_format: { type: "json_object" },
      }),
    });

    const genData = await genRes.json();

    const genText: string =
      (genData as any).output_text ??
      (genData as any).output?.[0]?.content?.[0]?.text ??
      "";

    if (!genRes.ok || !genText) {
      return NextResponse.json(
        {
          error: "GPT không trả về nội dung MCQ ở bước generate.",
          detail: genData,
        },
        { status: 500 }
      );
    }

    let genParsed: any;
    try {
      genParsed = JSON.parse(genText);
    } catch (err) {
      return NextResponse.json(
        {
          error: "JSON GPT (generate) trả về sai định dạng",
          raw: genText,
        },
        { status: 500 }
      );
    }

    let genItems = Array.isArray(genParsed?.items) ? genParsed.items : null;
    if (!genItems && Array.isArray(genParsed)) {
      genItems = genParsed;
    }

    if (!genItems || !Array.isArray(genItems) || genItems.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy mảng items hợp lệ trong bước generate." },
        { status: 500 }
      );
    }

    // Cắt đúng 3 phần tử đầu
    genItems = genItems.slice(0, n);

    // ====== PROMPT 2: CRITIC / REVIEW & FIX ======
    const genItemsJson = JSON.stringify(genItems, null, 2);

    const criticPrompt = `
Bạn là chuyên gia thẩm định câu hỏi NBME/USMLE.

Dưới đây là các câu MCQ đã được sinh ra (JSON). Nhiệm vụ của bạn:

1) Rà soát TỪNG CÂU theo checklist:
   - Stem có rõ ràng, không mơ hồ, không lan man?
   - Đúng yêu cầu ONE BEST ANSWER?
   - Độ dài stem có phù hợp yêu cầu "${stem_length || "medium"}" không?
   - Độ khó câu hỏi có phù hợp mức "${difficulty || "medium"}" không?
   - Distractors:
       + Liên quan logic tới stem?
       + Sinh ra từ misconceptions đã cho (hoặc biến thể hợp lý)?
       + Không trùng hoặc quá giống đáp án đúng?
   - Không dùng phủ định "KHÔNG phải", "TẤT CẢ NGOẠI TRỪ" nếu tránh được.
   - Giải thích (explanation) có:
       + Nêu rõ vì sao đáp án đúng là đúng,
       + Nêu rõ vì sao từng distractor sai.

2) Nếu câu nào KHÔNG đạt yêu cầu trên, hãy CHỈNH SỬA TRỰC TIẾP:
   - Có thể sửa stem, đáp án đúng, distractors, giải thích,
   - Nhưng vẫn phải bám sát AU: "${au_text}" và bối cảnh:
     - Chuyên ngành: ${specialty_name || "Y học cổ truyền"}
     - Bậc học: ${learner_level || "Sinh viên y khoa"}
     - Mức Bloom mục tiêu: ${bloom_level || "apply/analyze"}

3) Sau khi chỉnh sửa, đảm bảo:
   - Mỗi câu vẫn có dạng:
     {
       "stem": "...",
       "correct_answer": "...",
       "distractors": ["...", "...", "..."],
       "explanation": "..."
     }
   - Mảng "items" cuối cùng vẫn gồm đúng ${n} câu.
   - Không thêm fields khác, không thêm text ngoài JSON.

ĐÂY LÀ DANH SÁCH CÂU HỎI GỐC (JSON):

${genItemsJson}

Hãy trả về JSON DUY NHẤT ở dạng:

{
  "items": [
    {
      "stem": "...",
      "correct_answer": "...",
      "distractors": ["...", "...", "..."],
      "explanation": "..."
    },
    ...
  ]
}
`.trim();

    // ====== CALL 2: GPT CRITIC ======
    const criticRes = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: criticPrompt,
        response_format: { type: "json_object" },
      }),
    });

    const criticData = await criticRes.json();

    const criticText: string =
      (criticData as any).output_text ??
      (criticData as any).output?.[0]?.content?.[0]?.text ??
      "";

    if (!criticRes.ok || !criticText) {
      return NextResponse.json(
        {
          error: "GPT không trả về nội dung MCQ ở bước critic.",
          detail: criticData,
        },
        { status: 500 }
      );
    }

    let criticParsed: any;
    try {
      criticParsed = JSON.parse(criticText);
    } catch (err) {
      return NextResponse.json(
        {
          error: "JSON GPT (critic) trả về sai định dạng",
          raw: criticText,
        },
        { status: 500 }
      );
    }

    let finalItems = Array.isArray(criticParsed?.items)
      ? criticParsed.items
      : null;
    if (!finalItems && Array.isArray(criticParsed)) {
      finalItems = criticParsed;
    }

    if (!finalItems || !Array.isArray(finalItems) || finalItems.length === 0) {
      return NextResponse.json(
        {
          error: "Không tìm thấy mảng items hợp lệ trong bước critic.",
        },
        { status: 500 }
      );
    }

    // Đảm bảo chỉ trả tối đa n = 3 câu
    finalItems = finalItems.slice(0, n);

    return NextResponse.json(finalItems);
  } catch (err: any) {
    console.error("MCQ-gen strict error:", err);
    return NextResponse.json(
      { error: "Lỗi server MCQ gen", detail: String(err) },
      { status: 500 }
    );
  }
}
