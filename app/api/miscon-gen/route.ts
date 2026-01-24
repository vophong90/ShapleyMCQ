// app/api/miscon-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MisconGenRequest = {
  specialty_name?: string;
  learner_level?: string;
  bloom_level?: string;
  aus?: { id: string; text: string }[];
  existing?: { au_id: string; descriptions: string[] }[];
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as MisconGenRequest | null;

    if (!body) {
      return NextResponse.json(
        { error: "Body request trống" },
        { status: 400 }
      );
    }

    const { specialty_name, learner_level, bloom_level, aus, existing } = body;

    if (!Array.isArray(aus) || aus.length === 0) {
      return NextResponse.json(
        { error: "Thiếu danh sách AU để sinh Misconceptions." },
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

    const model = (process.env.OPENAI_MISCON_MODEL || "gpt-5.1").trim();

    // ====== Chuẩn bị block Mis đã có để tránh trùng ======
    const existingBlock =
      existing && existing.length
        ? existing
            .map(
              (ex, idx) =>
                `AU #${idx + 1} (au_id=${ex.au_id}):\n- Mis đã có:\n${ex.descriptions
                  .map((d, i) => `  (${i + 1}) ${d}`)
                  .join("\n")}`
            )
            .join("\n\n")
        : "Không có Misconception đã lưu trước đó.";

    const ausBlock = aus
      .map((a, i) => `(${i + 1}) [${a.id}] ${a.text}`)
      .join("\n");

    // ====== PROMPT 1: GENERATE ======
    const generatePrompt = `
Bạn là chuyên gia giáo dục Y khoa và cognitive science.

Nhiệm vụ: Tạo danh sách MISCONCEPTIONS cho từng Assessment Unit (AU).

Định nghĩa Misconception:
- Là một sai lầm phổ biến nhưng có tính hợp lý (plausible), có thể dùng làm distractor trong MCQ.
- Gắn trực tiếp với nội dung AU (không lan man sang kiến thức khác).
- Có thể xuất phát từ: hiểu sai khái niệm, nhầm lẫn cơ chế, nhầm thuật ngữ, thiếu kiến thức nền, suy luận sai, thiên kiến nhận thức (availability, anchoring, representativeness...).
- Không được quá cực đoan hay vô lý.
- Không biến thành câu đúng hoặc gần đúng.

Bối cảnh:
- Chuyên ngành: ${specialty_name || "không rõ"}
- Bậc học (learner_level): ${learner_level || "không rõ"}
- Mức Bloom mục tiêu (tham chiếu): ${bloom_level || "không rõ"}

Danh sách AU đầu vào:
${ausBlock}

Misconceptions đã lưu trước đó (phải tránh lặp lại hoặc rất giống):
${existingBlock}

YÊU CẦU GENERATE (BƯỚC 1):
1) Với mỗi AU, tạo 3–6 Misconceptions mới, phù hợp với AU đó.
2) KHÔNG được lặp lại hoặc quá giống với các Misconceptions đã liệt kê ở phần "Misconceptions đã lưu trước đó".
3) Mỗi Misconception phải:
   - Ngắn gọn (1–2 câu),
   - Rõ ràng, súc tích,
   - Có thể dùng trực tiếp làm distractor trong MCQ (chỉ cần sửa nhẹ mặt ngữ pháp là dùng được).
4) Ghi thêm "error_type" cho mỗi Misconception, chọn một trong 5 loại:
   - conceptual
   - procedural
   - bias
   - clinical_reasoning
   - terminology

BẠN PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC sau (không thêm trường khác):

{
  "misconceptions": [
    {
      "au_id": "id của AU (giống với input aus[].id)",
      "au_text": "string",
      "items": [
        {
          "description": "string",
          "error_type": "conceptual|procedural|bias|clinical_reasoning|terminology"
        }
      ]
    }
  ]
}
`.trim();

    // ====== CALL 1: GPT GENERATE ======
    const genRes = await fetch(OPENAI_URL, {
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
            content: generatePrompt,
          },
        ],
      }),
    });

    const genData = await genRes.json().catch(() => null);

    if (!genRes.ok) {
      console.error("OpenAI error (generate) tại /api/miscon-gen:", genData);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT (generate) để sinh Misconceptions",
          detail: JSON.stringify(genData, null, 2),
        },
        { status: 500 }
      );
    }

    const genContent = genData?.choices?.[0]?.message?.content;
    if (!genContent || typeof genContent !== "string") {
      console.error(
        "Không có message.content hợp lệ ở bước generate /api/miscon-gen:",
        genData
      );
      return NextResponse.json(
        { error: "Không nhận được content hợp lệ từ GPT (generate)" },
        { status: 500 }
      );
    }

    let genParsed: any;
    try {
      genParsed = JSON.parse(genContent);
    } catch (e) {
      console.error(
        "JSON parse error (generate) ở /api/miscon-gen:",
        e,
        "raw content:",
        genContent
      );
      return NextResponse.json(
        { error: "GPT (generate) trả về JSON không hợp lệ", raw: genContent },
        { status: 500 }
      );
    }

    const genMis = Array.isArray(genParsed?.misconceptions)
      ? genParsed.misconceptions
      : null;

    if (!genMis || !Array.isArray(genMis) || genMis.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy misconceptions hợp lệ ở bước generate." },
        { status: 500 }
      );
    }

    // ====== PROMPT 2: CRITIC / REVIEW & FIX ======
    const genMisJson = JSON.stringify(genMis, null, 2);

    const criticPrompt = `
Bạn là chuyên gia thẩm định (reviewer) về giáo dục y khoa, chuyên về thiết kế distractor cho MCQ theo chuẩn NBME.

Dữ liệu đầu vào là một danh sách Misconceptions đã được sinh ra cho từng AU (JSON ở bên dưới).

Bối cảnh:
- Chuyên ngành: ${specialty_name || "không rõ"}
- Bậc học: ${learner_level || "không rõ"}
- Mức Bloom mục tiêu (tham chiếu): ${bloom_level || "không rõ"}

Nhiệm vụ (BƯỚC 2 – REVIEW & CHỈNH SỬA):
1) Đối với từng AU:
   - XÓA các Misconceptions:
     * Lạc đề, không liên quan trực tiếp đến AU_text.
     * Quá vô lý, không thể dùng làm distractor.
     * Biến thành phát biểu đúng hoặc gần đúng.
   - SỬA lại các Misconceptions:
     * Nếu ý tưởng đúng hướng nhưng wording chưa tốt, hãy chỉnh cho:
       - Rõ ràng, cụ thể,
       - Đủ "plausible" để dùng làm distractor,
       - Phản ánh một lỗi nhận thức/hiểu sai thật sự có thể xảy ra.
   - Giữ số lượng hợp lý: **ÍT NHẤT 2 và TỐI ĐA 5 misconceptions cho mỗi AU sau khi lọc**
     (nếu nhiều hơn 5 thì CHỌN 5 cái tốt nhất, sư phạm nhất).

2) Kiểm tra tính "đúng sư phạm":
   - Misconception phải phản ánh rõ "thinking error" (không phải chỉ là câu mơ hồ).
   - Ở mức độ khó phù hợp với bậc học đã cho (đừng quá advanced cho sinh viên năm đầu, đừng quá sơ đẳng cho nội trú).
   - Có thể dùng trực tiếp làm distractor trong MCQ về AU đó.

3) Kiểm tra phù hợp với Bloom:
   - Nếu Bloom mục tiêu là cao (apply/analyze/evaluate), Misconception nên phản ánh lỗi ở mức vận dụng/lập luận, không chỉ nhầm khái niệm đơn giản.
   - Nếu Bloom mục tiêu là thấp (remember/understand), Misconception có thể là nhầm lẫn định nghĩa/thuật ngữ/công thức.

4) Phải tránh lặp lại quá giống với Misconceptions đã lưu trước đó:
${existingBlock}

5) Kết quả cuối cùng phải TRẢ VỀ duy nhất JSON với cấu trúc Y HỆT như input, KHÔNG thêm trường mới:
{
  "misconceptions": [
    {
      "au_id": "string",
      "au_text": "string",
      "items": [
        {
          "description": "string",
          "error_type": "conceptual|procedural|bias|clinical_reasoning|terminology"
        }
      ]
    }
  ]
}

Không thêm comment, không thêm trường khác ngoài các trường đã định nghĩa.

Đây là JSON Misconceptions GỐC (cần review & chỉnh sửa):

${genMisJson}
`.trim();

    const criticRes = await fetch(OPENAI_URL, {
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
            content: criticPrompt,
          },
        ],
      }),
    });

    const criticData = await criticRes.json().catch(() => null);

    if (!criticRes.ok) {
      console.error("OpenAI error (critic) tại /api/miscon-gen:", criticData);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT (critic) để rà soát Misconceptions",
          detail: JSON.stringify(criticData, null, 2),
        },
        { status: 500 }
      );
    }

    const criticContent = criticData?.choices?.[0]?.message?.content;
    if (!criticContent || typeof criticContent !== "string") {
      console.error(
        "Không có message.content hợp lệ ở bước critic /api/miscon-gen:",
        criticData
      );
      return NextResponse.json(
        { error: "Không nhận được content hợp lệ từ GPT (critic)" },
        { status: 500 }
      );
    }

    let criticParsed: any;
    try {
      criticParsed = JSON.parse(criticContent);
    } catch (e) {
      console.error(
        "JSON parse error (critic) ở /api/miscon-gen:",
        e,
        "raw content:",
        criticContent
      );
      return NextResponse.json(
        { error: "GPT (critic) trả về JSON không hợp lệ", raw: criticContent },
        { status: 500 }
      );
    }

    const finalMis = Array.isArray(criticParsed?.misconceptions)
      ? criticParsed.misconceptions
      : null;

    if (!finalMis || !Array.isArray(finalMis) || finalMis.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy misconceptions hợp lệ ở bước critic." },
        { status: 500 }
      );
    }

    // ✅ Giới hạn TỐI ĐA 5 mis cho mỗi AU ở server
const trimmedMis = finalMis.map((group: any) => {
  const rawItems = Array.isArray(group.items) ? group.items : [];
  // lọc những item hợp lệ có description không rỗng
  const cleaned = rawItems
    .filter(
      (it: any) =>
        it &&
        typeof it.description === "string" &&
        it.description.trim().length > 0
    )
    .slice(0, 5); // 👈 TỐI ĐA 5

  return {
    ...group,
    items: cleaned,
  };
});

    // 🔚 Trả về đúng schema cũ, nhưng đã qua 2 bước: generate + pedagogy review
    return NextResponse.json(
      { misconceptions: trimmedMis },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Lỗi server /api/miscon-gen:", e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
