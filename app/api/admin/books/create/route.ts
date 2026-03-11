// app/api/admin/books/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

type RequireAdminResult =
  | { ok: true; user_id: string }
  | { ok: false; status: number; error: string };

async function requireAdmin(req: NextRequest): Promise<RequireAdminResult> {
  const supabaseAdmin = getSupabaseAdmin();

  let userId: string | null = null;

  try {
    // 1) Ưu tiên lấy user từ Authorization header
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();

      if (token) {
        const {
          data: { user },
          error,
        } = await supabaseAdmin.auth.getUser(token);

        if (!error && user) {
          userId = user.id;
        }
      }
    }

    // 2) Fallback: lấy user từ cookie/session của route client
    if (!userId) {
      const supabase = await getRouteClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return { ok: false, status: 401, error: "Unauthenticated" };
    }

    // 3) Kiểm tra role bằng admin client để tránh lỗi RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return { ok: false, status: 403, error: "No profile / forbidden" };
    }

    const role = String((profile as any).role || "").trim().toLowerCase();
    const isAdmin = role === "admin";

    if (!isAdmin) {
      return { ok: false, status: 403, error: "Admin only" };
    }

    return { ok: true, user_id: userId };
  } catch (e) {
    return { ok: false, status: 401, error: "Unauthenticated" };
  }
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
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const title = String(body.title || "").trim();
    if (!title) {
      return json({ error: "Missing title" }, { status: 400 });
    }

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
      return json(
        {
          error: "Create book failed",
          detail: error?.message || null,
        },
        { status: 400 }
      );
    }

    return json({ ok: true, data });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
