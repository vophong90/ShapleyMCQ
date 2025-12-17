// app/api/file-extract/route.ts
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";

// Helper: đọc Buffer từ File (formData)
async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// TXT
async function extractTxt(file: File): Promise<string> {
  const text = await file.text();
  return text || "";
}

// PDF
async function extractPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || "";
}

// DOCX
async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

// PPTX (cleaner): chỉ lấy text runs (a:t) + giữ thứ tự slide
async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  // preserveOrder giúp giữ thứ tự xuất hiện trong XML => text ra "đọc được" hơn
  const xmlParser = new XMLParser({
    ignoreAttributes: true,
    trimValues: true,
    preserveOrder: true,
  });

  let allSlidesText: string[] = [];

  // ✅ Sort slide theo số thứ tự (slide1, slide2, ...)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
      return na - nb;
    });

  // Walk tree preserveOrder: node dạng [{ "p:sld": [...] }, { "a:t": [{ "#text": "..." }] }, ...]
  function walkPreserveOrder(node: any, out: string[]) {
    if (node == null) return;

    if (Array.isArray(node)) {
      for (const it of node) walkPreserveOrder(it, out);
      return;
    }

    if (typeof node !== "object") return;

    for (const key of Object.keys(node)) {
      const val = node[key];

      // ✅ Lấy đúng text run
      if (key === "a:t") {
        // val thường là mảng, mỗi phần là { "#text": "..." }
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

      // xuống dòng: a:br (line break)
      if (key === "a:br") {
        out.push("\n");
        continue;
      }

      // đoạn mới: a:p (paragraph) -> sau khi duyệt xong, chèn newline
      if (key === "a:p") {
        // duyệt nội dung trong paragraph
        const beforeLen = out.length;
        walkPreserveOrder(val, out);
        // nếu paragraph có text mới thì xuống dòng
        if (out.length > beforeLen) out.push("\n");
        continue;
      }

      walkPreserveOrder(val, out);
    }
  }

  for (const slideName of slideFiles) {
    const f = zip.file(slideName);
    if (!f) continue;

    const xmlString = await f.async("string");
    const parsed = xmlParser.parse(xmlString);

    const tokens: string[] = [];
    walkPreserveOrder(parsed, tokens);

    // cleanup spacing/newlines
    const text = tokens
      .join(" ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text) allSlidesText.push(text);
  }

  return allSlidesText.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files: File[] = [];

    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy file nào trong request." },
        { status: 400 }
      );
    }

    const texts: string[] = [];
    const unsupported: { name: string; reason: string }[] = [];

    for (const file of files) {
      const name = file.name || "unknown";
      const ext = name.split(".").pop()?.toLowerCase() || "";

      try {
        if (ext === "txt") {
          const text = await extractTxt(file);
          texts.push(`===== FILE: ${name} =====\n${text}`);
        } else if (ext === "pdf") {
          const buf = await fileToBuffer(file);
          const text = await extractPdf(buf);
          texts.push(`===== FILE: ${name} =====\n${text}`);
        } else if (ext === "docx") {
          const buf = await fileToBuffer(file);
          const text = await extractDocx(buf);
          texts.push(`===== FILE: ${name} =====\n${text}`);
        } else if (ext === "pptx") {
          const buf = await fileToBuffer(file);
          const text = await extractPptx(buf);
          texts.push(`===== FILE: ${name} =====\n${text}`);
        } else {
          unsupported.push({
            name,
            reason:
              "Định dạng chưa hỗ trợ. Vui lòng dùng .pdf, .docx, .pptx hoặc .txt",
          });
        }
      } catch (e: any) {
        console.error(`Lỗi parse file ${name}:`, e);
        unsupported.push({
          name,
          reason: "Lỗi khi trích xuất nội dung file.",
        });
      }
    }

    const combinedText = texts.join("\n\n\n");

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
