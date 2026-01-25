// app/api/exams/irt-label-by-gpt/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JudgeMode = "strict" | "normal" | "lenient";
type Diff = "easy" | "medium" | "hard";

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Chuyển nhãn độ khó (easy/medium/hard) + kiểu giám khảo
 * sang tham số 3PL (a, b, c).
 *
 * - diff: easy → b âm, hard → b dương, medium → b ~ 0.
 * - judgeMode:
 *    + strict  → đề khó hơn (b + 0.3)
 *    + normal  → giữ nguyên
 *    + lenient → đề dễ hơn (b - 0.3)
 * - kChoice: số phương án lựa chọn (dùng để ước lượng c).
 */
function mapDiffTo3PL(diff: Diff, judgeMode: JudgeMode, kChoice: number) {
  // b cơ bản theo nhãn difficulty
  let b = diff === "easy" ? -1.0 : diff === "medium" ? 0.0 : 1.0;

  // chỉnh theo “giám khảo”:
  // strict  → khó hơn → b tăng
  // lenient → dễ hơn → b giảm
  b += judgeMode === "strict" ? 0.3 : judgeMode === "lenient" ? -0.3 : 0;

  const a = 1.0;
  // c ~ xác suất đoán mò = 1/kChoice, kẹp trong [0.05, 0.35]
  const c = clamp(1 / Math.max(2, kChoice), 0.05, 0.35);

  return { a, b, c };
}

/**
 * Helper gọi OpenAI ở JSON mode, ép phải trả JSON object.
 */
