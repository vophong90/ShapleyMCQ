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

    // Có thể override bằng OPENAI_LLO_MODEL, mặc định dùng gpt-5.1
    const model = (process.env.OPENAI_LLO_MODEL || "gpt-5.1").trim();

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

Dữ liệu đầu vào:

- Chuyên ngành: ${specialty_name || "không rõ"}
- Bậc đào tạo (learner_level): ${learner_level}
- Mức Bloom mục tiêu (bloom_level): ${bloom_level}

Các LLO (mỗi dòng là một LLO):

${llos_text}
`.trim();

    // 🚀 Gọi CHAT COMPLETIONS API – JSON mode
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý giáo dục y khoa, CHỈ trả lời bằng JSON đúng schema yêu cầu."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await openaiRes.json().catch(() => null);

    if (!openaiRes.ok) {
      console.error("OpenAI error tại /api/llo-eval:", data);
      return NextResponse.json(
        {
          error: "Lỗi khi gọi GPT",
          detail: JSON.stringify(data, null, 2)
        },
        { status: 500 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("Không có message.content hợp lệ:", data);
      return NextResponse.json(
        { error: "Không nhận được content hợp lệ từ GPT" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error ở /api/llo-eval:", e, "raw:", content);
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ", raw: content },
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
