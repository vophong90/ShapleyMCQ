// app/api/admin/books/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

async function requireAdmin() {
  // ✅ FIX: getRouteClient() trả Promise => phải await
  const supabase = await getRouteClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    return { ok: false, status: 401, error: "Unauthenticated" as const };
  }

  const userId = authData.user.id;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return { ok: false, status: 403, error: "No profile / forbidden" as const };
  }

  const role = (profile as any).role || null;
  const systemRole = (profile as any).system_role || null;

  const isAdmin =
    ["admin", "super_admin", "system_admin"].includes(String(role || "")) ||
    ["admin", "super_admin", "system_admin"].includes(String(systemRole || ""));

  if (!isAdmin) return { ok: false, status: 403, error: "Admin only" as const };

  return { ok: true, user_id: userId };
}

type Body = {
  title?: string;
  specialty_id?: string | null;
  specialty_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  language?: string | null;
};

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const title = String(body.title || "").trim();
    if (!title) return json({ error: "Missing title" }, { status: 400 });

    const specialty_name =
      body.specialty_name === null || body.specialty_name === undefined
        ? null
        : String(body.specialty_name).trim() || null;

    const specialty_id =
      body.specialty_id === null || body.specialty_id === undefined
        ? null
        : String(body.specialty_id).trim() || null;

    const mime_type =
      body.mime_type === null || body.mime_type === undefined
        ? null
        : String(body.mime_type).trim() || null;

    const file_size =
      body.file_size === null || body.file_size === undefined
        ? null
        : Number(body.file_size) || null;

    const language =
      body.language === null || body.language === undefined
        ? "vi"
        : String(body.language).trim() || "vi";

    // ✅ khớp schema public.books: owner_id, title, specialty_id/name, mime_type, file_size, language...
    const { data, error } = await supabaseAdmin
      .from("books")
      .insert({
        owner_id: adminCheck.user_id,
        title,
        specialty_id,
        specialty_name,
        mime_type,
        file_size,
        language,
        source_type: "upload",
        status: "draft",
        is_active: true,
      })
      .select("id, title, specialty_id, specialty_name, status, created_at")
      .single();

    if (error || !data) {
      return json({ error: "Create book failed", detail: error?.message || null }, { status: 400 });
    }

    return json({ ok: true, data });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
