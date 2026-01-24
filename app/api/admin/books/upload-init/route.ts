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
    return u.hostname.split(".")[0];
  } catch {
    return null;
  }
}

async function requireAdmin(req: NextRequest) {
  // 1) chỉ lấy session từ cookie bằng route client
  const supabaseRoute = await getRouteClient();
  const {
    data: { session },
    error: sessErr,
  } = await supabaseRoute.auth.getSession();

  if (sessErr || !session) {
    return { ok: false, status: 401, error: "Unauthenticated" as const };
  }

  const userId = session.user.id;

  // 2) check role bằng service-role (admin) để KHÔNG vướng RLS
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, role, system_role")
    .eq("id", userId)
    .single();

  if (profErr || !profile) {
    return {
      ok: false,
      status: 403,
      error: "No profile / forbidden" as const,
      detail: profErr?.message || null,
    };
  }

  const role = (profile as any).role ?? null;
  const systemRole = (profile as any).system_role ?? null;

  const isAdmin =
    ["admin", "super_admin", "system_admin"].includes(String(role || "")) ||
    ["admin", "super_admin", "system_admin"].includes(String(systemRole || ""));

  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Admin only" as const,
      detail: { role, systemRole },
    };
  }

  return { ok: true, user_id: userId };
}

type Body = {
  book_id?: string;
  file_name?: string;     // original filename
  content_type?: string;  // mime
  upsert?: boolean;
};

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) return json({ error: adminCheck.error }, { status: adminCheck.status });

  const supabaseAdmin = getSupabaseAdmin();

  const body = (await req.json().catch(() => ({}))) as Body;
  const book_id = String(body.book_id || "").trim();
  if (!book_id) return json({ error: "Missing book_id" }, { status: 400 });

  // đảm bảo book tồn tại
  const { data: book, error: bookErr } = await supabaseAdmin
    .from("books")
    .select("id, title")
    .eq("id", book_id)
    .single();

  if (bookErr || !book) {
    return json({ error: "Book not found", detail: bookErr?.message || null }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const projectId = getProjectIdFromUrl(url);
  if (!projectId) return json({ error: "Cannot parse projectId from NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const original = safeFileName(body.file_name || book.title || "book");
  const objectName = `${book_id}/${ts}-${original}`;

  // ✅ Signed upload token (2h). Token dùng cho upload không cần auth thêm.
  // Lưu ý: với resumable presigned, bạn sẽ gửi token này vào header `x-signature`.
  const { data, error } = await supabaseAdmin.storage
    .from(BOOKS_BUCKET)
    .createSignedUploadUrl(objectName, { upsert: Boolean(body.upsert ?? true) });

  if (error || !data?.token) {
    return json({ error: "createSignedUploadUrl failed", detail: error?.message || null }, { status: 400 });
  }

  return json({
    ok: true,
    bucket: BOOKS_BUCKET,
    objectName,
    token: data.token,
    // TUS endpoint phải dùng storage hostname cho performance
    tusEndpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
  });
}
