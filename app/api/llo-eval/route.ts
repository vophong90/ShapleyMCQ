// app/api/llo-eval/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LloEvalRequest = {
  specialty_name?: string;
  learner_level?: string;
  bloom_level?: string;
  llos_text?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as LloEvalRequest | null;

    if (!body) {
      return NextResponse.json(
        { error: "Body request trống" },
        { status: 400 }
      );
    }

    const { learner_level, bloom_level, llos_text, specialty_name } = body;

    if (!learner_level || !bloom_level || !llos_text || !llos_text.trim()) {
      return NextResponse.json(
        { error: "Thiếu learner_level, bloom_level hoặc llos_text" },
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

    // Bạn có thể override bằng OPENAI_LLO_MODEL, mặc định dùng gpt-5.1
    const model = (process.env.OPENAI_LLO_MODEL || "gpt-5.1").trim();

    // 🔥 PROMPT LỆNH ĐẦY ĐỦ
    const prompt = `
Bạn là chuyên gia giáo dục y khoa, am hiểu thang Bloom (revised) và các bậc đào tạo y khoa.

Nhiệm vụ của bạn:

1) Phân tích từng LLO (learning outcome) được cung cấp (mỗi dòng là một LLO).
2) Suy luận mức Bloom thực tế của từng LLO dựa trên:
   - Động từ chính (verb) trong câu.
   - Nội dung kiến thức / kỹ năng mà LLO hướng tới.
3) So sánh mức Bloom thực tế với mức Bloom mục tiêu do người dùng chọn.
4) Đánh giá độ phù hợp của LLO với bậc đào tạo:
   - undergrad  = sinh viên y khoa (đại học)
   - postgrad   = học viên sau đại học (BS nội trú, CK1, CK2…)
   - phd        = nghiên cứu sinh
5) Góp ý ngắn gọn, cụ thể cho từng LLO:
   - Nếu Bloom quá thấp hoặc quá cao so với mục tiêu → đề xuất cách chỉnh.
   - Nếu mức độ khó không phù hợp bậc học → gợi ý nâng/giảm độ phức tạp.

Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC như sau, không thêm trường khác:

{
  "overall_comment": "string",
  "items": [
    {
      "llo": "string",
      "inferred_bloom": "remember|understand|apply|analyze|evaluate|create",
      "bloom_match": "good|too_low|too_high",
      "level_fit": "good|too_easy|too_hard",
      "comments": "string"
    }
  ]
}

Giải thích:

- overall_comment: Nhận xét chung về bộ LLO (tối đa 4–5 câu, ngắn gọn, súc tích).
- items: Mỗi phần tử tương ứng 1 LLO (theo đúng thứ tự xuất hiện).
  - llo: nguyên văn LLO.
  - inferred_bloom: mức Bloom thực tế mà bạn suy luận (chỉ dùng các giá trị: remember, understand, apply, analyze, evaluate, create).
  - bloom_match:
      - "good"     = mức Bloom thực tế phù hợp với Bloom mục tiêu.
      - "too_low"  = Bloom thực tế thấp hơn Bloom mục tiêu (LLO quá đơn giản).
      - "too_high" = Bloom thực tế cao hơn Bloom mục tiêu (LLO quá phức tạp).
  - level_fit:
      - "good"      = phù hợp bậc học.
      - "too_easy"  = quá dễ so với bậc học.
      - "too_hard"  = quá khó so với bậc học.
  - comments: góp ý cụ thể cho LLO đó (1–3 câu, tập trung vào động từ và mức độ tư duy).

YÊU CẦU QUAN TRỌNG:
- Không được thêm bất kỳ trường nào khác ngoài các trường trong schema trên.
- Không được trả lời bằng tiếng Anh, dùng TIẾNG VIỆT học thuật, rõ ràng, súc tích.
- Không được bao LLO trong dấu gạch đầu dòng mới, hãy giữ nguyên như văn bản đầu vào.

Dữ liệu đầu vào:

- Chuyên ngành: ${specialty_name || "không rõ"}
- Bậc đào tạo (learner_level): ${learner_level}
- Mức Bloom mục tiêu (bloom_level): ${bloom_level}

Các LLO (mỗi dòng là một LLO):

${llos_text}
`.trim();

    // 🚀 Gọi Responses API – LƯU Ý: dùng text.format thay cho response_format
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: prompt,
        // Đây là cách mới: yêu cầu output ở dạng JSON text
        text: {
          format: "json"
        }
      })
    });

    const data = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok) {
      // Đẩy luôn body lỗi từ OpenAI ra client để debug dễ
      console.error("OpenAI error tại /api/llo-eval:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT",
          detail: JSON.stringify(data, null, 2)
        },
        { status: 500 }
      );
    }

    // Đọc đúng schema /v1/responses:
    // data.output[0].content[0].text
    let rawText = "";

    if (Array.isArray(data?.output) && data.output.length > 0) {
      const firstOutput = data.output[0];
      if (
        Array.isArray(firstOutput.content) &&
        firstOutput.content.length > 0 &&
        typeof firstOutput.content[0].text === "string"
      ) {
        rawText = firstOutput.content[0].text;
      }
    }

    if (!rawText) {
      console.error(
        "Không có text trong response từ /v1/responses:",
        JSON.stringify(data, null, 2)
      );
      return NextResponse.json(
        { error: "Không nhận được content từ GPT" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON parse error ở /api/llo-eval:", e, "raw:", rawText);
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ", raw: rawText },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (e: any) {
    console.error("Lỗi server /api/llo-eval:", e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
