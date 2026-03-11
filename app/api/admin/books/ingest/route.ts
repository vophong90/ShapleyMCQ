// app/api/admin/books/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================
   Helpers
========================================= */

function json(body: any, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;
  return `${proto}://${host}`;
}

function guessExtFromName(name: string) {
  return (name.split(".").pop() || "").toLowerCase().trim();
}

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function chunkText(
  text: string,
  targetChars = 900,
  overlapChars = 150
): { chunk_index: number; content: string }[] {
  const clean = (text || "").replace(/\r/g, "").trim();
  if (!clean) return [];

  const paras = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  const chunks: string[] = [];
  let buf = "";

  const pushBuf = () => {
    const c = buf.trim();
    if (!c) return;
    chunks.push(c);
  };

  for (const p of paras) {
    if (p.length > targetChars * 1.8) {
      if (buf.trim()) {
        pushBuf();
        buf = "";
      }
      let i = 0;
      while (i < p.length) {
        const slice = p.slice(i, i + targetChars);
        chunks.push(slice.trim());
        i += targetChars - overlapChars;
      }
      continue;
    }

    if ((buf + "\n\n" + p).length > targetChars) {
      pushBuf();
      const tail = buf.slice(Math.max(0, buf.length - overlapChars));
      buf = (tail ? tail + "\n\n" : "") + p;
    } else {
      buf += (buf ? "\n\n" : "") + p;
    }
  }

  if (buf.trim()) pushBuf();

  return chunks.map((c, i) => ({ chunk_index: i + 1, content: c }));
}

function modelToDim(model: string): number | null {
  const m = (model || "").trim();
  if (m === "text-embedding-3-small") return 1536;
  if (m === "text-embedding-3-large") return 3072;
  return null;
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

    // 3) Check admin bằng admin client để tránh RLS
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

/* =========================================
   OpenAI Embeddings
========================================= */

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

async function embedBatch(input: string[], model: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { _raw: raw };
  }

  if (!res.ok) {
    const reqId =
      res.headers.get("x-request-id") ||
      res.headers.get("x-openai-request-id") ||
      null;

    throw new Error(
      `OpenAI embeddings ${res.status}${
        reqId ? ` (request_id=${reqId})` : ""
      }: ${JSON.stringify(data?.error || data)}`
    );
  }

  const arr = Array.isArray(data?.data) ? data.data : [];
  return arr.map((x: any) => x.embedding as number[]);
}

/* =========================================
   Types
========================================= */

type Body = {
  book_id?: string;
  chunk_target_chars?: number;
  chunk_overlap_chars?: number;
  embedding_model?: string;
  rebuild?: boolean;
};

