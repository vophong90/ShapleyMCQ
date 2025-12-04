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

    // COUNT KPIs
    const [{ count: courseCount }, { count: lessonCount }, { count: lloCount }, { count: auCount }, { count: misCount }, { count: mcqCount }] =
      await Promise.all([
        supabase.from("courses").select("*", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("lessons").select("*", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("llos").select("*", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("assessment_units").select("*", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("misconceptions").select("*", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("mcq_items").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      ]);

    // Mini chart: MCQ created last 7 days
    const { data: mcqLast7 } = await supabase
      .from("mcq_items")
      .select("id, created_at")
      .eq("owner_id", userId)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: true });

    const mcqMini = (mcqLast7 || []).map((d) => ({
      date: d.created_at,
      value: 1,
    }));

    return NextResponse.json({
      ok: true,
      kpi: {
        courses: courseCount ?? 0,
        lessons: lessonCount ?? 0,
        llos: lloCount ?? 0,
        aus: auCount ?? 0,
        misconceptions: misCount ?? 0,
        mcqs: mcqCount ?? 0,
      },
      miniCharts: {
        mcqLastWeek: mcqMini,
      },
    });
  } catch (err) {
    console.error("Error /api/dashboard/stats:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
