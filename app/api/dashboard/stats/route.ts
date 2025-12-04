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

    // ---- KPI COUNTS ----
    const [
      { count: courseCount },
      { count: lessonCount },
      { count: lloCount },
      { count: auCount },
      { count: misCount },
      { count: mcqCount },
    ] = await Promise.all([
      supabase.from("courses").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("lessons").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("llos").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("assessment_units").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("misconceptions").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("mcq_items").select("*", { count: "exact", head: true }).eq("owner_id", userId),
    ]);

    // ---- MCQ LAST 7 DAYS (Sparkline) ----
    const { data: mcqLast7 } = await supabase
      .from("mcq_items")
      .select("id, created_at")
      .eq("owner_id", userId)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: true });

    const sparklineMcq = (mcqLast7 || []).map((d) => ({
      date: d.created_at,
      value: 1,
    }));

    // ---- Bloom Distribution for LLO ----
    const { data: bloomLloRaw } = await supabase
      .from("llos")
      .select("bloom_suggested")
      .eq("owner_id", userId);

    const bloomLlo = Object.entries(
      (bloomLloRaw || []).reduce((acc: any, row: any) => {
        if (!row.bloom_suggested) return acc;
        acc[row.bloom_suggested] = (acc[row.bloom_suggested] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    // ---- Bloom Distribution for MCQ ----
    const { data: bloomMcqRaw } = await supabase
      .from("mcq_items")
      .select("bloom_level")
      .eq("owner_id", userId);

    const bloomMcq = Object.entries(
      (bloomMcqRaw || []).reduce((acc: any, row: any) => {
        if (!row.bloom_level) return acc;
        acc[row.bloom_level] = (acc[row.bloom_level] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    // ---- FINAL RETURN (phải khớp DashboardPage) ----
    return NextResponse.json({
      ok: true,

      courseCount: courseCount ?? 0,
      lessonCount: lessonCount ?? 0,
      lloCount: lloCount ?? 0,
      auCount: auCount ?? 0,
      misCount: misCount ?? 0,
      mcqCount: mcqCount ?? 0,

      bloomLlo,      // For BarMini
      bloomMcq,      // For DonutMini
      sparklineMcq,  // For Sparkline
    });
  } catch (err) {
    console.error("Error /api/dashboard/stats:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
