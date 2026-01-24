import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient"; // ❌ KHÔNG dùng client ở server
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type Role = "admin" | "user";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile_ids: string[] = Array.isArray(body.profile_ids) ? body.profile_ids : [];
    const role: Role | undefined = body.role;

    if (!profile_ids.length) {
      return NextResponse.json({ error: "profile_ids[] là bắt buộc" }, { status: 400 });
    }
    if (!role || !["admin", "user"].includes(role)) {
      return NextResponse.json({ error: "role phải là admin|user" }, { status: 400 });
    }

    // ✅ Check session + admin role (server-side, dựa cookie)
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

    // ✅ Thực thi bằng service role (bỏ qua RLS)
    const admin = getSupabaseAdmin();

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of profile_ids) {
      try {
        // (Tuỳ chọn) không cho tự hạ quyền chính mình nếu muốn
        // if (id === user.id && role !== "admin") { ... }

        const { error } = await admin.from("profiles").update({ role }).eq("id", id);
        if (error) results.push({ id, ok: false, error: error.message });
        else results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;

    return NextResponse.json({ ok: okCount, total: results.length, results });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi server khi đổi role", detail: String(err) },
      { status: 500 }
    );
  }
}
