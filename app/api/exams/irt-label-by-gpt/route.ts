import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JudgeMode = "strict" | "normal" | "lenient";
type Diff = "easy" | "medium" | "hard";

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function mapDiffTo3PL(diff: Diff, judgeMode: JudgeMode, kChoice: number) {
  let b = diff === "easy" ? -1.0 : diff === "medium" ? 0.0 : 1.0;
  b += judgeMode === "strict" ? 0.3 : judgeMode === "lenient" ? -0.3 : 0;

  const a = 1.0;
  const c = clamp(1 / Math.max(2, kChoice), 0.05, 0.35);

  return { a, b, c };
}

async function callOpenAIJsonObject(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Thiếu OPENAI_API_KEY trên server");
  }

  // Cho phép override model riêng cho IRT labeling
  const model = (process.env.OPENAI_IRT_MODEL || "gpt-5.1").trim();

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      // ✅ JSON mode giống /api/llo-eval
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Bạn là giám khảo ra đề. CHỈ trả lời bằng JSON đúng schema yêu cầu.",
        },
        { role: "user", content: prompt },
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
    console.error("JSON parse error ở /api/exams/irt-label-by-gpt:", e, "raw:", content);
    throw new Error("GPT trả về JSON không hợp lệ");
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteClient();

    // 1) auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const exam_id = body?.exam_id as string;
    const judge_mode = (body?.judge_mode as JudgeMode) || "normal";
    const k_choice = Number(body?.k_choice ?? 4);

    if (!exam_id) {
      return NextResponse.json({ error: "exam_id là bắt buộc" }, { status: 400 });
    }
    if (!["strict", "normal", "lenient"].includes(judge_mode)) {
      return NextResponse.json({ error: "judge_mode không hợp lệ" }, { status: 400 });
    }

    // 2) load exam (RLS chặn nếu không phải owner)
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

    // 3) load items + stem/options
    const { data: rows, error: itemsErr } = await supabase
      .from("exam_mcq_items")
      .select(
        `
        item_order,
        mcq_item_id,
        mcq_items (
          id,
          stem,
          options_json
        )
      `
      )
      .eq("exam_id", exam_id)
      .order("item_order", { ascending: true });

    if (itemsErr) throw itemsErr;
    if (!rows?.length) {
      return NextResponse.json({ error: "Đề thi chưa có câu nào." }, { status: 400 });
    }

    const items = rows.map((r: any) => ({
      item_order: r.item_order as number,
      mcq_item_id: r.mcq_item_id as string,
      stem: (r.mcq_items?.stem ?? "") as string,
      options: (r.mcq_items?.options_json ?? []) as any[],
    }));

    // 4) prompt + schema output (json_object)
    // json_object phải có 1 object root -> ta yêu cầu: { "items": [ ... ] }
    const pack = items.map((it) => ({
      item_order: it.item_order,
      stem: it.stem,
      options: it.options,
    }));

    const prompt = `
Bạn là giám khảo ra đề trắc nghiệm.

Hãy đánh giá ĐỘ KHÓ từng câu hỏi theo 3 mức: easy | medium | hard.

Bạn PHẢI trả lời CHỈ bằng JSON với cấu trúc CHÍNH XÁC như sau, không thêm trường khác:

{
  "items": [
    { "item_order": number, "difficulty": "easy"|"medium"|"hard", "reason": "string" }
  ]
}

Quy tắc:
- reason ngắn gọn 1–2 câu.
- Mỗi item_order xuất hiện đúng 1 lần.

Bộ câu hỏi:
${JSON.stringify(pack)}
`.trim();

    const parsed = await callOpenAIJsonObject(prompt);
    const arr: any[] = Array.isArray(parsed?.items) ? parsed.items : [];

    if (!arr.length) {
      return NextResponse.json(
        { error: "GPT không trả về items[] đúng format.", raw: parsed },
        { status: 500 }
      );
    }

    // 5) map theo item_order
    const byOrder = new Map<number, { difficulty: Diff; reason: string | null }>();
    for (const x of arr) {
      const ord = Number(x?.item_order);
      const diff = x?.difficulty as Diff;
      const reason = typeof x?.reason === "string" ? x.reason : null;

      if (!Number.isFinite(ord)) continue;
      if (!["easy", "medium", "hard"].includes(diff)) continue;

      byOrder.set(ord, { difficulty: diff, reason });
    }

    // 6) upsert rows (fallback medium nếu thiếu)
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
