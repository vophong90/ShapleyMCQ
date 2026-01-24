// app/api/admin/books/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

const BOOKS_BUCKET = "books";

/**
 * Admin check: đọc session cookie + profile.role/system_role
 * Lưu ý: getRouteClient của bạn trả Promise => phải await
 */
async function requireAdmin(req: NextRequest) {
  const supabase = await getRouteClient();

  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();

  if (sessErr || !session) {
    return { ok: false, status: 401, error: "Unauthenticated" as const };
  }

  const userId = session.user.id;

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

type Body = {
  book_id?: string;

  // client đã upload thẳng lên Storage bucket "books", API chỉ cần nhận path
  storage_path?: string;

  // optional metadata để lưu vào books
  mime_type?: string | null;
  file_size?: number | null;
  checksum_sha256?: string | null;
};

export async function POST(req: NextRequest) {
  // ✅ admin-only
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // ✅ nhận JSON, không nhận multipart nữa
    const body = (await req.json().catch(() => ({}))) as Body;

    const book_id = String(body.book_id || "").trim();
    const storage_path = String(body.storage_path || "").trim();

    if (!book_id) return json({ error: "Missing book_id" }, { status: 400 });
    if (!storage_path) return json({ error: "Missing storage_path" }, { status: 400 });

    // Load book để chắc book tồn tại
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

    // (tuỳ chọn) kiểm tra object có tồn tại trong storage không
    // Nếu không muốn check (cho nhanh) thì có thể bỏ đoạn này.
    const head = await supabaseAdmin.storage.from(BOOKS_BUCKET).list(
      storage_path.split("/").slice(0, -1).join("/") || "",
      { search: storage_path.split("/").pop() || "" }
    );
    if (head.error) {
      return json(
        { error: "Storage check failed", detail: head.error.message },
        { status: 400 }
      );
    }
    // nếu list không ra file đúng tên, vẫn có thể là do prefix/list behavior;
    // nên check mềm: nếu không tìm thấy thì báo warning chứ không chặn
    const fileName = storage_path.split("/").pop() || "";
    const found = (head.data || []).some((it: any) => it?.name === fileName);

    // Update books record: lưu bucket/path + metadata file
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
      warning: found ? null : "Storage object not confirmed by list(); please verify path.",
    });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
