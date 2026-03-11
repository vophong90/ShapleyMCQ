// app/api/books/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

type RequireUserResult =
  | { ok: true; user_id: string }
  | { ok: false; status: number; error: string; detail?: any };

async function requireUser(req: NextRequest): Promise<RequireUserResult> {
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
  const userCheck = await requireUser(req);
  if (!userCheck.ok) {
    return json(
      { error: userCheck.error, detail: userCheck.detail ?? null },
      { status: userCheck.status }
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();

    let q = supabaseAdmin
      .from("books")
      .select(
        "id, title, subtitle, specialty_id, specialty_name, status, is_active, created_at"
      )
      .eq("status", "ready")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200);

    if (keyword) {
      q = q.or(
        `title.ilike.%${keyword}%,subtitle.ilike.%${keyword}%,specialty_name.ilike.%${keyword}%`
      );
    }

    const { data, error } = await q;

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json({
      ok: true,
      data: data || [],
    });
  } catch (e: any) {
    return json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
