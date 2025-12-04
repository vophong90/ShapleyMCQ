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

// PPTX
async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });

  let allText: string[] = [];

  // Các slide nằm trong ppt/slides/slideX.xml
  const slideFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name)
  );

  for (const slideName of slideFiles) {
    const file = zip.file(slideName);
    if (!file) continue;

    const xmlString = await file.async("string");
    const json = xmlParser.parse(xmlString);

    // Duyệt json để gom tất cả string leaves
    const texts: string[] = [];

    function collectStrings(node: any) {
      if (node == null) return;
      if (typeof node === "string") {
        const trimmed = node.trim();
        if (trimmed) texts.push(trimmed);
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) collectStrings(item);
        return;
      }
      if (typeof node === "object") {
        for (const key of Object.keys(node)) {
          collectStrings(node[key]);
        }
      }
    }

    collectStrings(json);
    if (texts.length > 0) {
      allText.push(texts.join(" "));
    }
  }

  return allText.join("\n\n");
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
