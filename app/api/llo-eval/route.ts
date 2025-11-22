import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LloEvalRequest = {
  specialty_name?: string;
  learner_level: string; // 'undergrad' | 'postgrad' | 'phd'
  bloom_level: string;   // 'remember' | 'understand' | ...
  llos_text: string;     // mỗi dòng 1 LLO
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LloEvalRequest;

    if (!body.learner_level || !body.bloom_level || !body.llos_text?.trim()) {
      return NextResponse.json(
        { error: "Thiếu learner_level, bloom_level hoặc llos_text" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trên server" },
        { status: 500 }
      );
    }

    const { learner_level, bloom_level, llos_text, specialty_name } = body;

    const systemPrompt = `
Bạn là chuyên gia giáo dục y khoa, am hiểu thang Bloom (revised) và các bậc đào tạo y khoa (sinh viên, sau đại học, nghiên cứu sinh).

Nhiệm vụ:
- Phân tích từng LLO (learning outcome) được cung cấp.
- Suy luận mức Bloom thực tế của LLO đó, dựa trên động từ và nội dung.
- Đánh giá:
  + Mức Bloom thực tế so với mức Bloom mục tiêu mà người dùng chọn.
  + Độ phù hợp của LLO với bậc đào tạo:
      - undergrad = sinh viên Y khoa
      - postgrad = học viên chuyên khoa/thạc sĩ
      - phd = nghiên cứu sinh, thiên về nghiên cứu.

Trả lời **CHỈ** ở dạng JSON hợp lệ theo cấu trúc:

{
  "overall_comment": "nhận xét chung (tiếng Việt, ngắn gọn)",
  "items": [
    {
      "llo": "chuỗi LLO nguyên văn",
      "inferred_bloom": "remember|understand|apply|analyze|evaluate|create",
      "bloom_match": "good|too_low|too_high",
      "level_fit": "good|too_easy|too_hard",
      "comments": "nhận xét ngắn gọn (tiếng Việt) về LLO này, max ~3 câu"
    }
  ]
}

Không được thêm trường khác ngoài các trường đã liệt kê.
Nếu có dòng trống trong LLO thì bỏ qua.
    `.trim();

    const userContent = `
Chuyên ngành: ${specialty_name || "không rõ (có thể dùng bối cảnh y khoa chung)"}.
Bậc đào tạo (learner_level): ${learner_level}.
Mức Bloom mục tiêu (bloom_level): ${bloom_level}.

Danh sách LLO (mỗi dòng 1 LLO):
${llos_text}
`.trim();

    // Gọi OpenAI Chat Completions (model có thể chỉnh sau)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", errorText);
      return NextResponse.json(
        { error: "Lỗi khi gọi GPT", detail: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Không nhận được content từ GPT" },
        { status: 500 }
      );
    }

    // content là chuỗi JSON → parse
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error:", e, "raw:", content);
      return NextResponse.json(
        { error: "GPT trả về JSON không hợp lệ", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Lỗi không xác định", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