/* =========================================
   Handler
========================================= */

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return json(
      { error: adminCheck.error, detail: adminCheck.detail ?? null },
      { status: adminCheck.status }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  let jobId: string | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const book_id = (body.book_id || "").trim();

    if (!book_id) {
      return json({ error: "Missing book_id" }, { status: 400 });
    }

    // 1) Load book metadata
    const { data: book, error: bookErr } = await supabaseAdmin
      .from("books")
      .select(
        "id, owner_id, title, status, is_active, storage_bucket, storage_path, mime_type, specialty_id, specialty_name, embedding_model, embedding_dim"
      )
      .eq("id", book_id)
      .single();

    if (bookErr || !book) {
      return json(
        { error: "Book not found", detail: bookErr?.message || null },
        { status: 404 }
      );
    }

    if (!book.storage_bucket || !book.storage_path) {
      return json(
        {
          error:
            "Book chưa có storage_bucket/storage_path. Bạn cần upload file lên Storage trước.",
        },
        { status: 400 }
      );
    }

    // 2) Create ingest job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("book_ingest_jobs")
      .insert({
        book_id: book.id,
        owner_id: book.owner_id,
        status: "processing",
        step: "download",
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      return json(
        { error: "Cannot create ingest job", detail: jobErr?.message || null },
        { status: 400 }
      );
    }

    jobId = job.id;

    // 3) Tạo signed URL để /api/file-extract tự tải file
    await supabaseAdmin
      .from("book_ingest_jobs")
      .update({ step: "extract_signed_url" })
      .eq("id", jobId);

    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from(book.storage_bucket)
      .createSignedUrl(book.storage_path, 60 * 10);

    if (signedErr || !signed?.signedUrl) {
      await supabaseAdmin
        .from("book_ingest_jobs")
        .update({
          status: "failed",
          step: "extract_signed_url",
          error: signedErr?.message || "createSignedUrl failed",
        })
        .eq("id", jobId);

      return json(
        {
          error: "createSignedUrl failed",
          detail: signedErr?.message || null,
        },
        { status: 400 }
      );
    }

    const ext =
      guessExtFromName(book.storage_path) ||
      guessExtFromName(book.title) ||
      "bin";

    // 4) Gọi /api/file-extract
    await supabaseAdmin
      .from("book_ingest_jobs")
      .update({ step: "extract" })
      .eq("id", jobId);

    const baseUrl = getBaseUrl(req);

    const extractRes = await fetch(`${baseUrl}/api/file-extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: signed.signedUrl,
        name: `${book.title}.${ext}`,
        ext,
      }),
    });

    const extractRaw = await extractRes.text();
    let extractData: any = null;
    try {
      extractData = extractRaw ? JSON.parse(extractRaw) : null;
    } catch {
      extractData = { _raw: extractRaw };
    }

    if (!extractRes.ok || !extractData?.text) {
      await supabaseAdmin
        .from("book_ingest_jobs")
        .update({
          status: "failed",
          step: "extract",
          error:
            extractData?.error ||
            extractData?._raw ||
            `HTTP ${extractRes.status}`,
        })
        .eq("id", jobId);

      return json(
        {
          error: "File extract failed",
          detail: extractData?.error || extractData?._raw || null,
        },
        { status: 400 }
      );
    }

    const text = String(extractData.text || "").trim();
    if (!text) {
      await supabaseAdmin
        .from("book_ingest_jobs")
        .update({
          status: "failed",
          step: "extract",
          error: "Extracted text is empty",
        })
        .eq("id", jobId);

      return json({ error: "Extracted text is empty" }, { status: 400 });
    }

    // 5) Chunk
    await supabaseAdmin
      .from("book_ingest_jobs")
      .update({ step: "chunk" })
      .eq("id", jobId);

    const targetChars = clampInt(body.chunk_target_chars ?? 900, 300, 2000);
    const overlapChars = clampInt(body.chunk_overlap_chars ?? 150, 0, 600);

    const chunks = chunkText(text, targetChars, overlapChars);

    if (chunks.length === 0) {
      await supabaseAdmin
        .from("book_ingest_jobs")
        .update({
          status: "failed",
          step: "chunk",
          error: "No chunks produced",
        })
        .eq("id", jobId);

      return json({ error: "No chunks produced" }, { status: 400 });
    }

    // 6) Optional rebuild
    if (body.rebuild) {
      await supabaseAdmin
        .from("book_ingest_jobs")
        .update({ step: "rebuild_delete_old" })
        .eq("id", jobId);

      const { error: delErr } = await supabaseAdmin
        .from("book_chunks")
        .delete()
        .eq("book_id", book.id);

      if (delErr) {
        await supabaseAdmin
          .from("book_ingest_jobs")
          .update({
            status: "failed",
            step: "rebuild_delete_old",
            error: delErr.message,
          })
          .eq("id", jobId);

        return json(
          { error: "Failed to delete old chunks", detail: delErr.message },
          { status: 400 }
        );
      }
    }

    // 7) Embeddings + insert chunks
    await supabaseAdmin
      .from("book_ingest_jobs")
      .update({ step: "embed_and_insert" })
      .eq("id", jobId);

    const embeddingModel = (
      body.embedding_model ||
      process.env.OPENAI_EMBED_MODEL ||
      book.embedding_model ||
      DEFAULT_EMBED_MODEL
    ).trim();

    const embeddingDim =
      modelToDim(embeddingModel) ?? (book.embedding_dim ?? null);

    const BATCH = 64;
    let inserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);

      const embeddings = await embedBatch(
        slice.map((c) => c.content),
        embeddingModel
      );

      if (
        embeddingDim &&
        embeddings[0] &&
        embeddings[0].length !== embeddingDim
      ) {
        throw new Error(
          `Embedding dim mismatch: expected ${embeddingDim}, got ${embeddings[0].length} (model=${embeddingModel})`
        );
      }

      const rows = slice.map((c, idx) => ({
        book_id: book.id,
        owner_id: book.owner_id,
        specialty_id: book.specialty_id ?? null,
        chunk_index: c.chunk_index,
        content: c.content,
        page_from: null,
        page_to: null,
        heading: null,
        embedding: embeddings[idx] ?? null,
      }));

      const { error: insErr } = await supabaseAdmin
        .from("book_chunks")
        .insert(rows);

      if (insErr) {
        throw new Error(`Insert book_chunks failed: ${insErr.message}`);
      }

      inserted += rows.length;
    }

    // 8) Update books
    await supabaseAdmin
      .from("book_ingest_jobs")
      .update({ step: "finalize" })
      .eq("id", jobId);

    const { error: updBookErr } = await supabaseAdmin
      .from("books")
      .update({
        status: "ready",
        chunk_count: inserted,
        embedding_model: embeddingModel,
        embedding_dim: embeddingDim,
        updated_at: new Date().toISOString(),
      })
      .eq("id", book.id);

    if (updBookErr) {
      throw new Error(`Update books failed: ${updBookErr.message}`);
    }

    // 9) Mark job ready
    await supabaseAdmin
      .from("book_ingest_jobs")
      .update({
        status: "ready",
        step: "done",
        finished_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", jobId);

    return json({
      ok: true,
      book_id: book.id,
      chunk_count: inserted,
      embedding_model: embeddingModel,
      embedding_dim: embeddingDim,
      job_id: jobId,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);

    if (jobId) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        await supabaseAdmin
          .from("book_ingest_jobs")
          .update({
            status: "failed",
            error: msg,
            finished_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      } catch {
        // ignore
      }
    }

    return json(
      { error: "Ingest failed", detail: msg, job_id: jobId },
      { status: 500 }
    );
  }
}
