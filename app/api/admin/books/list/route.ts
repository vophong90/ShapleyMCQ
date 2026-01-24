// app/api/admin/books/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();

    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();

    let q = supabaseAdmin
      .from("books")
      .select("id, title, specialty_id, specialty_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (keyword) {
      q = q.ilike("title", `%${keyword}%`);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
