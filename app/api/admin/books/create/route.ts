// app/api/admin/books/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title?: string;
  specialty_code?: string | null;

  // stub upload metadata
  original_filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();
    const body = (await req.json()) as Body;

    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    // ⚠️ tạm assume books table có các cột này (bạn sẽ tạo schema ở bước kế)
    // Bạn có thể giữ nguyên payload, schema tạo sau sẽ khớp.
    const insertRow: any = {
      title,
      specialty_code: body.specialty_code || null,
      status: "draft",
      original_filename: body.original_filename || null,
      mime_type: body.mime_type || null,
      size_bytes: body.size_bytes || null,
    };

    const { data, error } = await supabaseAdmin
      .from("books")
      .insert(insertRow)
      .select("id, title")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