async function callOpenAIJsonObject(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Thiếu OPENAI_API_KEY trên server");
  }

  // Cho phép override model riêng cho IRT
  const model = (process.env.OPENAI_IRT_MODEL || "gpt-5.1").trim();

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
            "Bạn là giám khảo ra đề trắc nghiệm. CHỈ trả lời bằng JSON đúng schema yêu cầu.",
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
    console.error("OpenAI error tại /api/exams/irt-label-by-gpt:", data);
    throw new Error("Lỗi khi gọi GPT: " + JSON.stringify(data, null, 2));
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    console.error("Không có message.content hợp lệ:", data);
    throw new Error("Không nhận được content hợp lệ từ GPT");
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error(
      "JSON parse error ở /api/exams/irt-label-by-gpt:",
      e,
      "raw:",
      content
    );
    throw new Error("GPT trả về JSON không hợp lệ");
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteClient();

    // 1) Auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json(
        { error: "Bạn cần đăng nhập." },
        { status: 401 }
      );
    }

    // 2) Body
    const body = await req.json().catch(() => ({}));
    const exam_id = body?.exam_id as string;
    const judge_mode_raw = (body?.judge_mode as string) || "normal";
    const judge_mode =
      ["strict", "normal", "lenient"].includes(judge_mode_raw) ?
        (judge_mode_raw as JudgeMode) :
        "normal";
    const k_choice = Number(body?.k_choice ?? 4);

    if (!exam_id) {
      return NextResponse.json(
        { error: "exam_id là bắt buộc" },
        { status: 400 }
      );
    }

    // 3) Load exam (RLS sẽ chặn nếu không có quyền)
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .select("id, title")
      .eq("id", exam_id)
      .single();

    if (examErr || !exam) {
      return NextResponse.json(
        { error: "Không tìm thấy đề thi hoặc bạn không có quyền." },
        { status: 404 }
      );
    }

    // 4) Load items + join mcq_items (không dùng options_json vì schema mới không có)
    const { data: rows, error: itemsErr } = await supabase
      .from("exam_mcq_items")
      .select(
        `
        item_order,
        mcq_item_id,
        mcq_items (
          id,
          stem,
          bloom_level,
          learner_level,
          target_bloom
        )
      `
      )
      .eq("exam_id", exam_id)
      .order("item_order", { ascending: true });

    if (itemsErr) throw itemsErr;
    if (!rows?.length) {
      return NextResponse.json(
        { error: "Đề thi chưa có câu nào." },
        { status: 400 }
      );
    }

    const items = (rows || []).map((r: any) => ({
      item_order: r.item_order as number,
      mcq_item_id: r.mcq_item_id as string,
      stem: (r.mcq_items?.stem ?? "") as string,
      bloom_level: (r.mcq_items?.bloom_level ?? null) as string | null,
      learner_level: (r.mcq_items?.learner_level ?? null) as string | null,
      target_bloom: (r.mcq_items?.target_bloom ?? null) as string | null,
    }));

    // 5) Chuẩn bị pack cho GPT
    const pack = items.map((it) => ({
      item_order: it.item_order,
      stem: it.stem,
      bloom_level: it.bloom_level,
      learner_level: it.learner_level,
      target_bloom: it.target_bloom,
    }));

    const prompt = `
Bạn là giám khảo ra đề trắc nghiệm.

Nhiệm vụ:
- Đánh giá ĐỘ KHÓ từng câu hỏi trong một đề thi.
- Độ khó chỉ có 3 mức: "easy", "medium", "hard".

Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC sau (không thêm trường khác):

{
  "items": [
    { "item_order": number, "difficulty": "easy"|"medium"|"hard", "reason": "string" }
  ]
}

Quy tắc:
- "item_order" khớp đúng thứ tự trong dữ liệu đầu vào.
- "difficulty":
    + "easy": kiến thức cơ bản, trực tiếp, ít bẫy.
    + "medium": mức độ trung bình, có chút suy luận.
    + "hard": phức tạp, cần tích hợp nhiều bước hoặc bẫy.
- "reason" là 1–2 câu, giải thích ngắn gọn vì sao bạn gán độ khó như vậy.

Dữ liệu đề thi:
${JSON.stringify(
  {
    exam_title: exam.title,
    items: pack,
  },
  null,
  2
)}
`.trim();

    // 6) Gọi GPT (JSON mode)
    const parsed = await callOpenAIJsonObject(prompt);
    const arr: any[] = Array.isArray(parsed?.items) ? parsed.items : [];

    if (!arr.length) {
      return NextResponse.json(
        {
          error: "GPT không trả về items[] đúng format.",
          raw: parsed,
        },
        { status: 500 }
      );
    }

    // 7) Map kết quả GPT theo item_order
    const byOrder = new Map<
      number,
      { difficulty: Diff; reason: string | null }
    >();

    for (const x of arr) {
      const ord = Number(x?.item_order);
      const diff = x?.difficulty as Diff;
      const reason = typeof x?.reason === "string" ? x.reason : null;

      if (!Number.isFinite(ord)) continue;
      if (!["easy", "medium", "hard"].includes(diff)) continue;

      byOrder.set(ord, { difficulty: diff, reason });
    }

    // 8) Tính tham số 3PL + upsert vào exam_item_irt_params
    const upserts = items.map((it) => {
      const got = byOrder.get(it.item_order);
      const diff: Diff = got?.difficulty || "medium";
      const reason = got?.reason || null;
      const { a, b, c } = mapDiffTo3PL(diff, judge_mode, k_choice);

      return {
        exam_id,
        mcq_item_id: it.mcq_item_id,
        difficulty_label: diff,
        difficulty_reason: reason,
        irt_a: a,
        irt_b: b,
        irt_c: c,
      };
    });

    const { error: upErr } = await supabase
      .from("exam_item_irt_params")
      .upsert(upserts, { onConflict: "exam_id,mcq_item_id" });

    if (upErr) throw upErr;

    return NextResponse.json(
      {
        success: true,
        exam_id,
        judge_mode,
        k_choice,
        saved: upserts.length,
        preview: upserts.slice(0, 5),
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Lỗi server /api/exams/irt-label-by-gpt:", e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
