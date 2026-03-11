// app/api/admin/books/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequireAdminResult =
  | { ok: true; user_id: string }
  | { ok: false; status: number; error: string; detail?: any };

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

async function requireAdmin(req: NextRequest): Promise<RequireAdminResult> {
  const supabaseAdmin = getSupabaseAdmin();
  let userId: string | null = null;

  try {
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
      return {
        ok: false,
        status: 401,
        error: "Unauthenticated",
      };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return {
        ok: false,
        status: 403,
        error: "No profile / forbidden",
        detail: profileError?.message || null,
      };
    }

    const role = String((profile as any).role || "").trim().toLowerCase();
    if (role !== "admin") {
      return {
        ok: false,
        status: 403,
        error: "Admin only",
        detail: { role },
      };
    }

    return { ok: true, user_id: userId };
  } catch (e: any) {
    return {
      ok: false,
      status: 401,
      error: "Unauthenticated",
      detail: e?.message || null,
    };
  }
}

export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return json(
      { error: adminCheck.error, detail: adminCheck.detail ?? null },
      { status: adminCheck.status }
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();

    let q = supabaseAdmin
      .from("books")
      .select("id, title, specialty_id, specialty_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (keyword) {
      q = q.ilike("title", `%${keyword}%`);
    }

    const { data, error } = await q;

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json({ ok: true, data: data || [] });
  } catch (e: any) {
    return json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
