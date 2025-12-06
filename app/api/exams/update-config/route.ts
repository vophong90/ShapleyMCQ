// app/api/exam-blueprints/update-config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json().catch(() => null);

    if (!body || !body.blueprint_id) {
      return NextResponse.json(
        { error: "Thiếu blueprint_id" },
        { status: 400 }
      );
    }

    const {
      blueprint_id,
      course_id,
      total_questions,
      include_sources,
      llo_distribution,
    } = body;

    // Validate
    if (!course_id)
      return NextResponse.json(
        { error: "Bạn phải chọn course_id" },
        { status: 400 }
      );

    if (!Array.isArray(llo_distribution))
      return NextResponse.json(
        { error: "llo_distribution phải là array" },
        { status: 400 }
      );

    const sum = llo_distribution.reduce(
      (s: number, r: any) => s + Number(r.weight_percent || 0),
      0
    );

    if (Math.abs(sum - 100) > 0.01)
      return NextResponse.json(
        { error: "Tổng % LLO phải = 100" },
        { status: 400 }
      );

    // Build config object
    const config = {
      course_id,
      total_questions,
      include_sources: include_sources ?? {
        own_mcq: true,
        shared_mcq: true,
      },
      llo_distribution,
    };

    // Update
    const { error: updateError } = await supabase
      .from("exam_blueprints")
      .update({ config })
      .eq("id", blueprint_id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("UPDATE_CONFIG_ERROR:", err);
    return NextResponse.json(
      { error: err.message ?? "UPDATE_CONFIG_FAILED" },
      { status: 500 }
    );
  }
}
