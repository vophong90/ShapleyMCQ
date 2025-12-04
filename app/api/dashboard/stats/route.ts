import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = getAdminClient();

  // Lấy user từ header Authorization
  const auth = req.headers.get("Authorization");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(auth.replace("Bearer ", ""));

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // Helper KPI function
  async function kpi(table: string) {
    const { count } = await supabase
      .from(table)
      .select("*", { head: true, count: "exact" })
      .eq("owner_id", userId);
    return count ?? 0;
  }

  // KPI Values
  const [courseCount, lessonCount, lloCount, auCount, misCount, mcqCount] =
    await Promise.all([
      kpi("courses"),
      kpi("lessons"),
      kpi("llos"),
      kpi("assessment_units"),
      kpi("misconceptions"),
      kpi("mcq_items"),
    ]);

  // Sparkline MCQ (7 ngày)
  const { data: sparklineMcq } = await supabase.rpc("dashboard_mcq_sparkline", {
    uid: userId,
  });

  // Histogram LLO by Bloom
  const { data: bloomLlo } = await supabase
    .from("llos")
    .select("bloom_suggested, count:count(*)")
    .eq("owner_id", userId)
    .group("bloom_suggested");

  // Histogram MCQ by Bloom
  const { data: bloomMcq } = await supabase
    .from("mcq_items")
    .select("bloom_level, count:count(*)")
    .eq("owner_id", userId)
    .group("bloom_level");

  return NextResponse.json({
    courseCount,
    lessonCount,
    lloCount,
    auCount,
    misCount,
    mcqCount,
    sparklineMcq: sparklineMcq ?? [],
    bloomLlo: bloomLlo ?? [],
    bloomMcq: bloomMcq ?? [],
  });
}
