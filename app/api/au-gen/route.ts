// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * - targetChars: kích thước chunk
 * - overlapChars: chồng lấp cuối chunk trước vào chunk sau
 */
function chunkText(
  text: string,
  targetChars = 900,
  overlapChars = 150
): { id: string; content: string }[] {
  const clean = (text || "").replace(/\r/g, "").trim();
  if (!clean) return [];

  // tách theo đoạn
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
    // nếu một paragraph quá dài thì cắt nhỏ thêm
    if (p.length > targetChars * 1.8) {
      // flush buf trước
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
      // overlap
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
 * Retrieve đơn giản bằng scoring token overlap (không cần vector DB).
 * Tối ưu cho “một LLO + specialty”.
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
      // đếm 1 nếu xuất hiện; tránh overcount
      if (t.includes(w)) score += 1;
    }
    // bonus nếu chunk có cấu trúc “định nghĩa/triệu chứng/pháp trị/…”
    if (/(triệu chứng|chẩn đoán|pháp trị|phương|huyệt|bát cương|tạng phủ|kinh lạc|biện chứng)/i.test(c.content)) {
      score += 1;
    }
    return { ...c, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(2, Math.min(k, scored.length)));
}

/* =========================================
   OpenAI GPT-5.2 (Responses API)
========================================= */

const OPENAI_URL = "https://api.openai.com/v1/responses";

// json_schema: ép model trả đúng schema (ổn định hơn json_object với GPT-5.x)
async function callOpenAIJsonSchema<T>(args: {
  model?: string;
  prompt: string;
  schemaName: string;
  schema: any;
  temperature?: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = (args.model || process.env.OPENAI_LLO_MODEL || "gpt-5.2-chat-latest").trim();

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: args.prompt,
      temperature: typeof args.temperature === "number" ? args.temperature : 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: args.schemaName,
          schema: args.schema,
          strict: true,
        },
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // LOG CHI TIẾT để bạn thấy đúng lỗi 403/permission/quota...
    console.error("OpenAI error:", JSON.stringify(data, null, 2));
    throw new Error(
      `OpenAI ${res.status}: ${JSON.stringify(data?.error || data, null, 2)}`
    );
  }

  // Responses API trả parsed ở output_parsed (khi dùng json_schema)
  const parsed = data?.output_parsed;
  if (!parsed) {
    const outText = data?.output_text;
    console.error("No output_parsed. output_text:", outText);
    throw new Error("No output_parsed from OpenAI");
  }

  return parsed as T;
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

