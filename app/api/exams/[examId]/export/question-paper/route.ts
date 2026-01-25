// app/api/exams/[examId]/export/question-paper/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Document, Packer, Paragraph, TextRun } from "docx";

/*
  Xuất đề thi Word:
  - Lấy exam theo examId
  - Load danh sách câu theo item_order
  - Mỗi câu:
      Câu n.
      Stem
      A. option
      B. option
      C. option
      ...
  - Không có đáp án
*/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const supabase = getSupabaseAdmin();

  // Next.js 15+: params là Promise -> phải await
  const { examId } = await params;

  try {
    /* ---------------------------------------
       1. Load exam
    --------------------------------------- */
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .select("id, title, owner_id, version_no")
      .eq("id", examId)
      .single();

    if (examErr || !exam) {
      return NextResponse.json(
        { error: "Không tìm thấy exam" },
        { status: 404 }
      );
    }

    /* ---------------------------------------
       2. Load exam_mcq_items theo thứ tự
    --------------------------------------- */
    const { data: examItems, error: itemsErr } = await supabase
      .from("exam_mcq_items")
      .select("mcq_item_id, item_order")
      .eq("exam_id", examId)
      .order("item_order", { ascending: true });

    if (itemsErr || !examItems || examItems.length === 0) {
      return NextResponse.json(
        { error: "Không có câu hỏi nào trong đề" },
        { status: 404 }
      );
    }

    const mcqIds = examItems.map((i: any) => i.mcq_item_id);

    /* ---------------------------------------
       3. Load MCQ stem
    --------------------------------------- */
    const { data: mcqs, error: mcqErr } = await supabase
      .from("mcq_items")
      .select("id, stem")
      .in("id", mcqIds);

    if (mcqErr || !mcqs) {
      return NextResponse.json(
        { error: "Không tải được nội dung câu hỏi" },
        { status: 500 }
      );
    }

    const mcqMap = new Map<string, { stem: string }>();
    mcqs.forEach((m: any) => mcqMap.set(m.id, { stem: m.stem }));

    /* ---------------------------------------
       4. Load options
    --------------------------------------- */
    const { data: options, error: optErr } = await supabase
      .from("mcq_options")
      .select("item_id, label, text")
      .in("item_id", mcqIds)
      .order("label", { ascending: true });

    if (optErr || !options) {
      return NextResponse.json(
        { error: "Không tải được phương án trả lời" },
        { status: 500 }
      );
    }

    const optionMap = new Map<string, { label: string; text: string }[]>();
    options.forEach((o: any) => {
      const arr = optionMap.get(o.item_id) || [];
      arr.push({ label: o.label, text: o.text });
      optionMap.set(o.item_id, arr);
    });

    /* ---------------------------------------
       5. Build Word document
    --------------------------------------- */
    const paragraphs: Paragraph[] = [];

    // Tiêu đề đề thi
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: exam.title || `Đề thi – Version ${exam.version_no}`,
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Nội dung câu hỏi
    examItems.forEach((item: any, index: number) => {
      const mcq = mcqMap.get(item.mcq_item_id);
      const opts = optionMap.get(item.mcq_item_id) || [];

      // Câu hỏi
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Câu ${index + 1}. ${mcq?.stem || "[Không có nội dung]"}`,
              bold: true,
            }),
          ],
          spacing: { after: 120 },
        })
      );

      // Các phương án
      opts.forEach((opt) => {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `${opt.label}. ${opt.text}` })],
            indent: { left: 720 },
          })
        );
      });

      // Dòng trống giữa các câu
      paragraphs.push(new Paragraph({}));
    });

    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    });

    const buffer = await Packer.toBuffer(doc);

    const filename = `Exam_${examId.slice(0, 8)}_V${exam.version_no}_DeThi.docx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("Export question paper error:", e);
    return NextResponse.json(
      { error: e?.message || "Lỗi khi xuất đề Word" },
      { status: 500 }
    );
  }
}
