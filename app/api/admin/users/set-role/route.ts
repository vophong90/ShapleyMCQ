import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Role = "admin" | "user";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile_ids: string[] = Array.isArray(body.profile_ids)
      ? body.profile_ids
      : [];
    const role: Role | undefined = body.role;

    if (!profile_ids.length) {
      return NextResponse.json(
        { error: "profile_ids[] là bắt buộc" },
        { status: 400 }
      );
    }

    if (!role || !["admin", "user"].includes(role)) {
      return NextResponse.json(
        { error: "role phải là 'admin' hoặc 'user'" },
        { status: 400 }
      );
    }

    /* ===============================
       1. Kiểm tra session + admin
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

    /* ===============================
       2. Thực thi bằng service role
    =============================== */
    const admin = getSupabaseAdmin();

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of profile_ids) {
      try {
        // Không cho admin tự hạ quyền chính mình (khuyến nghị)
        if (id === session.user.id && role !== "admin") {
          results.push({
            id,
            ok: false,
            error: "Không thể tự hạ quyền chính mình",
          });
          continue;
        }

        const { error } = await admin
          .from("profiles")
          .update({ role })
          .eq("id", id);

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
      { error: "Lỗi server khi đổi role", detail: String(err) },
      { status: 500 }
    );
  }
}
