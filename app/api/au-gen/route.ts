// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================
   CORS helpers (FIX 403 preflight)
========================================= */

function buildCorsHeaders(req?: NextRequest) {
  // Nếu bạn KHÔNG dùng cookies/credentials => '*' là OK
  // Nếu có dùng credentials: cần đổi sang echo origin + Allow-Credentials
  const origin = req?.headers.get("origin") || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    // Nếu bạn bật credentials thì mở dòng này và bỏ '*' ở allow-origin:
    // "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  } as Record<string, string>;
}

function jsonWithCors(req: NextRequest, body: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers || {});
  const cors = buildCorsHeaders(req);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

// ✅ BẮT BUỘC có OPTIONS để browser preflight không bị 403
export async function OPTIONS(req: NextRequest) {
  const headers = new Headers(buildCorsHeaders(req));
  return new NextResponse(null, { status: 204, headers });
}

/* =========================================
   Utils
========================================= */

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function truncateText(text: string, maxChars: number) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[...TRUNCATED...]";
}

function normalizeCore(text: string) {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Chunk text theo đoạn, giữ overlap nhẹ để tránh mất ngữ cảnh.
 */
function chunkText(
  text: string,
  targetChars = 900,
  overlapChars = 150
): { id: string; content: string }[] {
  const clean = (text || "").replace(/\r/g, "").trim();
  if (!clean) return [];

  const paras = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  const chunks: { id: string; content: string }[] = [];
  let buf = "";

  const pushBuf = () => {
    const c = buf.trim();
    if (!c) return;
    chunks.push({ id: `chunk_${chunks.length + 1}`, content: c });
  };

  for (const p of paras) {
    // paragraph quá dài -> cắt nhỏ
    if (p.length > targetChars * 1.8) {
      if (buf.trim()) {
        pushBuf();
        buf = "";
      }
      let i = 0;
      while (i < p.length) {
        const slice = p.slice(i, i + targetChars);
        chunks.push({ id: `chunk_${chunks.length + 1}`, content: slice.trim() });
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
  return chunks;
}

/**
 * Retrieve đơn giản bằng scoring token overlap (không cần DB).
 */
function retrieveTopK(
  chunks: { id: string; content: string }[],
  query: string,
  k = 8
) {
  const q = (query || "").toLowerCase();
  const terms = Array.from(
    new Set(
      q
        .split(/[^a-zA-ZÀ-ỹ0-9_]+/g)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3)
    )
  );

  const scored = chunks.map((c) => {
    const t = c.content.toLowerCase();
    let score = 0;

    for (const w of terms) {
      if (t.includes(w)) score += 1;
    }

    if (
      /(định nghĩa|tiêu chuẩn|chẩn đoán|điều trị|phác đồ|quy trình|protocol|guideline|mục tiêu|kết cục|liều|chỉ định|chống chỉ định)/i.test(
        c.content
      )
    ) {
      score += 1;
    }

    return { ...c, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(2, Math.min(k, scored.length)));
}

/* =========================================
   OpenAI - Responses API
========================================= */

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.2-pro-2025-12-11";

async function callOpenAIJsonSchema<T>(args: {
  model?: string;
  prompt: string;
  schemaName: string;
  schema: any;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = (args.model || process.env.OPENAI_LLO_MODEL || DEFAULT_MODEL).trim();

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: args.prompt,
      text: {
        format: {
          type: "json_schema",
          name: args.schemaName,
          schema: args.schema,
          strict: true,
        },
      },
    }),
  });

  const raw = await res.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { _raw: raw };
  }

  if (!res.ok) {
    const reqId =
      res.headers.get("x-request-id") ||
      res.headers.get("x-openai-request-id") ||
      data?.request_id ||
      null;

    console.error("OpenAI error:", {
      status: res.status,
      request_id: reqId,
      error: data?.error || data,
    });

    throw new Error(
      `OpenAI ${res.status}${reqId ? ` (request_id=${reqId})` : ""}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data?.error || data, null, 2)
      }`
    );
  }

  const outText = data?.output_text;
  if (!outText || typeof outText !== "string") {
    console.error("No output_text:", data);
    throw new Error("No output_text from OpenAI (Responses API).");
  }

  try {
    return JSON.parse(outText) as T;
  } catch {
    console.error("Failed to parse JSON output_text:", outText);
    throw new Error("Failed to parse JSON output_text from OpenAI.");
  }
}

/* =========================================
   Schemas
========================================= */

const AU_SCHEMA_FINAL = {
  type: "object",
  properties: {
    aus: {
      type: "array",
      items: {
        type: "object",
        properties: {
          core_statement: { type: "string" },
          short_explanation: { type: ["string", "null"] },
          bloom_min: {
            type: "string",
            enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
          },
        },
        required: ["core_statement", "bloom_min"],
        additionalProperties: false,
      },
    },
  },
  required: ["aus"],
  additionalProperties: false,
};

const AU_SCHEMA_CANDIDATE = {
  type: "object",
  properties: {
    aus: {
      type: "array",
      items: {
        type: "object",
        properties: {
          core_statement: { type: "string" },
          short_explanation: { type: ["string", "null"] },
          bloom_min: {
            type: "string",
            enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
          },
          evidence: {
            type: "object",
            properties: {
              chunk_id: { type: "string" },
              quote: { type: "string" }, // <= ~35 từ
            },
            required: ["chunk_id", "quote"],
            additionalProperties: false,
          },
        },
        required: ["core_statement", "bloom_min", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["aus"],
  additionalProperties: false,
};

/* =========================================
   Handler
========================================= */

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let llos_text = "";
    let learner_level = "";
    let bloom_level = "";
    let specialty_name = "";
    let course_title = "";
    let lesson_title = "";
    let au_count_raw = "12";

    let materialsText = "";
    let unsupported: { name: string; reason: string }[] = [];

    // FormData (frontend đang dùng)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      llos_text = (formData.get("llos_text") || "").toString();
      learner_level = (formData.get("learner_level") || "").toString();
      bloom_level = (formData.get("bloom_level") || "").toString();
      specialty_name = (formData.get("specialty_name") || "").toString();
      course_title = (formData.get("course_title") || "").toString();
      lesson_title = (formData.get("lesson_title") || "").toString();
      au_count_raw = (formData.get("au_count") || "12").toString();

      const files = formData
        .getAll("files")
        .filter((x) => x instanceof File) as File[];

      // Trích xuất nội dung file (pptx/pdf/docx/...)
      if (files.length > 0) {
        const fd2 = new FormData();
        for (const f of files) fd2.append("files", f);

        const origin = new URL(req.url).origin;
        const extractRes = await fetch(`${origin}/api/file-extract`, {
          method: "POST",
          body: fd2,
        });

        const extractData = await extractRes.json().catch(() => ({}));

        if (extractRes.ok && extractData?.text) {
          materialsText = extractData.text.toString();
          if (Array.isArray(extractData.unsupported)) unsupported = extractData.unsupported;
        } else {
          console.error("file-extract error:", extractData);
          unsupported.push({
            name: "file-extract",
            reason: extractData?.error || "Không trích xuất được nội dung từ file.",
          });
        }
      }
    } else {
      // JSON fallback
      const body = (await req.json().catch(() => ({}))) as any;
      llos_text = (body.llos_text || "").toString();
      learner_level = (body.learner_level || "").toString();
      bloom_level = (body.bloom_level || "").toString();
      specialty_name = (body.specialty_name || "").toString();
      course_title = (body.course_title || "").toString();
      lesson_title = (body.lesson_title || "").toString();
      au_count_raw = (body.au_count ?? "12").toString();
      materialsText = (body.materialsText || "").toString();
    }

    if (!llos_text.trim()) {
      return jsonWithCors(req, { error: "Thiếu LLOs để tạo AU" }, { status: 400 });
    }

    const auCount = clampInt(parseInt(au_count_raw, 10), 1, 40);

    // Tránh context quá dài (file nhiều)
    const materialsTextTrunc = truncateText(materialsText, 180_000);

    /* ============================
       RAG: chunk → retrieve top-K
    ============================ */

    const chunksAll = chunkText(materialsTextTrunc, 900, 150);

    const query = [
      specialty_name,
      course_title,
      lesson_title,
      learner_level,
      bloom_level,
      llos_text,
    ]
      .filter(Boolean)
      .join("\n");

    const topChunks = retrieveTopK(chunksAll, query, 10);

    const chunkBlock = topChunks.length
      ? topChunks.map((c) => `<<<${c.id}>>>\n${c.content}`).join("\n\n---\n\n")
      : "[Không có chunk tài liệu khả dụng]";

    /* ============================
       STEP 1: GENERATE (evidence)
    ============================ */

    const genPrompt = `
Bạn là chuyên gia thiết kế đánh giá (assessment design) cho giáo dục chuyên ngành.

MỤC TIÊU
- Sinh đúng ${auCount} Assessment Units (AU) dựa CHẶT vào LLO và TÀI LIỆU (chunks) bên dưới.
- Tính đúng chuyên ngành/đúng ngữ cảnh phải đến từ chunks. KHÔNG dùng kiến thức ngoài.

NGỮ CẢNH (để định hướng truy hồi/chọn trọng tâm)
- Specialty/Program: ${specialty_name || "N/A"}
- Course: ${course_title || "N/A"}
- Lesson/Topic: ${lesson_title || "N/A"}
- Learner level: ${learner_level || "N/A"}
- Target Bloom: ${bloom_level || "N/A"}

LLO (Learning Lesson Outcomes)
${llos_text}

TÀI LIỆU (CHUNK)
CHỈ được sử dụng thông tin xuất hiện trong các chunks dưới đây. Nếu không thấy trong chunks thì KHÔNG được suy đoán.
${chunkBlock}

QUY TẮC AU
- Mỗi AU là 1 mệnh đề kiểm tra được (testable), có thể đánh giá đúng/sai hoặc đạt/không đạt một cách rõ ràng.
- Tránh mơ hồ, tránh từ “hiểu rõ/tổng quan” nếu không quy đổi được thành tiêu chí kiểm tra.
- Không gộp nhiều ý trong 1 AU (mỗi AU chỉ 1 ý).
- Không thêm chi tiết không có trong chunks (không “bịa chuẩn liều”, không “bịa guideline”).
- Ưu tiên nội dung bám sát LLO và trọng tâm của bài học.

BẮT BUỘC BẰNG CHỨNG
Mỗi AU phải kèm:
- evidence.chunk_id: id chunk (ví dụ chunk_3)
- evidence.quote: trích ngắn (<= ~35 từ) đúng từ chunk đó để chứng minh AU. Không được chế câu trích.

OUTPUT
Trả về JSON đúng schema.
`.trim();

    type CandidateAU = {
      core_statement: string;
      short_explanation: string | null;
      bloom_min: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
      evidence: { chunk_id: string; quote: string };
    };

    const gen = await callOpenAIJsonSchema<{ aus: CandidateAU[] }>(/* keep */ {
      model: DEFAULT_MODEL,
      prompt: genPrompt,
      schemaName: "au_candidates",
      schema: AU_SCHEMA_CANDIDATE,
    });

    let candidates = Array.isArray(gen?.aus) ? gen.aus : [];

    // dedup sơ bộ
    const seen = new Set<string>();
    candidates = candidates.filter((x) => {
      const k = normalizeCore(x?.core_statement || "");
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    /* ============================
       STEP 2: VERIFY
    ============================ */

    const verifyPrompt = `
Bạn là verifier/quality reviewer.

MỤC TIÊU
- Kiểm định AU candidates có bám LLO và có bằng chứng trong chunks hay không.
- Kết quả cuối phải có đúng ${auCount} AU.

NGUYÊN TẮC (RẤT QUAN TRỌNG)
- Chỉ sử dụng thông tin có trong chunks.
- Nếu AU không có căn cứ rõ trong quote/chunk => loại hoặc sửa để khớp chunks.
- Nếu AU mơ hồ/không kiểm tra được => sửa cho testable hoặc loại.
- Nếu AU gộp nhiều ý => tách hoặc viết lại thành 1 ý.
- Nếu thiếu số lượng sau khi lọc => tạo thêm AU MỚI nhưng vẫn chỉ dựa trên chunks.

LLO
${llos_text}

TÀI LIỆU (CHUNK)
${chunkBlock}

AU CANDIDATES (có evidence)
${JSON.stringify(candidates, null, 2)}

OUTPUT
Chỉ trả JSON theo schema aus[{core_statement, short_explanation, bloom_min}].
`.trim();

    const verified = await callOpenAIJsonSchema<{ aus: any[] }>({
      model: DEFAULT_MODEL,
      prompt: verifyPrompt,
      schemaName: "au_verified",
      schema: AU_SCHEMA_FINAL,
    });

    let finalAus = Array.isArray(verified?.aus) ? verified.aus : [];

    // clean + dedup cuối
    const seen2 = new Set<string>();
    finalAus = finalAus
      .map((x: any) => ({
        core_statement: (x?.core_statement || "").toString().trim(),
        short_explanation:
          x?.short_explanation === null || typeof x?.short_explanation === "string"
            ? x.short_explanation
            : null,
        bloom_min: (x?.bloom_min || "").toString().trim(),
      }))
      .filter((x) => x.core_statement.length > 0 && x.bloom_min.length > 0)
      .filter((x) => {
        const k = normalizeCore(x.core_statement);
        if (!k) return false;
        if (seen2.has(k)) return false;
        seen2.add(k);
        return true;
      });

    /* ============================
       STEP 3: REPAIR (nếu thiếu)
    ============================ */

    if (finalAus.length < auCount) {
      const need = auCount - finalAus.length;

      const repairPrompt = `
Bạn cần bổ sung ${need} AU để đủ đúng ${auCount} AU.

RÀNG BUỘC
- Không trùng các AU đã có.
- Chỉ dựa vào chunks, không dùng kiến thức ngoài.
- Mỗi AU là 1 mệnh đề kiểm tra được (testable) và bám LLO.

LLO
${llos_text}

TÀI LIỆU (CHUNK)
${chunkBlock}

AU ĐÃ CÓ
${JSON.stringify(finalAus, null, 2)}

OUTPUT
Trả JSON theo schema aus[].
`.trim();

      const repaired = await callOpenAIJsonSchema<{ aus: any[] }>({
        model: DEFAULT_MODEL,
        prompt: repairPrompt,
        schemaName: "au_repair",
        schema: AU_SCHEMA_FINAL,
      });

      const extra = Array.isArray(repaired?.aus) ? repaired.aus : [];
      for (const x of extra) {
        const core = (x?.core_statement || "").toString().trim();
        const k = normalizeCore(core);
        if (!core || !k) continue;
        if (seen2.has(k)) continue;
        seen2.add(k);

        finalAus.push({
          core_statement: core,
          short_explanation:
            x?.short_explanation === null || typeof x?.short_explanation === "string"
              ? x.short_explanation
              : null,
          bloom_min: (x?.bloom_min || "").toString().trim(),
        });

        if (finalAus.length >= auCount) break;
      }
    }

    finalAus = finalAus.slice(0, auCount);

    if (finalAus.length < auCount) {
      return jsonWithCors(
        req,
        {
          error: `Sau verify/repair vẫn thiếu AU: ${finalAus.length}/${auCount}. Có thể tài liệu upload không đủ hoặc trích xuất text kém.`,
          aus: finalAus,
          unsupported,
        },
        { status: 502 }
      );
    }

    return jsonWithCors(req, { aus: finalAus, unsupported }, { status: 200 });
  } catch (err: any) {
    console.error("Lỗi server /api/au-gen:", err);

    return jsonWithCors(
      req,
      {
        error: "Lỗi server khi sinh AU (GPT-5.2-pro RAG)",
        detail: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}
