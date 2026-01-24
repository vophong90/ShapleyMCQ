import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteClient();

    // 1) Check login
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }

    // 2) Read query
    const url = new URL(req.url);
    const exam_id = (url.searchParams.get("exam_id") || "").trim();
    const limitRaw = Number(url.searchParams.get("limit") || "20");
    const limit = Math.max(1, Math.min(200, isFinite(limitRaw) ? limitRaw : 20));

    if (!exam_id) {
      return NextResponse.json({ error: "Thiếu exam_id" }, { status: 400 });
    }

    // 3) RLS will ensure only owner can see
    const { data, error } = await supabase
      .from("exam_irt_simulations")
      .select(
        [
          "id",
          "exam_id",
          "model",
          "n_students",
          "k_choice",
          "theta_mu",
          "theta_sigma",
          "theta_cut",
          "raw_cut_percent",
          "bin_width",
          "overall_misclass",
          "worstcase_misclass",
          "false_pass",
          "false_fail",
          "created_at",
        ].join(",")
      )
      .eq("exam_id", exam_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json(
      { success: true, exam_id, rows: data || [] },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Lỗi server /api/exams/irt-simulations:", e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
