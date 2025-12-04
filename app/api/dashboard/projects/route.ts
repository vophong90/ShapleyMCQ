// app/api/dashboard/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // --- AUTH ---
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.replace("Bearer ", "").trim();
    if (!userId) {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    // --- PAGINATION ---
    const page = Number(req.nextUrl.searchParams.get("page") || 1);
    const limit = Number(req.nextUrl.searchParams.get("limit") || 5);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // --- QUERY PROJECTS ---
    const { data, count, error } = await supabase
      .from("mcq_projects")
      .select(
        `
        id,
        title,
        progress,
        updated_at,
        courses:course_id (title),
        lessons:lesson_id (title)
        `,
        { count: "exact" }
      )
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      page,
      total: count ?? 0,
      data: data ?? [],
    });
  } catch (err) {
    console.error("Error /api/dashboard/projects:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
