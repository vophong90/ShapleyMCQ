// app/api/file-extract/route.ts
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================
   Utils
========================================= */

function cleanTextBlock(text: string) {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeExt(name?: string, ext?: string) {
  const e =
    (ext || "").toLowerCase().trim() ||
    (name?.split(".").pop() || "").toLowerCase().trim();
  return e;
}

function base64ToBuffer(b64: string): Buffer {
  // Cho phép data URL hoặc base64 thuần
  const s = (b64 || "").trim();
  if (!s) return Buffer.alloc(0);

  const m = s.match(/^data:.*?;base64,(.+)$/);
  const raw = m ? m[1] : s;
  return Buffer.from(raw, "base64");
}

/* =========================================
   Extractors (server-side, from Buffer)
========================================= */

async function extractPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractTxtFromBuffer(buffer: Buffer): Promise<string> {
  return buffer.toString("utf8") || "";
}

// PPTX (cleaner): chỉ lấy text runs (a:t) + giữ thứ tự slide
async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  const xmlParser = new XMLParser({
    ignoreAttributes: true,
    trimValues: true,
    preserveOrder: true,
  });

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
      return na - nb;
    });

  function walk(node: any, out: string[]) {
    if (node == null) return;

    if (Array.isArray(node)) {
      for (const it of node) walk(it, out);
      return;
    }
    if (typeof node !== "object") return;

    for (const key of Object.keys(node)) {
      const val = node[key];

      if (key === "a:t") {
        if (Array.isArray(val)) {
          for (const v of val) {
            const t = (v?.["#text"] ?? "").toString().trim();
            if (t) out.push(t);
          }
        } else {
          const t = (val?.["#text"] ?? "").toString().trim();
          if (t) out.push(t);
        }
        continue;
      }

      if (key === "a:br") {
        out.push("\n");
        continue;
      }

      if (key === "a:p") {
        const before = out.length;
        walk(val, out);
        if (out.length > before) out.push("\n");
        continue;
      }

      walk(val, out);
    }
  }

  const slidesText: string[] = [];

  for (const slideName of slideFiles) {
    const f = zip.file(slideName);
    if (!f) continue;

    const xml = await f.async("string");
    const parsed = xmlParser.parse(xml);

    const tokens: string[] = [];
    walk(parsed, tokens);

    const text = cleanTextBlock(tokens.join(" "));
    if (text) slidesText.push(text);
  }

  return slidesText.join("\n\n");
}

/* =========================================
   API: POST JSON { files: [{name, ext, data_base64}] }
   (No multipart to avoid 413)
========================================= */

type InFile = {
  name: string;
  ext?: string; // optional, will be derived from name if missing
  data_base64: string; // base64 or data:url
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const files: InFile[] = Array.isArray(body?.files) ? body.files : [];

    if (!files.length) {
      return NextResponse.json(
        { error: "Thiếu files[]. Gửi JSON { files: [{name, ext?, data_base64}] }" },
        { status: 400 }
      );
    }

    const texts: string[] = [];
    const unsupported: { name: string; reason: string }[] = [];

    for (const f of files) {
      const name = (f?.name || "unknown").toString();
      const ext = normalizeExt(name, f?.ext);
      const b64 = (f?.data_base64 || "").toString();

      if (!b64) {
        unsupported.push({ name, reason: "Thiếu data_base64." });
        continue;
      }

      let buf: Buffer;
      try {
        buf = base64ToBuffer(b64);
      } catch {
        unsupported.push({ name, reason: "data_base64 không hợp lệ." });
        continue;
      }

      if (!buf || buf.length === 0) {
        unsupported.push({ name, reason: "Nội dung rỗng hoặc decode base64 thất bại." });
        continue;
      }

      try {
        let text = "";

        if (ext === "txt") {
          text = await extractTxtFromBuffer(buf);
        } else if (ext === "pdf") {
          text = await extractPdf(buf);
        } else if (ext === "docx") {
          text = await extractDocx(buf);
        } else if (ext === "pptx") {
          text = await extractPptx(buf);
        } else {
          unsupported.push({
            name,
            reason: "Định dạng chưa hỗ trợ. Dùng .pdf, .docx, .pptx hoặc .txt",
          });
          continue;
        }

        text = cleanTextBlock(text);
        if (text) texts.push(`===== FILE: ${name} =====\n${text}`);
        else {
          unsupported.push({ name, reason: "Trích xuất được nhưng không có text (có thể là file scan/ảnh)." });
        }
      } catch (e: any) {
        console.error(`Lỗi parse file ${name}:`, e);
        unsupported.push({ name, reason: "Lỗi khi trích xuất nội dung file." });
      }
    }

    const combinedText = cleanTextBlock(texts.join("\n\n\n"));

    if (!combinedText.trim()) {
      return NextResponse.json(
        {
          error: "Không trích xuất được nội dung từ file.",
          unsupported,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        text: combinedText,
        unsupported,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Lỗi server /api/file-extract:", err);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
