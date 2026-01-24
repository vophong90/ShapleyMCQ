import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile_ids: string[] = Array.isArray(body.profile_ids) ? body.profile_ids : [];

    if (!profile_ids.length) {
      return NextResponse.json({ error: "profile_ids[] là bắt buộc" }, { status: 400 });
    }

    // ✅ Check người gọi là admin
    const supabase = await getRouteClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (meErr || !me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const DEFAULT_PWD = process.env.ADMIN_DEFAULT_PASSWORD?.trim() || "12345678@";
    const admin = getSupabaseAdmin();

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of profile_ids) {
      try {
        const { error } = await admin.auth.admin.updateUserById(id, { password: DEFAULT_PWD });
        if (error) results.push({ id, ok: false, error: error.message });
        else results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: String(e) });
      }
    }

    return NextResponse.json({
      ok: results.filter((r) => r.ok).length,
      total: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server khi reset mật khẩu", detail: String(err) },
      { status: 500 }
    );
  }
}
