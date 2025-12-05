// app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authHeader.replace("Bearer ", "").trim();
    if (!userId) {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    // --- COUNT KPIs ---
    const [
      { count: courseCount },
      { count: lessonCount },
      { count: lloCount },
      { count: auCount },
      { count: misCount },
      { count: mcqCount },
    ] = await Promise.all([
      supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId),
      supabase
        .from("lessons")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId),
      supabase
        .from("llos")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId),
      supabase
        .from("assessment_units")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId),
      supabase
        .from("misconceptions")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId),
      supabase
        .from("mcq_items")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", userId),
    ]);

    // =====================================================
    // 1) SPARKLINE — MCQ created last 7 days (auto-fill 0)
    // =====================================================
    const today = new Date();
    const past7 = new Date(Date.now() - 6 * 86400000);

    const { data: mcqLast7 } = await supabase
      .from("mcq_items")
      .select("id, created_at")
      .eq("owner_id", userId)
      .gte("created_at", past7.toISOString())
      .order("created_at", { ascending: true });

    const sparkline: { date: string; value: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() - (6 - i) * 86400000);
      const dateStr = d.toISOString().substring(0, 10);

      const count =
        (mcqLast7 || []).filter(
          (x) => x.created_at.substring(0, 10) === dateStr
        ).length || 0;

      sparkline.push({ date: dateStr, value: count });
    }

    // =====================================================
    // 2) BLOOM LEVEL CHART — LLO (auto-fill 0)
    // =====================================================
    const bloomLevels = [
      "Remember",
      "Understand",
      "Apply",
      "Analyze",
      "Evaluate",
      "Create",
    ];

    const { data: bloomRawLlo } = await supabase
      .from("llos")
      .select("bloom_suggested")
      .eq("owner_id", userId);

    const bloomCountLlo = bloomLevels.map((level) => ({
      name: level,
      value: bloomRawLlo?.filter((x) => x.bloom_suggested === level).length ?? 0,
    }));

    // =====================================================
    // 3) BLOOM LEVEL CHART — MCQ (auto-fill 0)
    // =====================================================
    const { data: bloomRawMcq } = await supabase
      .from("mcq_items")
      .select("bloom_level")
      .eq("owner_id", userId);

    const bloomCountMcq = bloomLevels.map((level) => ({
      name: level,
      value: bloomRawMcq?.filter((x) => x.bloom_level === level).length ?? 0,
    }));

    // =====================================================
    // RESPONSE – FLAT SHAPE ĐÚNG VỚI DashboardPage
    // =====================================================
    return NextResponse.json({
      ok: true,

      // các trường mà DashboardPage đang đọc
      courseCount: courseCount ?? 0,
      lessonCount: lessonCount ?? 0,
      lloCount: lloCount ?? 0,
      auCount: auCount ?? 0,
      misCount: misCount ?? 0,
      mcqCount: mcqCount ?? 0,

      bloomLlo: bloomCountLlo,
      bloomMcq: bloomCountMcq,
      sparklineMcq: sparkline,
    });
  } catch (err) {
    console.error("Error /api/dashboard/stats:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
