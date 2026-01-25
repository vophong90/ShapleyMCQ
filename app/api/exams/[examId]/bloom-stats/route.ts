// app/api/exams/[examId]/bloom-stats/route.ts
import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BloomStat = {
  bloom: string;
  count: number;
  percent: number;
};

function normalizeBloom(v: any) {
  const s = String(v ?? "").trim();
  return s || "";
}

export async function GET(request: Request, context: any) {
  try {
    const examId: string | undefined = context?.params?.examId;
    if (!examId) {
      return NextResponse.json(
        { success: false, error: "Thiếu examId" },
        { status: 400 }
      );
    }

    const supabase = await getRouteClient();

    // check login (dựa cookie)
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      return NextResponse.json(
        { success: false, error: authErr.message },
        { status: 401 }
      );
    }
    if (!authData?.user) {
      return NextResponse.json(
        { success: false, error: "Chưa đăng nhập" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("exam_mcq_items")
      .select(
        `
        id,
        exam_id,
        mcq_item_id,
        item_order,
        mcq_items (
          id,
          bloom_level,
          target_bloom
        )
      `
      )
      .eq("exam_id", examId)
      .order("item_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []) as any[];

    const counts: Record<string, number> = {};
    let total = 0;
    let missingBloom = 0;
    let usedTargetBloomFallback = 0;

    for (const r of rows) {
      total++;

      const bloomLevel = normalizeBloom(r?.mcq_items?.bloom_level);
      const targetBloom = normalizeBloom(r?.mcq_items?.target_bloom);
      const bloom = bloomLevel || targetBloom;

      if (!bloom) {
        missingBloom++;
        counts["Unknown"] = (counts["Unknown"] || 0) + 1;
        continue;
      }

      if (!bloomLevel && targetBloom) usedTargetBloomFallback++;
      counts[bloom] = (counts[bloom] || 0) + 1;
    }

    const bloom_stats: BloomStat[] = Object.entries(counts)
      .map(([bloom, count]) => ({
        bloom,
        count,
        percent: total ? (count * 100) / total : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const warnings: string[] = [];
    if (total === 0) warnings.push("Đề này chưa có câu hỏi để thống kê Bloom.");
    if (missingBloom > 0) {
      warnings.push(
        `${missingBloom}/${total} câu chưa có bloom_level/target_bloom → tính vào 'Unknown'.`
      );
    }
    if (usedTargetBloomFallback > 0) {
      warnings.push(
        `${usedTargetBloomFallback}/${total} câu không có bloom_level, đã fallback sang target_bloom.`
      );
    }

    return NextResponse.json({
      success: true,
      exam_id: examId,
      total_questions: total,
      bloom_stats,
      warnings,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
