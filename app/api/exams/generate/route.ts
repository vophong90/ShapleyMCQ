// app/api/exams/generate/route.ts
// ========================================================
// Generate Exam Version from Blueprint
// - version_no tăng dần theo blueprint
// - snapshot đầy đủ (Cách A): config + seed + metadata
// - RNG theo seed để tái lập
// - Không trùng MCQ trong cùng 1 exam
// - Cho phép trùng giữa các version
// ========================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

/* ---------------- TYPES ---------------- */

type LloDist = {
  llo_id: string;
  code?: string | null;
  weight_percent: number;
};

type BlueprintConfig = {
  course_id?: string | null;
  total_questions?: number;
  include_sources?: {
    own_mcq?: boolean;
    shared_mcq?: boolean;
  };
  status_filter?: string[];
  llo_distribution?: LloDist[];
};

type GenerateBody = {
  blueprint_id?: string;
};

type BloomStat = {
  bloom: string;
  count: number;
  percent: number;
};

/* ---------------- SEEDED RNG ---------------- */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArraySeeded<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ---------------- MAIN HANDLER ---------------- */

export async function POST(req: NextRequest) {
  // ✅ admin dùng cho DB
  const supabase = getSupabaseAdmin();

  try {
    /* --------------------------------------------------
       1. Auth: lấy user từ cookie/session của request
    -------------------------------------------------- */
    const authClient = getRouteClient(req);
    const {
      data: { user },
      error: authErr,
    } = await authClient.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Chưa đăng nhập hoặc token không hợp lệ" },
        { status: 401 }
      );
    }

    const userId = user.id;

    /* --------------------------------------------------
       2. Parse body
    -------------------------------------------------- */
    const body = (await req.json().catch(() => ({}))) as GenerateBody;
    const blueprintId = body.blueprint_id;

    if (!blueprintId) {
      return NextResponse.json(
        { error: "blueprint_id là bắt buộc" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       3. Load blueprint + check ownership
    -------------------------------------------------- */
    const { data: bp, error: bpErr } = await supabase
      .from("exam_blueprints")
      .select("id, owner_id, title, config")
      .eq("id", blueprintId)
      .single();

    if (bpErr || !bp) {
      return NextResponse.json(
        { error: "Không tìm thấy blueprint" },
        { status: 404 }
      );
    }

    if (bp.owner_id !== userId) {
      return NextResponse.json(
        { error: "Bạn không có quyền dùng blueprint này" },
        { status: 403 }
      );
    }

    const cfg = (bp.config || {}) as BlueprintConfig;

    const courseId = cfg.course_id || null;
    const totalQuestions = cfg.total_questions || 0;

    if (!courseId) {
      return NextResponse.json(
        { error: "Blueprint chưa cấu hình course_id" },
        { status: 400 }
      );
    }

    if (!totalQuestions || totalQuestions <= 0) {
      return NextResponse.json(
        { error: "total_questions không hợp lệ" },
        { status: 400 }
      );
    }

    const lloDist = cfg.llo_distribution || [];
    if (!lloDist.length) {
      return NextResponse.json(
        { error: "Blueprint chưa cấu hình llo_distribution" },
        { status: 400 }
      );
    }

    const includeOwn = cfg.include_sources?.own_mcq ?? true;
    const includeShared = cfg.include_sources?.shared_mcq ?? true;

    if (!includeOwn && !includeShared) {
      return NextResponse.json(
        { error: "Phải chọn ít nhất một nguồn MCQ (own hoặc shared)" },
        { status: 400 }
      );
    }

    const statusFilter =
      cfg.status_filter && cfg.status_filter.length
        ? cfg.status_filter
        : ["approved"];

    /* --------------------------------------------------
       4. Lấy version_no tiếp theo (transaction-safe)
    -------------------------------------------------- */
    const { data: lastVersionRow, error: vErr } = await supabase
      .from("exams")
      .select("version_no")
      .eq("blueprint_id", blueprintId)
      .order("version_no", { ascending: false })
      .limit(1)
      .single();

    if (vErr && vErr.code !== "PGRST116") {
      // PGRST116 thường là "No rows" khi .single() mà không có record
      throw vErr;
    }

    const nextVersionNo = (lastVersionRow?.version_no || 0) + 1;

    /* --------------------------------------------------
       5. Seed + RNG
    -------------------------------------------------- */
    const seed = Math.floor(Math.random() * 1e9);
    const rng = mulberry32(seed);

    /* --------------------------------------------------
       6. Chuẩn hóa phân bố LLO
    -------------------------------------------------- */
    const totalWeight = lloDist.reduce(
      (sum, l) => sum + (l.weight_percent || 0),
      0
    );

    if (!totalWeight) {
      return NextResponse.json(
        { error: "Tổng weight_percent của LLO = 0" },
        { status: 400 }
      );
    }

    const normLloDist = lloDist.map((l) => ({
      ...l,
      weight_norm: (l.weight_percent || 0) / totalWeight,
    }));

    const targetLloSet = new Set(normLloDist.map((l) => l.llo_id));

    /* --------------------------------------------------
       7. Build pool MCQ theo LLO
    -------------------------------------------------- */
    const poolMap = new Map<string, string[]>();

    const addToPool = (mcqId: string, lloIds: string[] | null) => {
      if (!lloIds) return;
      for (const lloId of lloIds) {
        if (!targetLloSet.has(lloId)) continue;
        const list = poolMap.get(lloId) || [];
        if (!list.includes(mcqId)) {
          list.push(mcqId);
          poolMap.set(lloId, list);
        }
      }
    };

    // 7.1 Own MCQ
    if (includeOwn) {
      const { data: ownMcq, error: ownErr } = await supabase
        .from("mcq_items")
        .select("id, llo_ids")
        .eq("owner_id", userId)
        .eq("course_id", courseId)
        .in("status", statusFilter);

      if (ownErr) throw ownErr;
      (ownMcq || []).forEach((row: any) =>
        addToPool(row.id, row.llo_ids || null)
      );
    }

    // 7.2 Shared MCQ
    if (includeShared) {
      const { data: shared, error: sharedErr } = await supabase
        .from("mcq_item_shares")
        .select("mcq_items (id, llo_ids)")
        .eq("to_user_id", userId)
        .eq("mcq_items.course_id", courseId)
        .in("mcq_items.status", statusFilter);

      if (sharedErr) throw sharedErr;
      (shared || []).forEach((row: any) => {
        const mcq = (row as any).mcq_items;
        if (!mcq) return;
        addToPool(mcq.id, mcq.llo_ids || null);
      });
    }

    /* --------------------------------------------------
       8. Tính số câu cho từng LLO
    -------------------------------------------------- */
    const countsByLlo: Record<string, number> = {};
    let assignedTotal = 0;

    normLloDist.forEach((l, idx) => {
      const isLast = idx === normLloDist.length - 1;
      if (isLast) {
        countsByLlo[l.llo_id] = totalQuestions - assignedTotal;
      } else {
        const n = Math.floor(totalQuestions * l.weight_norm);
        countsByLlo[l.llo_id] = n;
        assignedTotal += n;
      }
    });

    /* --------------------------------------------------
       9. Chọn MCQ (không trùng trong 1 exam)
    -------------------------------------------------- */
    type ExamItem = { mcq_item_id: string; llo_id: string | null };

    const usedMcq = new Set<string>();
    const chosenItems: ExamItem[] = [];
    const warnings: string[] = [];

    for (const l of normLloDist) {
      const lloId = l.llo_id;
      const needed = countsByLlo[lloId] || 0;
      if (!needed) continue;

      const available = shuffleArraySeeded(poolMap.get(lloId) || [], rng);

      let picked = 0;
      for (const mcqId of available) {
        if (picked >= needed) break;
        if (usedMcq.has(mcqId)) continue;

        usedMcq.add(mcqId);
        chosenItems.push({ mcq_item_id: mcqId, llo_id: lloId });
        picked++;
      }

      if (picked < needed) {
        warnings.push(
          `LLO ${l.code || lloId} cần ${needed} câu nhưng chỉ lấy được ${picked}`
        );
      }
    }

    if (!chosenItems.length) {
      return NextResponse.json(
        { error: "Không chọn được MCQ nào phù hợp với cấu hình" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       10. Snapshot đầy đủ (Cách A)
    -------------------------------------------------- */
    const generatedAt = new Date().toISOString();
    const snapshot = {
      blueprint_config: cfg,
      seed,
      generator_version: "v1.0.0",
      generated_at: generatedAt,
      warnings,
    };

    const examTitle = `${bp.title} – Version ${nextVersionNo}`;

    /* --------------------------------------------------
       11. Insert exam
    -------------------------------------------------- */
    const { data: examRow, error: examErr } = await supabase
      .from("exams")
      .insert({
        blueprint_id: blueprintId,
        owner_id: userId,
        title: examTitle,
        course_id: courseId,
        version_no: nextVersionNo,
        config_snapshot: snapshot,
      })
      .select("id")
      .single();

    if (examErr || !examRow) {
      throw examErr || new Error("Không tạo được exam");
    }

    const examId = examRow.id as string;

    /* --------------------------------------------------
       12. Insert exam_mcq_items
    -------------------------------------------------- */
    const payload = chosenItems.map((item, idx) => ({
      exam_id: examId,
      mcq_item_id: item.mcq_item_id,
      llo_id: item.llo_id,
      item_order: idx + 1,
    }));

    const { error: itemsErr } = await supabase.from("exam_mcq_items").insert(payload);
    if (itemsErr) throw itemsErr;

    /* --------------------------------------------------
       13. Tính Bloom stats (dựa vào LLO)
    -------------------------------------------------- */
    const uniqueLloIds = Array.from(
      new Set(chosenItems.map((i) => i.llo_id).filter(Boolean))
    ) as string[];

    const { data: lloRows, error: lloErr } = await supabase
      .from("llos")
      .select("id, code, bloom_suggested")
      .in("id", uniqueLloIds);

    if (lloErr) throw lloErr;

    const lloMap = new Map<
      string,
      { bloom_suggested: string | null; code: string | null }
    >();

    (lloRows || []).forEach((l: any) =>
      lloMap.set(l.id, {
        bloom_suggested: l.bloom_suggested,
        code: l.code,
      })
    );

    const bloomCounts: Record<string, number> = {};
    chosenItems.forEach((item) => {
      const llo = item.llo_id ? lloMap.get(item.llo_id) : null;
      const bloom =
        llo?.bloom_suggested?.trim() ||
        (llo?.code ? `Unknown (${llo.code})` : "Unknown");
      bloomCounts[bloom] = (bloomCounts[bloom] || 0) + 1;
    });

    const totalChosen = chosenItems.length;

    const bloomStats: BloomStat[] = Object.entries(bloomCounts).map(
      ([bloom, count]) => ({
        bloom,
        count,
        percent: (count / totalChosen) * 100,
      })
    );

    /* --------------------------------------------------
       14. Response
    -------------------------------------------------- */
    return NextResponse.json(
      {
        exam_id: examId,
        version_no: nextVersionNo,
        title: examTitle,
        total_questions: totalChosen,
        warnings,
        bloom_stats: bloomStats,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Error in /api/exams/generate:", e);
    return NextResponse.json(
      { error: e?.message || "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
