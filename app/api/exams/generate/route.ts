// app/api/exams/generate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Thiếu Authorization header" },
        { status: 401 }
      );
    }

    const userId = authHeader.replace("Bearer ", "").trim();
    if (!userId) {
      return NextResponse.json(
        { error: "Authorization header không hợp lệ" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as GenerateBody;
    const blueprintId = body.blueprint_id;

    if (!blueprintId) {
      return NextResponse.json(
        { error: "blueprint_id là bắt buộc" },
        { status: 400 }
      );
    }

    // 1. Load blueprint
    const { data: bp, error: bpErr } = await supabase
      .from("exam_blueprints")
      .select("id, owner_id, title, config")
      .eq("id", blueprintId)
      .single();

    if (bpErr || !bp) {
      console.error("Error loading blueprint:", bpErr);
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
        { error: "Blueprint chưa cấu hình course_id trong config" },
        { status: 400 }
      );
    }

    if (!totalQuestions || totalQuestions <= 0) {
      return NextResponse.json(
        { error: "total_questions trong config không hợp lệ" },
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
    const statusFilter =
      cfg.status_filter && cfg.status_filter.length
        ? cfg.status_filter
        : ["approved"];

    // 2. Chuẩn hóa phân bố LLO
    const totalWeight = lloDist.reduce(
      (sum, l) => sum + (l.weight_percent || 0),
      0
    );
    if (!totalWeight) {
      return NextResponse.json(
        { error: "Tổng weight_percent trong llo_distribution = 0" },
        { status: 400 }
      );
    }

    const normLloDist = lloDist.map((l) => ({
      ...l,
      weight_norm: (l.weight_percent || 0) / totalWeight,
    }));

    const targetLloIds = normLloDist.map((l) => l.llo_id);
    const targetLloSet = new Set(targetLloIds);

    // 3. Xây pool MCQ: llo_id -> danh sách mcq_item_id
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

    // 3.1 MCQ của chính user
    if (includeOwn) {
      const { data: ownMcq, error: ownErr } = await supabase
        .from("mcq_items")
        .select("id, course_id, status, llo_ids")
        .eq("owner_id", userId)
        .eq("course_id", courseId)
        .in("status", statusFilter);

      if (ownErr) {
        console.error("Error loading own mcq_items:", ownErr);
        return NextResponse.json(
          { error: "Không tải được MCQ của bạn" },
          { status: 500 }
        );
      }

      (ownMcq || []).forEach((row: any) => {
        addToPool(row.id, row.llo_ids || null);
      });
    }

    // 3.2 MCQ được share cho user
    if (includeShared) {
      const { data: shared, error: sharedErr } = await supabase
        .from("mcq_item_shares")
        .select(
          "mcq_items (id, course_id, status, llo_ids)"
        )
        .eq("to_user_id", userId)
        .eq("mcq_items.course_id", courseId)
        .in("mcq_items.status", statusFilter);

      if (sharedErr) {
        console.error("Error loading shared mcq_items:", sharedErr);
        return NextResponse.json(
          { error: "Không tải được MCQ được share" },
          { status: 500 }
        );
      }

      (shared || []).forEach((row: any) => {
        const mcq = row.mcq_items;
        if (!mcq) return;
        addToPool(mcq.id, mcq.llo_ids || null);
      });
    }

    // 4. Tính số câu cần cho từng LLO
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

    // 5. Chọn câu hỏi (tránh trùng MCQ giữa các LLO)
    type ExamItem = { mcq_item_id: string; llo_id: string | null };

    const usedMcq = new Set<string>();
    const chosenItems: ExamItem[] = [];
    const shortageWarnings: string[] = [];

    for (const l of normLloDist) {
      const lloId = l.llo_id;
      const needed = countsByLlo[lloId] ?? 0;
      if (!needed) continue;

      const available = shuffleArray(poolMap.get(lloId) || []);
      let picked = 0;

      for (const mcqId of available) {
        if (picked >= needed) break;
        if (usedMcq.has(mcqId)) continue;

        usedMcq.add(mcqId);
        chosenItems.push({ mcq_item_id: mcqId, llo_id: lloId });
        picked++;
      }

      if (picked < needed) {
        shortageWarnings.push(
          `LLO ${l.code || lloId} cần ${needed} câu nhưng chỉ lấy được ${picked}`
        );
      }
    }

    if (!chosenItems.length) {
      return NextResponse.json(
        { error: "Không chọn được câu hỏi nào từ pool MCQ" },
        { status: 400 }
      );
    }

    // 6. Insert exams
    const now = new Date();
    const examTitle = `${bp.title} – đề ngày ${now.toLocaleDateString("vi-VN")}`;

    const { data: examRow, error: examErr } = await supabase
      .from("exams")
      .insert({
        blueprint_id: blueprintId,
        owner_id: userId,
        title: examTitle,
        course_id: courseId,
        config_snapshot: cfg,
      })
      .select("id")
      .single();

    if (examErr || !examRow) {
      console.error("Error inserting exam:", examErr);
      return NextResponse.json(
        { error: "Không tạo được record exams" },
        { status: 500 }
      );
    }

    const examId = examRow.id as string;

    // 7. Insert exam_mcq_items
    const examItemsPayload = chosenItems.map((item, index) => ({
      exam_id: examId,
      mcq_item_id: item.mcq_item_id,
      llo_id: item.llo_id,
      item_order: index + 1,
    }));

    const { error: itemsErr } = await supabase
      .from("exam_mcq_items")
      .insert(examItemsPayload);

    if (itemsErr) {
      console.error("Error inserting exam_mcq_items:", itemsErr);
      return NextResponse.json(
        { error: "Không lưu được danh sách MCQ trong đề" },
        { status: 500 }
      );
    }

    // 8. Tính Bloom stats
    const uniqueLloIds = Array.from(
      new Set(
        chosenItems.map((i) => i.llo_id).filter(Boolean)
      ) as Set<string>
    );

    const { data: lloRows, error: lloErr } = await supabase
      .from("llos")
      .select("id, code, bloom_suggested")
      .in("id", uniqueLloIds);

    if (lloErr) {
      console.error("Error loading LLOs:", lloErr);
      return NextResponse.json(
        { error: "Không tải được thông tin LLO để tính Bloom" },
        { status: 500 }
      );
    }

    const lloMap = new Map<string, { id: string; code: string | null; bloom_suggested: string | null }>();
    (lloRows || []).forEach((l: any) =>
      lloMap.set(l.id, {
        id: l.id,
        code: l.code,
        bloom_suggested: l.bloom_suggested,
      })
    );

    const bloomCounts: Record<string, number> = {};
    const totalChosen = chosenItems.length;

    chosenItems.forEach((item) => {
      const llo = item.llo_id ? lloMap.get(item.llo_id) : null;
      const bloom =
        llo?.bloom_suggested?.trim() ||
        (llo?.code ? `Unknown (${llo.code})` : "Unknown");
      bloomCounts[bloom] = (bloomCounts[bloom] ?? 0) + 1;
    });

    const bloomStats: BloomStat[] = Object.entries(bloomCounts).map(
      ([bloom, count]) => ({
        bloom,
        count,
        percent: (count / totalChosen) * 100,
      })
    );

    return NextResponse.json(
      {
        exam_id: examId,
        title: examTitle,
        total_questions: totalChosen,
        warnings: shortageWarnings,
        bloom_stats: bloomStats,
        items: chosenItems, // nếu muốn có chi tiết
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Unexpected error in /api/exams/generate:", e);
    return NextResponse.json(
      { error: e.message ?? "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
