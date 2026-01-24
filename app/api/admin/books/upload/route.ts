// app/api/admin/books/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

// ✅ bạn đổi tên bucket ở đây nếu hệ thống bạn dùng bucket khác
const DEFAULT_BOOKS_BUCKET = process.env.BOOKS_BUCKET || "books";

function safeFileName(name: string) {
  const base = (name || "file")
    .replace(/[^\p{L}\p{N}\.\-_ ]/gu, "")
    .trim()
    .replace(/\s+/g, "_");
  return base.slice(0, 180) || "file";
}

async function requireAdmin() {
  // ✅ theo setup của bạn: getRouteClient() không nhận req
  const supabase = getRouteClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    return { ok: false, status: 401, error: "Unauthenticated" as const };
  }

  const userId = authData.user.id;

  // Hỗ trợ cả 2 cột role / system_role
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, system_role")
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

export async function POST(req: NextRequest) {
  // ✅ admin-only
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // Nhận multipart/form-data
    const form = await req.formData();

    const book_id = String(form.get("book_id") || "").trim();
    if (!book_id) return json({ error: "Missing book_id" }, { status: 400 });

    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return json({ error: "Missing file (multipart field name must be 'file')" }, { status: 400 });
    }

    const overwrite = String(form.get("overwrite") || "false").toLowerCase() === "true";
    const bucket = String(form.get("bucket") || DEFAULT_BOOKS_BUCKET).trim() || DEFAULT_BOOKS_BUCKET;

    // Load book để chắc book tồn tại
    const { data: book, error: bookErr } = await supabaseAdmin
      .from("books")
      .select("id, title, storage_bucket, storage_path")
      .eq("id", book_id)
      .single();

    if (bookErr || !book) {
      return json({ error: "Book not found", detail: bookErr?.message || null }, { status: 404 });
    }

    // Đọc bytes
    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // checksum sha256
    const checksum_sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    const mime_type = file.type || "application/octet-stream";
    const file_size = buf.length;

    const originalName = safeFileName(file.name || `${book.title || "book"}`);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const storage_path = `books/${book_id}/${ts}-${originalName}`;

    // Upload Storage
    // Supabase JS storage.upload expects Blob/ArrayBuffer; Buffer ok trong node (thường ok),
    // nếu bạn gặp lỗi type, đổi sang new Blob([buf]) cũng được.
    const up = await supabaseAdmin.storage.from(bucket).upload(storage_path, buf, {
      contentType: mime_type,
      upsert: overwrite,
    });

    if (up.error) {
      return json({ error: "Storage upload failed", detail: up.error.message }, { status: 400 });
    }

    // Update books record: lưu bucket/path + metadata file
    const { error: updErr } = await supabaseAdmin
      .from("books")
      .update({
        storage_bucket: bucket,
        storage_path,
        mime_type,
        file_size,
        checksum_sha256,
        // status: "draft", // giữ nguyên nếu bạn muốn
        updated_at: new Date().toISOString(),
      })
      .eq("id", book_id);

    if (updErr) {
      return json({ error: "Update books failed", detail: updErr.message }, { status: 400 });
    }

    return json({
      ok: true,
      book_id,
      bucket,
      storage_path,
      mime_type,
      file_size,
      checksum_sha256,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
