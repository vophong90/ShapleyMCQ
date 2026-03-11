// app/api/admin/books/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKS_BUCKET = "books";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

type RequireAdminResult =
  | { ok: true; user_id: string }
  | { ok: false; status: number; error: string; detail?: any };

async function requireAdmin(req: NextRequest): Promise<RequireAdminResult> {
  const supabaseAdmin = getSupabaseAdmin();
  let userId: string | null = null;

  try {
    // 1) Ưu tiên bearer token
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

    // 2) Fallback cookie/session
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

    // 3) Check role bằng admin client để không vướng RLS
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

type Body = {
  book_id?: string;
  storage_path?: string;
  mime_type?: string | null;
  file_size?: number | null;
  checksum_sha256?: string | null;
};

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return json(
      { error: adminCheck.error, detail: adminCheck.detail ?? null },
      { status: adminCheck.status }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const book_id = String(body.book_id || "").trim();
    const storage_path = String(body.storage_path || "").trim();

    if (!book_id) {
      return json({ error: "Missing book_id" }, { status: 400 });
    }

    if (!storage_path) {
      return json({ error: "Missing storage_path" }, { status: 400 });
    }

    // Check book tồn tại
    const { data: book, error: bookErr } = await supabaseAdmin
      .from("books")
      .select("id, title")
      .eq("id", book_id)
      .single();

    if (bookErr || !book) {
      return json(
        { error: "Book not found", detail: bookErr?.message || null },
        { status: 404 }
      );
    }

    // Check mềm xem object có trong bucket không
    const folder = storage_path.split("/").slice(0, -1).join("/") || "";
    const fileName = storage_path.split("/").pop() || "";

    let found = false;
    let storageWarning: string | null = null;

    if (fileName) {
      const listRes = await supabaseAdmin.storage.from(BOOKS_BUCKET).list(folder, {
        search: fileName,
      });

      if (listRes.error) {
        storageWarning = `Storage check failed: ${listRes.error.message}`;
      } else {
        found = (listRes.data || []).some((it: any) => it?.name === fileName);
        if (!found) {
          storageWarning =
            "Storage object not confirmed by list(); please verify path.";
        }
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from("books")
      .update({
        storage_bucket: BOOKS_BUCKET,
        storage_path,
        mime_type: body.mime_type ?? null,
        file_size: body.file_size ?? null,
        checksum_sha256: body.checksum_sha256 ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", book_id);

    if (updErr) {
      return json(
        { error: "Update books failed", detail: updErr.message },
        { status: 400 }
      );
    }

    return json({
      ok: true,
      book_id,
      bucket: BOOKS_BUCKET,
      storage_path,
      warning: storageWarning,
      object_confirmed: found,
    });
  } catch (e: any) {
    return json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
