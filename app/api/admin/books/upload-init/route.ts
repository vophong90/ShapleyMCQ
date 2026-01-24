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
  // https://xxxxx.supabase.co  -> projectId = xxxxx
  try {
    const u = new URL(url);
    return u.hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function requireAdmin(_req: NextRequest) {
  // 1) đọc session từ cookie (route client)
  const supabaseRoute = await getRouteClient();
  const {
    data: { session },
    error: sessErr,
  } = await supabaseRoute.auth.getSession();

  if (sessErr || !session) {
    return { ok: false as const, status: 401, error: "Unauthenticated" as const };
  }

  const userId = session.user.id;

  // 2) check role bằng service-role (admin client) để KHÔNG vướng RLS
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (profErr || !profile) {
    return {
      ok: false as const,
      status: 403,
      error: "No profile / forbidden" as const,
      detail: profErr?.message || null,
    };
  }

  const role = (profile as any).role ?? null;
  const isAdmin = String(role || "") === "admin";

  if (!isAdmin) {
    return {
      ok: false as const,
      status: 403,
      error: "Admin only" as const,
      detail: { role },
    };
  }

  return { ok: true as const, user_id: userId };
}

type Body = {
  book_id?: string;
  file_name?: string; // original filename
  content_type?: string; // mime
  upsert?: boolean;
};

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return json(
      { ok: false, error: adminCheck.error, detail: (adminCheck as any).detail ?? null },
      { status: adminCheck.status }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const body = (await req.json().catch(() => ({}))) as Body;

  const book_id = String(body.book_id || "").trim();
  if (!book_id) return json({ ok: false, error: "Missing book_id" }, { status: 400 });

  const file_name = String(body.file_name || "").trim();
  const content_type =
    String(body.content_type || "").trim() || "application/octet-stream";
  const upsert = Boolean(body.upsert ?? true);

  // đảm bảo book tồn tại
  const { data: book, error: bookErr } = await supabaseAdmin
    .from("books")
    .select("id, title")
    .eq("id", book_id)
    .single();

  if (bookErr || !book) {
    return json(
      { ok: false, error: "Book not found", detail: bookErr?.message || null },
      { status: 404 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const projectId = getProjectIdFromUrl(supabaseUrl);
  if (!projectId) {
    return json(
      { ok: false, error: "Cannot parse projectId from NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 }
    );
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    return json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY" },
      { status: 500 }
    );
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const original = safeFileName(file_name || book.title || "book");
  const objectName = `${book_id}/${ts}-${original}`;

  // ✅ Signed upload token. Client sẽ upload dưới role anon + x-signature.
  const { data, error } = await supabaseAdmin.storage
    .from(BOOKS_BUCKET)
    .createSignedUploadUrl(objectName, { upsert });

  if (error || !data?.token) {
    return json(
      { ok: false, error: "createSignedUploadUrl failed", detail: error?.message || null },
      { status: 400 }
    );
  }

  const tusEndpoint = `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;

  // Trả sẵn “hướng dẫn header” để client dùng anon (KHÔNG dùng user access_token)
  return json({
    ok: true,
    bucket: BOOKS_BUCKET,
    objectName,
    token: data.token,
    expiresIn: 60 * 60 * 2, // 2h (tham khảo)
    tusEndpoint,

    // ✅ client upload theo anon:
    anonKey,

    // ✅ header mẫu (client có thể dùng y chang)
    tusHeaders: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-signature": data.token,
      "x-upsert": upsert ? "true" : "false",
      "x-content-type": content_type,
      "x-file-path": objectName,
    },

    // ✅ metadata mẫu cho tus-js-client
    tusMetadata: {
      bucketName: BOOKS_BUCKET,
      objectName,
      contentType: content_type,
      cacheControl: "3600",
    },
  });
}
