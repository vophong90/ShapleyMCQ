// app/api/au-gen/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* =========================
   Helpers
========================= */

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function chunkText(
  text: string,
  maxChars = 800
): { id: string; content: string }[] {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 60);

  const chunks: { id: string; content: string }[] = [];
  let buf = "";

  for (const p of paras) {
    if ((buf + "\n\n" + p).length > maxChars) {
      chunks.push({
        id: `chunk_${chunks.length + 1}`,
        content: buf.trim(),
      });
      buf = p;
    } else {
      buf += "\n\n" + p;
    }
  }

  if (buf.trim()) {
    chunks.push({
      id: `chunk_${chunks.length + 1}`,
      content: buf.trim(),
    });
  }

  return chunks;
}

function scoreChunk(chunk: string, query: string): number {
  const q = query.toLowerCase();
  return q
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .reduce(
      (s, w) => s + (chunk.toLowerCase().includes(w) ? 1 : 0),
      0
    );
}

async function callGPT(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = (process.env.OPENAI_LLO_MODEL || "gpt-5.1").trim();

  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý giáo dục y khoa. CHỈ trả lời JSON đúng schema.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data, null, 2));
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content from GPT");

  return JSON.parse(content);
}

/* =========================
   POST handler
========================= */

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let llos_text = "";
    let learner_level = "";
    let bloom_level = "";
    let specialty_name = "";
    let course_title = "";
    let lesson_title = "";
    let au_count_raw = "8";
    let materialsText = "";
    let unsupported: { name: string; reason: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      llos_text = (formData.get("llos_text") || "").toString();
      learner_level = (formData.get("learner_level") || "").toString();
      bloom_level = (formData.get("bloom_level") || "").toString();
      specialty_name = (formData.get("specialty_name") || "").toString();
      course_title = (formData.get("course_title") || "").toString();
      lesson_title = (formData.get("lesson_title") || "").toString();
      au_count_raw = (formData.get("au_count") || "8").toString();

      const files = formData
        .getAll("files")
        .filter((x) => x instanceof File) as File[];

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
        }
      }
    }

    if (!llos_text.trim()) {
      return NextResponse.json(
        { error: "Thiếu LLO để sinh AU" },
        { status: 400 }
      );
    }

    const auCount = clampInt(parseInt(au_count_raw, 10), 1, 30);

    /* =========================
       RAG: chunk + retrieve
    ========================= */

    const chunks = chunkText(materialsText);
    const query = `${llos_text} ${specialty_name}`;
    const ranked = chunks
      .map((c) => ({
        ...c,
        score: scoreChunk(c.content, query),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    /* =========================
       GPT #1: Generate AU
    ========================= */

    const genPrompt = `
Bạn là giảng viên ${specialty_name || "y khoa"}.

CHỈ được dùng các đoạn tài liệu bên dưới để sinh AU.
KHÔNG suy diễn ngoài tài liệu.

LLO mục tiêu:
${llos_text}

ĐOẠN TÀI LIỆU:
${ranked
  .map(
    (c) => `
[${c.id}]
${c.content}
`
  )
  .join("\n")}

YÊU CẦU:
- Sinh đúng ${auCount} Assessment Units.
- Mỗi AU = 1 mệnh đề kiểm tra được.
- Phải thuộc đúng chuyên ngành.
- Nếu không đủ dữ liệu, KHÔNG bịa.

OUTPUT JSON:
{
  "aus": [
    {
      "core_statement": "string",
      "short_explanation": "string|null",
      "bloom_min": "remember|understand|apply|analyze|evaluate|create"
    }
  ]
}
`.trim();

    const genResult = await callGPT(genPrompt);

    let aus: any[] = Array.isArray(genResult?.aus)
      ? genResult.aus
      : [];

    /* =========================
       GPT #2: Verifier
    ========================= */

    const verifyPrompt = `
Bạn là chuyên gia kiểm định nội dung y khoa.

Kiểm tra các AU sau:
${JSON.stringify(aus, null, 2)}

Đối chiếu với tài liệu:
${ranked
  .map((c) => `[${c.id}]\n${c.content}`)
  .join("\n\n")}

LOẠI BỎ hoặc SỬA các AU:
- Không có căn cứ trong tài liệu
- Sai hệ chuyên ngành
- Mơ hồ, không kiểm tra được

CHỈ TRẢ JSON:
{
  "aus": [ ... AU đã được lọc và chỉnh ... ]
}
`.trim();

    const verified = await callGPT(verifyPrompt);

    const finalAus = Array.isArray(verified?.aus)
      ? verified.aus.slice(0, auCount)
      : [];

    return NextResponse.json(
      {
        aus: finalAus,
        unsupported,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("AU-gen error:", err);
    return NextResponse.json(
      { error: "Lỗi server khi sinh AU", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
