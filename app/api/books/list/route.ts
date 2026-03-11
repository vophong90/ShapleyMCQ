// app/api/books/list/route.ts
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

    // Lấy user từ session hiện tại
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json(
        {
          ok: false,
          error: "Unauthenticated",
          detail: authError?.message ?? null,
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();

    let q = supabase
      .from("books")
      .select(
        "id, title, subtitle, specialty_id, specialty_name, status, is_active, created_at"
      )
      .eq("status", "ready")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200);

    if (keyword) {
      const kw = keyword.replace(/[%_]/g, "");
      q = q.or(
        `title.ilike.%${kw}%,subtitle.ilike.%${kw}%,specialty_name.ilike.%${kw}%`
      );
    }

    const { data, error } = await q;

    if (error) {
      return json(
        {
          ok: false,
          error: error.message,
          detail: error,
        },
        { status: 400 }
      );
    }

    return json({
      ok: true,
      data: data ?? [],
    });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: e?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
