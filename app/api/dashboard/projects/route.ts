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

    // Pagination
    const page = Number(req.nextUrl.searchParams.get("page") || 1);
    const pageSize = 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabase
      .from("mcq_items")
      .select("id, stem, created_at, course_id, au_id", { count: "exact" })
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      page,
      total: count ?? 0,
      items: data ?? [],
    });
  } catch (err) {
    console.error("Error /api/dashboard/projects:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
