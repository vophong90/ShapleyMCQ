// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceMode = "upload" | "book" | "gpt";

/* =========================================
   CORS helpers
========================================= */

function buildCorsHeaders(req?: NextRequest) {
  const origin = req?.headers.get("origin") || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
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

function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;

  return `${proto}://${host}`;
}

// BẮT BUỘC có OPTIONS để browser preflight
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

function guessExtFromName(name: string) {
  return (name.split(".").pop() || "").toLowerCase().trim();
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
   Base64 helper (for calling /api/file-extract JSON)
========================================= */

async function fileToDataBase64(file: File): Promise<string> {
  // ⚠️ Chỉ dùng cho file nhỏ (vì serverless memory/time)
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("base64");
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

  const model =
    (args.model || process.env.OPENAI_LLO_MODEL || DEFAULT_MODEL).trim();

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
      `OpenAI ${res.status}${
        reqId ? ` (request_id=${reqId})` : ""
      }: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data?.error || data, null, 2)
      }`
    );
  }

  // ✅ Robust text extraction for Responses API
  let outText: string | null = null;

  // 1) Some responses include output_text
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    outText = data.output_text.trim();
  }

  // 2) Otherwise, pull from output[].content[]
  if (!outText && Array.isArray(data?.output)) {
    const texts: string[] = [];

    for (const o of data.output) {
      const content = o?.content;
      if (!Array.isArray(content)) continue;

      for (const c of content) {
        // Most common: { type: "output_text", text: "..." }
        if (
          (c?.type === "output_text" || c?.type === "text") &&
          typeof c?.text === "string" &&
          c.text.trim()
        ) {
          texts.push(c.text.trim());
        }

        // Sometimes nested like { type:"output_text", text:{ value:"..." } }
        if (
          (c?.type === "output_text" || c?.type === "text") &&
          typeof c?.text?.value === "string" &&
          c.text.value.trim()
        ) {
          texts.push(c.text.value.trim());
        }
      }
    }

    if (texts.length) outText = texts.join("\n");
  }

  if (!outText) {
    console.error("No text found in Responses payload:", data);
    throw new Error("No text found in OpenAI response (Responses API).");
  }

  try {
    return JSON.parse(outText) as T;
  } catch (e) {
    console.error("Failed to parse JSON from model text:", outText);
    throw new Error("Failed to parse JSON from OpenAI response text.");
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
            enum: [
              "remember",
              "understand",
              "apply",
              "analyze",
              "evaluate",
              "create",
            ],
          },
        },
        required: ["core_statement", "short_explanation", "bloom_min"],
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
            enum: [
              "remember",
              "understand",
              "apply",
              "analyze",
              "evaluate",
              "create",
            ],
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
        required: [
          "core_statement",
          "short_explanation",
          "bloom_min",
          "evidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["aus"],
  additionalProperties: false,
};

// Schema riêng cho GPT-only mode (có importance + reviewer_note)
const AU_SCHEMA_GPT_CANDIDATE = {
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
            enum: [
              "remember",
              "understand",
              "apply",
              "analyze",
              "evaluate",
              "create",
            ],
          },
          importance: {
            type: "string",
            enum: ["core", "supporting", "too_trivial"],
          },
          reviewer_note: { type: ["string", "null"] },
        },
        required: [
          "core_statement",
          "short_explanation",
          "bloom_min",
          "importance",
          "reviewer_note",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["aus"],
  additionalProperties: false,
};

type CandidateAU = {
  core_statement: string;
  short_explanation: string | null;
  bloom_min:
    | "remember"
    | "understand"
    | "apply"
    | "analyze"
    | "evaluate"
    | "create";
  evidence: { chunk_id: string; quote: string };
};

