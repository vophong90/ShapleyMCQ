import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile_ids: string[] = Array.isArray(body.profile_ids) ? body.profile_ids : [];

    if (!profile_ids.length) {
      return NextResponse.json({ error: "profile_ids[] là bắt buộc" }, { status: 400 });
    }

    // ✅ Check session + admin role
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authErr } = await routeClient.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { data: me, error: meErr } = await routeClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (meErr || !me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ❗không cho admin tự xóa chính mình (khuyến nghị)
    if (profile_ids.includes(user.id)) {
      return NextResponse.json({ error: "Không thể xóa chính bạn (admin đang đăng nhập)." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of profile_ids) {
      try {
        // 1) Xóa auth user (quan trọng) -> thường sẽ cascade xóa profiles nếu FK ON DELETE CASCADE
        const { error: delAuthErr } = await admin.auth.admin.deleteUser(id);

        if (delAuthErr) {
          results.push({ id, ok: false, error: delAuthErr.message });
          continue;
        }

        // 2) (Fallback) Nếu profile không cascade thì xóa tay:
        // await admin.from("profiles").delete().eq("id", id);

        results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;

    return NextResponse.json({ ok: okCount, total: results.length, results });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server khi xóa user", detail: String(err) },
      { status: 500 }
    );
  }
}
