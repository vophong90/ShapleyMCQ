import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOOM_LEVELS = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

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

    // =========================
    // 1) COUNT KPI
    // =========================
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

    // =========================
    // 2) SPARKLINE MCQ (7 ngày)
    // =========================
    const today = new Date();
    const past7 = new Date(Date.now() - 6 * 86400000);

    const { data: mcqLast7 } = await supabase
      .from("mcq_items")
      .select("id, created_at")
      .eq("owner_id", userId)
      .gte("created_at", past7.toISOString())
      .order("created_at", { ascending: true });

    const sparklineMcq: { date: string; value: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() - (6 - i) * 86400000);
      const dateStr = d.toISOString().substring(0, 10);

      const count =
        (mcqLast7 || []).filter(
          (x) => x.created_at.substring(0, 10) === dateStr
        ).length || 0;

      sparklineMcq.push({ date: dateStr, value: count });
    }

    // =========================
    // 3) BLOOM LLO (llos.bloom_suggested)
    // =========================
    const { data: bloomRawLlo } = await supabase
      .from("llos")
      .select("bloom_suggested")
      .eq("owner_id", userId);

    const bloomCountLlo = BLOOM_LEVELS.map((level) => {
      const target = level.toLowerCase();
      const value =
        bloomRawLlo?.filter((x) => {
          const v = (x.bloom_suggested || "").toLowerCase().trim();
          return v === target;
        }).length ?? 0;
      return { name: level, value };
    });

    const totalLlo = bloomRawLlo?.length ?? 0;
    const knownLlo = bloomCountLlo.reduce((s, x) => s + x.value, 0);
    const othersLlo = totalLlo - knownLlo;
    if (othersLlo > 0) {
      bloomCountLlo.push({ name: "Khác / Chưa gán", value: othersLlo });
    }

    // =========================
    // 4) BLOOM AU (assessment_units.bloom_min)
    // =========================
    const { data: bloomRawAu } = await supabase
      .from("assessment_units")
      .select("bloom_min")
      .eq("owner_id", userId);

    const bloomCountAu = BLOOM_LEVELS.map((level) => {
      const target = level.toLowerCase();
      const value =
        bloomRawAu?.filter((x) => {
          const v = (x.bloom_min || "").toLowerCase().trim();
          return v === target;
        }).length ?? 0;
      return { name: level, value };
    });

    const totalAu = bloomRawAu?.length ?? 0;
    const knownAu = bloomCountAu.reduce((s, x) => s + x.value, 0);
    const othersAu = totalAu - knownAu;
    if (othersAu > 0) {
      bloomCountAu.push({ name: "Khác / Chưa gán", value: othersAu });
    }

    // =========================
    // 5) BLOOM MCQ (mcq_items.bloom_level)
    // =========================
    const { data: bloomRawMcq } = await supabase
      .from("mcq_items")
      .select("bloom_level")
      .eq("owner_id", userId);

    const bloomCountMcq = BLOOM_LEVELS.map((level) => {
      const target = level.toLowerCase();
      const value =
        bloomRawMcq?.filter((x) => {
          const v = (x.bloom_level || "").toLowerCase().trim();
          return v === target;
        }).length ?? 0;
      return { name: level, value };
    });

    const totalMcq = bloomRawMcq?.length ?? 0;
    const knownMcq = bloomCountMcq.reduce((s, x) => s + x.value, 0);
    const othersMcq = totalMcq - knownMcq;
    if (othersMcq > 0) {
      bloomCountMcq.push({ name: "Khác / Chưa gán", value: othersMcq });
    }

    // =========================
    // 6) RESPONSE
    // =========================
    return NextResponse.json({
      ok: true,
      courseCount: courseCount ?? 0,
      lessonCount: lessonCount ?? 0,
      lloCount: lloCount ?? 0,
      auCount: auCount ?? 0,
      misCount: misCount ?? 0,
      mcqCount: mcqCount ?? 0,

      bloomLlo: bloomCountLlo,
      bloomAu: bloomCountAu,
      bloomMcq: bloomCountMcq,
      sparklineMcq,
    });
  } catch (err) {
    console.error("Error /api/dashboard/stats:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