type GPTCandidateAU = {
  core_statement: string;
  short_explanation: string | null;
  bloom_min:
    | "remember"
    | "understand"
    | "apply"
    | "analyze"
    | "evaluate"
    | "create";
  importance: "core" | "supporting" | "too_trivial";
  reviewer_note: string | null;
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

    let sourceMode: SourceMode = "upload";
    let bookId: string | null = null;

    // ===== JSON body (có thể gửi sẵn materialsText) =====
    if (!contentType.includes("multipart/form-data")) {
      const body = (await req.json().catch(() => ({}))) as any;

      llos_text = (body.llos_text || "").toString();
      learner_level = (body.learner_level || "").toString();
      bloom_level = (body.bloom_level || "").toString();
      specialty_name = (body.specialty_name || "").toString();
      course_title = (body.course_title || "").toString();
      lesson_title = (body.lesson_title || "").toString();
      au_count_raw = (body.au_count ?? "12").toString();
      materialsText = (body.materialsText || "").toString();

      const rawMode = (body.source_mode || "").toString();
      if (rawMode === "book" || rawMode === "gpt" || rawMode === "upload") {
        sourceMode = rawMode;
      }

      if (body.book_id) {
        bookId = body.book_id.toString();
      }

      if (Array.isArray(body.unsupported)) unsupported = body.unsupported;

      if (!llos_text.trim()) {
        return jsonWithCors(
          req,
          { error: "Thiếu LLOs để tạo AU" },
          { status: 400 }
        );
      }
    } else {
      // ===== multipart/form-data (FE đang dùng FormData) =====
      const formData = await req.formData();

      llos_text = (formData.get("llos_text") || "").toString();
      learner_level = (formData.get("learner_level") || "").toString();
      bloom_level = (formData.get("bloom_level") || "").toString();
      specialty_name = (formData.get("specialty_name") || "").toString();
      course_title = (formData.get("course_title") || "").toString();
      lesson_title = (formData.get("lesson_title") || "").toString();
      au_count_raw = (formData.get("au_count") || "12").toString();

      const rawMode = (formData.get("source_mode") || "").toString();
      if (rawMode === "book" || rawMode === "gpt" || rawMode === "upload") {
        sourceMode = rawMode;
      }

      const rawBookId = formData.get("book_id");
      if (rawBookId) {
        bookId = rawBookId.toString();
      }

      if (!llos_text.trim()) {
        return jsonWithCors(
          req,
          { error: "Thiếu LLOs để tạo AU" },
          { status: 400 }
        );
      }

      // Chỉ xử lý file nếu sourceMode === "upload"
      if (sourceMode === "upload") {
        const files = formData
          .getAll("files")
          .filter((x) => x instanceof File) as File[];

        if (files.length > 0) {
          // Convert sang JSON base64 cho /api/file-extract
          const payloadFiles = await Promise.all(
            files.map(async (f) => ({
              name: f.name || "unknown",
              ext: guessExtFromName(f.name || ""),
              data_base64: await fileToDataBase64(f),
            }))
          );

          const baseUrl = getBaseUrl(req);
          const extractRes = await fetch(`${baseUrl}/api/file-extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: payloadFiles }),
          });

          const extractData = await extractRes.json().catch(() => ({}));

          if (extractRes.ok && extractData?.text) {
            materialsText = extractData.text.toString();
            if (Array.isArray(extractData.unsupported))
              unsupported = extractData.unsupported;
          } else {
            console.error("file-extract error:", extractData);
            unsupported.push({
              name: "file-extract",
              reason:
                extractData?.error ||
                "Không trích xuất được nội dung từ file upload.",
            });
          }
        }
      }
    }

    const auCount = clampInt(parseInt(au_count_raw, 10), 1, 40);

    if (sourceMode === "book" && !bookId) {
      return jsonWithCors(
        req,
        { error: "Thiếu book_id khi chọn nguồn từ sách (book)." },
        { status: 400 }
      );
    }

    // ============================
    // MODE 3: GPT-ONLY (không dùng tài liệu)
    // ============================
    if (sourceMode === "gpt") {
      if (!llos_text.trim()) {
        return jsonWithCors(
          req,
          { error: "Thiếu LLOs để sinh AU (GPT-only)." },
          { status: 400 }
        );
      }

      // STEP 1: GPT sinh candidates + importance
      const genPrompt = `
Bạn là giảng viên thiết kế đánh giá trong giáo dục y khoa.

NHIỆM VỤ GIAI ĐOẠN 1 (BRAINSTORM)
- Sinh khoảng ${auCount}–${Math.max(
        auCount + 4,
        auCount + 2
      )} AU CANDIDATES.
- Mỗi AU là 1 mệnh đề kiểm tra được (testable statement) gắn với LLO và bối cảnh.
- Cho phép có cả ý rất hay, ý trung bình và vài ý hơi vụn vặt, để bước 2 sẽ lọc lại.

NGỮ CẢNH
- Specialty/Program: ${specialty_name || "N/A"}
- Course: ${course_title || "N/A"}
- Lesson/Topic: ${lesson_title || "N/A"}
- Learner level: ${learner_level || "N/A"}
- Target Bloom (mong muốn tối thiểu): ${bloom_level || "N/A"}

LLO (Learning Lesson Outcomes)
${llos_text}

HƯỚNG DẪN ĐÁNH DẤU CANDIDATES
- importance = "core": AU phản ánh năng lực/kiến thức CỐT LÕI cần đánh giá, phù hợp LLO và bậc học.
- importance = "supporting": AU liên quan nhưng mang tính bổ trợ, chi tiết hơn, vẫn chấp nhận được.
- importance = "too_trivial": AU đánh giá kiến thức vụn vặt, chi tiết nhỏ lẻ, không nên dùng làm đơn vị AU cuối cùng.
- reviewer_note: ghi ngắn gọn lý do phân loại (1–2 câu).

QUY TẮC VIẾT AU
- Mỗi AU chỉ 1 ý, có thể dùng để ra câu hỏi (MCQ/OSCE/short answer) rõ ràng.
- Ưu tiên AU gắn với hành vi quan sát được hoặc sản phẩm có thể chấm điểm.
- Không copy y nguyên wording của LLO; có thể chi tiết hóa/operation hóa LLO.

OUTPUT
- Trả về JSON theo schema aus[{core_statement, short_explanation, bloom_min, importance, reviewer_note}].
`.trim();

      const gptGen = await callOpenAIJsonSchema<{ aus: GPTCandidateAU[] }>({
        model: DEFAULT_MODEL,
        prompt: genPrompt,
        schemaName: "au_gpt_candidates",
        schema: AU_SCHEMA_GPT_CANDIDATE,
      });

      let candidates = Array.isArray(gptGen?.aus) ? gptGen.aus : [];

      // dedup sơ bộ
      const seenGen = new Set<string>();
      candidates = candidates.filter((x) => {
        const k = normalizeCore(x?.core_statement || "");
        if (!k) return false;
        if (seenGen.has(k)) return false;
        seenGen.add(k);
        return true;
      });

      if (candidates.length === 0) {
        return jsonWithCors(
          req,
          {
            error:
              "GPT không sinh được AU candidate nào ở bước 1 (gpt-only).",
          },
          { status: 502 }
        );
      }

      // STEP 2: GPT reviewer lọc, sửa, chọn đúng auCount AU
      const verifyPrompt = `
Bạn là chuyên gia thiết kế chương trình và đánh giá trong giáo dục y khoa.

MỤC TIÊU GIAI ĐOẠN 2 (REVIEW & CHỈNH SỬA)
- Từ danh sách AU CANDIDATES, chọn và/hoặc viết lại để có đúng ${auCount} AU CUỐI CÙNG.
- Mỗi AU cuối cùng phải:
  • BÁM SÁT 1 hoặc vài LLO trong danh sách ở trên.
  • Phù hợp bậc học (learner_level) — không quá khó hoặc quá dễ.
  • Phù hợp target Bloom (ít nhất bằng, hoặc cao hơn một chút nếu hợp lý).
  • Đủ "to" để đáng làm một đơn vị đánh giá (không phải fact quá vụn vặt).
  • Có thể dùng làm basis để xây MCQ/OSCE/mini-CEX, không quá trừu tượng.

HƯỚNG DẪN XỬ LÝ CANDIDATES
- Với importance = "core": ưu tiên giữ lại, được phép chỉnh wording cho rõ ràng, testable, đúng Bloom.
- Với importance = "supporting": chỉ giữ nếu nó giúp lấp các LLO còn thiếu; có thể gom/viết lại thành AU cốt lõi hơn.
- Với importance = "too_trivial": thường LOẠI. Chỉ dùng làm gạch đầu dòng trong short_explanation nếu cần.
- Được phép:
  • Gộp nhiều candidates nhỏ thành 1 AU lớn hơn, miễn vẫn testable và rõ ràng.
  • Nâng cấp Bloom: từ remember → apply/analyze nếu phù hợp với LLO và bậc học.
  • Hạ Bloom: nếu candidate quá cao so với trình độ người học.

NGUYÊN TẮC
- Không sinh AU vượt quá phạm vi bài học và LLO.
- Không sinh AU đòi hỏi can thiệp kỹ thuật mà LLO/bậc học chưa đề cập.
- Không giữ lại các AU chỉ kiểm tra thuộc lòng chi tiết rất nhỏ (con số, tên lẻ) trừ khi LLO rõ ràng yêu cầu.

NGỮ CẢNH (NHẮC LẠI)
- Specialty/Program: ${specialty_name || "N/A"}
- Course: ${course_title || "N/A"}
- Lesson/Topic: ${lesson_title || "N/A"}
- Learner level: ${learner_level || "N/A"}
- Target Bloom: ${bloom_level || "N/A"}

LLO (Learning Lesson Outcomes)
${llos_text}

AU CANDIDATES TỪ BƯỚC 1
${JSON.stringify(candidates, null, 2)}

OUTPUT
- Trả về JSON theo schema aus[{core_statement, short_explanation, bloom_min}].
- Chỉ gửi các AU cuối cùng sau khi đã lọc/sửa (không cần gửi lại importance/reviewer_note).
`.trim();

      const verified = await callOpenAIJsonSchema<{ aus: any[] }>({
        model: DEFAULT_MODEL,
        prompt: verifyPrompt,
        schemaName: "au_gpt_verified",
        schema: AU_SCHEMA_FINAL,
      });

      let finalAus = Array.isArray(verified?.aus) ? verified.aus : [];

      const seen2 = new Set<string>();
      finalAus = finalAus
        .map((x: any) => ({
          core_statement: (x?.core_statement || "").toString().trim(),
          short_explanation:
            x?.short_explanation === null ||
            typeof x?.short_explanation === "string"
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

      finalAus = finalAus.slice(0, auCount);

      if (finalAus.length === 0) {
        return jsonWithCors(
          req,
          {
            error:
              "Sau bước review (GPT-only), không còn AU nào phù hợp. Có thể LLO quá chung chung hoặc prompt chưa phù hợp.",
          },
          { status: 502 }
        );
      }

      return jsonWithCors(
        req,
        {
          aus: finalAus,
          unsupported,
        },
        { status: 200 }
      );
    }

    // ============================
    // MODE 1 & 2: upload / book (có tài liệu)
    // ============================

    // Chuẩn bị chunksAll tùy theo mode
    let chunksAll: { id: string; content: string }[] = [];

    if (sourceMode === "upload") {
      const materialsTextTrunc = truncateText(materialsText, 180_000);
      chunksAll = chunkText(materialsTextTrunc, 900, 150);
    } else if (sourceMode === "book" && bookId) {
      const supabaseAdmin = getSupabaseAdmin();

      const { data: dbChunks, error: dbErr } = await supabaseAdmin
        .from("book_chunks")
        .select("id, content, heading")
        .eq("book_id", bookId)
        .order("chunk_index", { ascending: true })
        .limit(500);

      if (dbErr) {
        console.error("Load book_chunks error:", dbErr);
        return jsonWithCors(
          req,
          {
            error:
              "Không lấy được nội dung từ book_chunks. Vui lòng kiểm tra lại book_id hoặc liên hệ admin.",
          },
          { status: 500 }
        );
      }

      if (!dbChunks || dbChunks.length === 0) {
        return jsonWithCors(
          req,
          {
            error:
              "Book này chưa có chunk nội dung (book_chunks trống). Vui lòng ingest lại sách hoặc chọn nguồn khác.",
          },
          { status: 400 }
        );
      }

      chunksAll = dbChunks
        .map((row: any) => {
          const content = (row.content || "").toString().trim();
          const heading = (row.heading || "").toString().trim();
          if (!content) return null;
          const merged = heading ? `${heading}\n\n${content}` : content;
          return { id: `book_${row.id}`, content: merged };
        })
        .filter((x: any) => x && x.content.length > 40) as {
        id: string;
        content: string;
      }[];
    }

    if (chunksAll.length === 0) {
      return jsonWithCors(
        req,
        {
          error:
            "Không tìm thấy tài liệu để sinh AU (chunksAll trống). Vui lòng kiểm tra file upload hoặc book đã ingest.",
        },
        { status: 400 }
      );
    }

    // RAG: retrieve top-K
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

    // ============================
    // STEP 1: GENERATE (có evidence)
    // ============================

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
- evidence.chunk_id: id chunk (ví dụ chunk_3 hoặc book_xxx)
- evidence.quote: trích ngắn (<= ~35 từ) đúng từ chunk đó để chứng minh AU. Không được chế câu trích.

OUTPUT
Trả về JSON đúng schema.
`.trim();

    const gen = await callOpenAIJsonSchema<{ aus: CandidateAU[] }>({
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

    // ============================
    // STEP 2: VERIFY (lọc/sửa lại AU)
    // ============================

    const verifyPrompt = `
Bạn là verifier/quality reviewer trong giáo dục y khoa.

MỤC TIÊU
- Kiểm định AU candidates có:
  • bám LLO,
  • phù hợp bậc học (learner_level),
  • phù hợp Bloom (không quá thấp hoặc quá cao),
  • không đánh giá kiến thức quá vụn vặt,
  • có bằng chứng rõ trong chunks.
- Kết quả cuối phải có đúng ${auCount} AU.

NGUYÊN TẮC (RẤT QUAN TRỌNG)
- Chỉ sử dụng thông tin có trong chunks.
- Nếu AU không có căn cứ rõ trong quote/chunk => loại hoặc sửa để khớp chunks.
- Nếu AU mơ hồ/không kiểm tra được => sửa cho testable hoặc loại.
- Nếu AU gộp nhiều ý => tách hoặc viết lại thành 1 ý.
- Nếu AU chỉ kiểm tra fact rất nhỏ, ít liên quan đến LLO/bậc học => loại hoặc nâng cấp thành AU có ý nghĩa hơn.
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

    const seen2 = new Set<string>();
    finalAus = finalAus
      .map((x: any) => ({
        core_statement: (x?.core_statement || "").toString().trim(),
        short_explanation:
          x?.short_explanation === null ||
          typeof x?.short_explanation === "string"
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

    // ============================
    // STEP 3: REPAIR (nếu thiếu)
    // ============================

    if (finalAus.length < auCount) {
      const need = auCount - finalAus.length;

      const repairPrompt = `
Bạn cần bổ sung ${need} AU để đủ đúng ${auCount} AU.

RÀNG BUỘC
- Không trùng các AU đã có.
- Chỉ dựa vào chunks, không dùng kiến thức ngoài.
- Mỗi AU là 1 mệnh đề kiểm tra được (testable), bám LLO, phù hợp bậc học và Bloom.

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
            x?.short_explanation === null ||
            typeof x?.short_explanation === "string"
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
          error: `Sau verify/repair vẫn thiếu AU: ${finalAus.length}/${auCount}. Có thể tài liệu upload/book không đủ hoặc trích xuất text kém.`,
          aus: finalAus,
          unsupported,
        },
        { status: 502 }
      );
    }

    return jsonWithCors(
      req,
      { aus: finalAus, unsupported },
      { status: 200 }
    );
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
