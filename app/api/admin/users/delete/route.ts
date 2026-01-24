import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile_ids: string[] = Array.isArray(body.profile_ids)
      ? body.profile_ids
      : [];

    if (!profile_ids.length) {
      return NextResponse.json(
        { error: "profile_ids[] là bắt buộc" },
        { status: 400 }
      );
    }

    /* ===============================
       1. Check session + admin
    =============================== */
    const supabase = getRouteClient();

    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: "Chưa đăng nhập" },
        { status: 401 }
      );
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", session.user.id)
      .single();

    if (meErr || !me || me.role !== "admin") {
      return NextResponse.json(
        { error: "Không có quyền thực hiện thao tác này" },
        { status: 403 }
      );
    }

    // Không cho admin tự xóa chính mình
    if (profile_ids.includes(session.user.id)) {
      return NextResponse.json(
        { error: "Không thể xóa chính tài khoản admin đang đăng nhập" },
        { status: 400 }
      );
    }

    /* ===============================
       2. Thực thi bằng service role
    =============================== */
    const admin = getSupabaseAdmin();

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of profile_ids) {
      try {
        const { error } = await admin.auth.admin.deleteUser(id);

        if (error) {
          results.push({ id, ok: false, error: error.message });
        } else {
          results.push({ id, ok: true });
        }
      } catch (e: any) {
        results.push({ id, ok: false, error: String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;

    return NextResponse.json({
      ok: okCount,
      total: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server khi xóa user", detail: String(err) },
      { status: 500 }
    );
  }
}
