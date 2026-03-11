// app/api/admin/books/upload-init/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKS_BUCKET = "books";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function safeFileName(name: string) {
  const base = (name || "file")
    .replace(/[^\p{L}\p{N}\.\-_ ]/gu, "")
    .trim()
    .replace(/\s+/g, "_");
  return base.slice(0, 180) || "file";
}

function getProjectIdFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

type RequireAdminResult =
  | { ok: true; user_id: string }
  | { ok: false; status: number; error: string; detail?: any };

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

    // 2) Fallback: lấy từ cookie/session
    if (!userId) {
      const supabaseRoute = await getRouteClient();
      const {
        data: { user },
        error,
      } = await supabaseRoute.auth.getUser();

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

    // 3) Check role bằng admin client để tránh RLS
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (profErr || !profile) {
      return {
        ok: false,
        status: 403,
        error: "No profile / forbidden",
        detail: profErr?.message || null,
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
  file_name?: string;
  content_type?: string | null;
  upsert?: boolean | null;
};

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return json(
      {
        ok: false,
        error: adminCheck.error,
        detail: adminCheck.detail ?? null,
      },
      { status: adminCheck.status }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const book_id = String(body.book_id || "").trim();
    if (!book_id) {
      return json({ ok: false, error: "Missing book_id" }, { status: 400 });
    }

    const rawFileName = String(body.file_name || "").trim();
    const file_name = safeFileName(rawFileName || "file");
    const content_type =
      body.content_type === null || body.content_type === undefined
        ? "application/octet-stream"
        : String(body.content_type).trim() || "application/octet-stream";
    const upsert = Boolean(body.upsert ?? true);

    const supabaseAdmin = getSupabaseAdmin();

    // Đảm bảo book tồn tại
    const { data: book, error: bookErr } = await supabaseAdmin
      .from("books")
      .select("id, title")
      .eq("id", book_id)
      .single();

    if (bookErr || !book) {
      return json(
        {
          ok: false,
          error: "Book not found",
          detail: bookErr?.message || null,
        },
        { status: 404 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return json(
        { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    if (!anonKey) {
      return json(
        { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY" },
        { status: 500 }
      );
    }

    const projectId = getProjectIdFromUrl(supabaseUrl);
    if (!projectId) {
      return json(
        {
          ok: false,
          error: "Cannot parse projectId from NEXT_PUBLIC_SUPABASE_URL",
        },
        { status: 500 }
      );
    }

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = file_name || safeFileName(book.title || "book");
    const objectName = `${book_id}/${ts}-${baseName}`;

    // Khớp với page mới:
    // page đang cần: { tusEndpoint, objectName, bucket, anonKey }
    // và upload trực tiếp bằng accessToken của user.
    const tusEndpoint = `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;

    return json({
      ok: true,
      bucket: BOOKS_BUCKET,
      objectName,
      tusEndpoint,
      anonKey,
      contentType: content_type,
      upsert,
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
