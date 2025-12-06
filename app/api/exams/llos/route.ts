// app/api/exam-blueprints/llos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const course_id = searchParams.get("course_id");

    if (!course_id) {
      return NextResponse.json(
        { error: "course_id là bắt buộc" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("llos")
      .select("id, code, text")
      .eq("course_id", course_id)
      .order("code", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ llos: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "ERROR_LOADING_LLOS" },
      { status: 500 }
    );
  }
}
