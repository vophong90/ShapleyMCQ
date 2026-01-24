// app/api/exams/irt-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteClient();

    // 1) auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return json({ success: false, error: "Bạn cần đăng nhập." }, { status: 401 });

    // 2) input
    const exam_id = req.nextUrl.searchParams.get("exam_id")?.trim();
    if (!exam_id) {
      return json({ success: false, error: "exam_id là bắt buộc" }, { status: 400 });
    }

    // 3) verify exam exists (RLS sẽ chặn nếu không phải owner)
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .select("id")
      .eq("id", exam_id)
      .single();

    if (examErr || !exam) {
      return json(
        { success: false, error: "Không tìm thấy đề thi hoặc bạn không có quyền." },
        { status: 404 }
      );
    }

    // 4) count params
    const { count, error: cErr } = await supabase
      .from("exam_item_irt_params")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", exam_id);

    if (cErr) throw cErr;

    const n = Number(count ?? 0);

    return json(
      {
        success: true,
        exam_id,
        has_params: n > 0,
        params_count: n,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Lỗi server /api/exams/irt-status:", e);
    return json(
      { success: false, error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
