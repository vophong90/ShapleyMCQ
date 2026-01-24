// app/api/admin/books/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  owner_id?: string; // ✅ REQUIRED theo schema books.owner_id
  title?: string;

  // ✅ match schema
  specialty_id?: string | null;
  specialty_name?: string | null;

  // stub upload metadata (đúng tên cột schema)
  mime_type?: string | null;
  file_size?: number | null; // maps to bigint
  checksum_sha256?: string | null;

  // optional metadata (match schema)
  subtitle?: string | null;
  authors?: string | null;
  edition?: string | null;
  publisher?: string | null;
  publish_year?: number | null;
  language?: string | null; // default 'vi'
  source_type?: string | null; // default 'upload'
};

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();
    const body = (await req.json()) as Body;

    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const owner_id = (body.owner_id || "").trim();
    if (!owner_id) {
      return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });
    }

    // ✅ match public.books columns
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
      source_type: (body.source_type as any) || "upload",

      mime_type: body.mime_type || null,
      file_size: body.file_size ?? null,
      checksum_sha256: body.checksum_sha256 || null,

      status: "draft", // ✅ phải tồn tại trong enum book_status
      is_active: true,
    };

    const { data, error } = await supabaseAdmin
      .from("books")
      .insert(insertRow)
      .select("id, title, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
