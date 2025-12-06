import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const owner_id = searchParams.get("owner_id");

    if (!owner_id)
      return NextResponse.json(
        { error: "owner_id là bắt buộc" },
        { status: 400 }
      );

    const { data, error } = await supabase
      .from("courses")
      .select("id, title")
      .eq("owner_id", owner_id);

    if (error) throw error;

    return NextResponse.json({ courses: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "ERROR_LOADING_COURSES" },
      { status: 500 }
    );
  }
}