// Candidate schema có “bằng chứng” để verifier bám vào chunk, nhưng cuối cùng ta strip đi
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
              quote: { type: "string" }, // trích ngắn <= 25-40 từ
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

    // ✅ giữ đúng kiểu FormData như app của bạn đang gửi
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      llos_text = (formData.get("llos_text") || "").toString();
      learner_level = (formData.get("learner_level") || "").toString();
      bloom_level = (formData.get("bloom_level") || "").toString();
      specialty_name = (formData.get("specialty_name") || "").toString();
      course_title = (formData.get("course_title") || "").toString();
      lesson_title = (formData.get("lesson_title") || "").toString();
      au_count_raw = (formData.get("au_count") || "12").toString();

      // files key: "files"
      const files = formData.getAll("files").filter((x) => x instanceof File) as File[];

      // gọi /api/file-extract giống logic bạn đang dùng
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
          if (Array.isArray(extractData.unsupported)) {
            unsupported = extractData.unsupported;
          }
        } else {
          console.error("file-extract error:", extractData);
          unsupported.push({
            name: "file-extract",
            reason: extractData?.error || "Không trích xuất được nội dung từ file.",
          });
        }
      }
    } else {
      // JSON mode fallback (nếu cần)
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
      return NextResponse.json({ error: "Thiếu LLOs để tạo AU" }, { status: 400 });
    }

    const auCount = clampInt(parseInt(au_count_raw, 10), 1, 40);

    // ✅ Tránh context quá dài: truncate raw materials trước khi chunk
    const materialsTextTrunc = truncateText(materialsText, 180_000); // 180k chars ~ rất nhiều

    /* ============================
       RAG: chunk → retrieve top-K
    ============================ */

    const chunksAll = chunkText(materialsTextTrunc, 900, 150);

    // nếu không có tài liệu, vẫn chạy nhưng sẽ rất hạn chế; verifier sẽ “gắt” hơn
    const query = `${specialty_name}\n${course_title}\n${lesson_title}\n${llos_text}`;
    const topChunks = retrieveTopK(chunksAll, query, 10);

    const chunkBlock = topChunks.length
      ? topChunks
          .map((c) => `<<<${c.id}>>>\n${c.content}`)
          .join("\n\n---\n\n")
      : "[Không có chunk tài liệu khả dụng]";

    /* ============================
       STEP 1: GENERATE (có evidence)
    ============================ */

    const genPrompt = `
Bạn là chuyên gia thiết kế đánh giá trong giáo dục y khoa.

MỤC TIÊU
Sinh đúng ${auCount} Assessment Units (AU) dựa CHẶT vào LLO và TÀI LIỆU (chunk) bên dưới.

NGỮ CẢNH
- Chuyên ngành: ${specialty_name || "không rõ"}
- Học phần: ${course_title || "không rõ"}
- Bài học: ${lesson_title || "không rõ"}
- Bậc học: ${learner_level || "không rõ"}
- Bloom mục tiêu: ${bloom_level || "không rõ"}

LLO
${llos_text}

TÀI LIỆU (CHUNK) — CHỈ ĐƯỢC DÙNG NHỮNG GÌ CÓ TRONG CÁC CHUNK NÀY, KHÔNG BỊA
${chunkBlock}

QUY TẮC AU
- Mỗi AU = 1 mệnh đề kiểm tra được, có đúng/sai rõ.
- Không gộp 2–3 ý trong một AU.
- Không “trôi chuyên ngành”. Nếu chuyên ngành là YHCT: ưu tiên tứ chẩn, bát cương, tạng phủ, khí huyết tân dịch, kinh lạc/huyệt, biện chứng luận trị, pháp trị, phương dược, châm cứu/xoa bóp/dưỡng sinh (chỉ dùng Tây y khi LLO yêu cầu đối chiếu).

BẮT BUỘC BẰNG CHỨNG
Mỗi AU phải kèm:
- evidence.chunk_id: id chunk (ví dụ chunk_3)
- evidence.quote: trích dẫn ngắn từ chunk đó (tối đa ~35 từ) chứng minh AU (không bịa câu trích).

OUTPUT: trả JSON theo schema.
`.trim();

    type CandidateAU = {
      core_statement: string;
      short_explanation: string | null;
      bloom_min: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
      evidence: { chunk_id: string; quote: string };
    };

    const gen = await callOpenAIJsonSchema<{ aus: CandidateAU[] }>({
      prompt: genPrompt,
      schemaName: "au_candidates",
      schema: AU_SCHEMA_CANDIDATE,
      temperature: 0.2,
    });

    let candidates = Array.isArray(gen?.aus) ? gen.aus : [];

    // loại rỗng & dedup sơ bộ
    const seen = new Set<string>();
    candidates = candidates.filter((x) => {
      const k = normalizeCore(x?.core_statement || "");
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    /* ============================
       STEP 2: VERIFY (lọc/sửa/đủ số)
    ============================ */

    const verifyPrompt = `
Bạn là chuyên gia phản biện/kiểm định nội dung.

NHIỆM VỤ
- Kiểm tra các AU candidates có bám LLO và có căn cứ trong chunk không.
- Loại bỏ AU nào:
  (1) Không có căn cứ rõ trong quote/chunk
  (2) Sai chuyên ngành hoặc “trôi hệ”
  (3) Mơ hồ, không kiểm tra được
  (4) Gộp nhiều ý
- Nếu AU có thể sửa để đúng hơn (vẫn bám đúng chunk), hãy sửa.
- Kết quả CUỐI phải có đúng ${auCount} AU.
- Nếu sau khi lọc còn thiếu, hãy tạo thêm AU MỚI nhưng vẫn CHỈ dựa trên chunk.

LLO
${llos_text}

TÀI LIỆU (CHUNK)
${chunkBlock}

AU CANDIDATES (có evidence)
${JSON.stringify(candidates, null, 2)}

OUTPUT: chỉ JSON theo schema aus[ {core_statement, short_explanation, bloom_min} ].
`.trim();

    const verified = await callOpenAIJsonSchema<{ aus: any[] }>({
      prompt: verifyPrompt,
      schemaName: "au_verified",
      schema: AU_SCHEMA_FINAL,
      temperature: 0.1,
    });

    let finalAus = Array.isArray(verified?.aus) ? verified.aus : [];

    // clean, trim, dedup lần cuối
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
       STEP 3: REPAIR (nếu verifier thiếu)
       (thường hiếm khi thiếu, nhưng để “đủ số” đúng yêu cầu)
    ============================ */

    if (finalAus.length < auCount) {
      const need = auCount - finalAus.length;

      const repairPrompt = `
Bạn cần bổ sung ${need} AU để đủ đúng ${auCount} AU.

RÀNG BUỘC
- Không được trùng với các AU đã có.
- CHỈ dựa vào chunk tài liệu, không bịa.
- Mỗi AU là 1 mệnh đề kiểm tra được.
- Bám LLO.

LLO
${llos_text}

TÀI LIỆU (CHUNK)
${chunkBlock}

AU ĐÃ CÓ
${JSON.stringify(finalAus, null, 2)}

OUTPUT JSON theo schema aus[].
`.trim();

      const repaired = await callOpenAIJsonSchema<{ aus: any[] }>({
        prompt: repairPrompt,
        schemaName: "au_repair",
        schema: AU_SCHEMA_FINAL,
        temperature: 0.2,
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

    // đảm bảo đúng số lượng
    finalAus = finalAus.slice(0, auCount);

    // nếu vẫn thiếu (rất hiếm): báo lỗi rõ ràng để bạn biết tài liệu không đủ
    if (finalAus.length < auCount) {
      return NextResponse.json(
        {
          error: `Sau verify/repair vẫn thiếu AU: ${finalAus.length}/${auCount}. Có thể tài liệu upload không đủ hoặc trích xuất text kém.`,
          aus: finalAus,
          unsupported,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ aus: finalAus, unsupported }, { status: 200 });
  } catch (err: any) {
    console.error("Lỗi server /api/au-gen:", err);

    // Nếu bạn vẫn gặp 403, phần detail sẽ in đúng lỗi OpenAI trả về
    return NextResponse.json(
      {
        error: "Lỗi server khi sinh AU (GPT-5.2 RAG)",
        detail: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}
