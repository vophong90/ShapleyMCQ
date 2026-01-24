// app/api/admin/books/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title?: string;

  specialty_id?: string | null;
  specialty_name?: string | null;

  mime_type?: string | null;
  file_size?: number | null;
  checksum_sha256?: string | null;

  subtitle?: string | null;
  authors?: string | null;
  edition?: string | null;
  publisher?: string | null;
  publish_year?: number | null;
  language?: string | null;
  source_type?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    // Client dùng cookie session để xác định user gọi API
    const supabase = getRouteClient();

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authData.user;

    // (Tuỳ chọn nhưng nên có) kiểm tra role admin
    // Nếu bạn có bảng profiles với cột role:
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden (admin only)" }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const body = (await req.json()) as Body;

    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    // owner_id lấy từ session, không cho client tự truyền
    const owner_id = user.id;

    const insertRow = {
      owner_id,
      title,

      specialty_id: body.specialty_id || null,
      specialty_name: body.specialty_name || null,

      subtitle: body.subtitle || null,
      authors: body.authors || null,
      edition: body.edition || null,
      publisher: body.publisher || null,
      publish_year: body.publish_year ?? null,
      language: body.language || "vi",
      source_type: body.source_type || "upload",

      mime_type: body.mime_type || null,
      file_size: body.file_size ?? null,
      checksum_sha256: body.checksum_sha256 || null,

      status: "draft",   // enum book_status
      is_active: true,
    };

    const { data, error } = await supabaseAdmin
      .from("books")
      .insert(insertRow)
      .select("id, title, status, created_at")
      .single();

    if (error) {
      console.error("books/create insert error:", error);
      return NextResponse.json(
        {
          error: error.message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error("books/create exception:", e);
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
