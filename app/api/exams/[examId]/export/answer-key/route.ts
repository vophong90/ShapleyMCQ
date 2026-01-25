export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Document, Packer, Paragraph, TextRun } from "docx";

/*
  Xuất đáp án Word:
  - Mỗi dòng: Câu n: A / B / C / D...
  - Không kèm giải thích
  - Dựa trên mcq_options.is_correct = true
*/

export async function GET(
  req: NextRequest,
  { params }: { params: { examId: string } }
) {
  const supabase = getSupabaseAdmin();
  const examId = params.examId;

  try {
    /* ---------------------------------------
       1. Load exam
    --------------------------------------- */
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .select("id, title, version_no")
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
       3. Load options có đáp án đúng
    --------------------------------------- */
    const { data: correctOptions, error: optErr } = await supabase
      .from("mcq_options")
      .select("item_id, label")
      .in("item_id", mcqIds)
      .eq("is_correct", true);

    if (optErr || !correctOptions) {
      return NextResponse.json(
        { error: "Không tải được đáp án đúng" },
        { status: 500 }
      );
    }

    const answerMap = new Map<string, string[]>();
    correctOptions.forEach((o: any) => {
      const arr = answerMap.get(o.item_id) || [];
      arr.push(o.label);
      answerMap.set(o.item_id, arr);
    });

    /* ---------------------------------------
       4. Build Word document
    --------------------------------------- */
    const paragraphs: Paragraph[] = [];

    // Tiêu đề
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: exam.title
              ? `Đáp án – ${exam.title} (Version ${exam.version_no})`
              : `Đáp án – Version ${exam.version_no}`,
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Danh sách đáp án
    examItems.forEach((item: any, index: number) => {
      const labels = answerMap.get(item.mcq_item_id) || [];
      const answerText = labels.length
        ? labels.join(", ")
        : "[Chưa có đáp án]";

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Câu ${index + 1}: ${answerText}`,
            }),
          ],
        })
      );
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    const filename = `Exam_${examId.slice(0, 8)}_V${exam.version_no}_DapAn.docx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("Export answer key error:", e);
    return NextResponse.json(
      { error: e.message || "Lỗi khi xuất đáp án Word" },
      { status: 500 }
    );
  }
}
