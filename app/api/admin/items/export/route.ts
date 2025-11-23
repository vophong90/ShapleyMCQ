import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "approved";
    const bloom = url.searchParams.get("bloom") || "all";
    const specId = url.searchParams.get("specialty_id") || "all";

    const admin = getSupabaseAdmin();

    // 1. Lấy items
    let query = admin
      .from("mcq_items")
      .select(
        "id, stem, correct_answer, explanation, bloom_level, learner_level, status, specialty_id"
      );

    if (status !== "all") query = query.eq("status", status);
    if (bloom !== "all" && bloom !== "none")
      query = query.eq("bloom_level", bloom);
    if (bloom === "none") query = query.is("bloom_level", null);
    if (specId !== "all" && specId !== "none")
      query = query.eq("specialty_id", specId);
    if (specId === "none") query = query.is("specialty_id", null);

    const { data: items, error: itemsErr } = await query;

    if (itemsErr) {
      return NextResponse.json(
        { error: "Lỗi lấy MCQ items", detail: itemsErr.message },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      const emptyCsv = "message\nNo items found for given filters.\n";
      return new NextResponse(emptyCsv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="mcq_export_empty.csv"',
        },
      });
    }

    const itemIds = items.map((it) => it.id);

    // 2. Lấy specialties để map code
    const { data: specs } = await admin
      .from("specialties")
      .select("id, code, name");
    const specMap: Record<string, { code: string; name: string }> = {};
    (specs || []).forEach((s) => {
      specMap[s.id] = { code: s.code, name: s.name };
    });

    // 3. Lấy options
    const { data: options, error: optErr } = await admin
      .from("mcq_options")
      .select("mcq_id, text, is_correct")
      .in("mcq_id", itemIds);

    if (optErr) {
      return NextResponse.json(
        { error: "Lỗi lấy MCQ options", detail: optErr.message },
        { status: 500 }
      );
    }

    const optMap: Record<
      string,
      { correct: string | null; distractors: string[] }
    > = {};

    (options || []).forEach((o: any) => {
      const key = o.mcq_id;
      if (!optMap[key]) {
        optMap[key] = { correct: null, distractors: [] };
      }
      if (o.is_correct) {
        optMap[key].correct = o.text;
      } else {
        optMap[key].distractors.push(o.text);
      }
    });

    // 4. Tạo CSV
    const header = [
      "id",
      "specialty_code",
      "specialty_name",
      "bloom_level",
      "learner_level",
      "status",
      "stem",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
      "correct_label",
      "explanation",
    ];

    const rows: string[] = [];

    function csvEscape(value: any): string {
      if (value === null || value === undefined) return "";
      const s = String(value);
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    rows.push(header.join(","));

    for (const it of items as any[]) {
      const { correct, distractors } = optMap[it.id] || {
        correct: it.correct_answer || null,
        distractors: [],
      };

      // A–D: correct trước, rồi các distractor
      const optionsOrdered: string[] = [];
      if (correct) optionsOrdered.push(correct);
      optionsOrdered.push(...distractors);
      while (optionsOrdered.length < 4) {
        optionsOrdered.push("");
      }
      const [optA, optB, optC, optD] = optionsOrdered.slice(0, 4);

      // correct_label: A/B/C/D nếu match text, ngược lại để trống
      let correctLabel = "";
      if (correct) {
        if (correct === optA) correctLabel = "A";
        else if (correct === optB) correctLabel = "B";
        else if (correct === optC) correctLabel = "C";
        else if (correct === optD) correctLabel = "D";
      }

      const spec = it.specialty_id ? specMap[it.specialty_id] : null;
      const specialty_code = spec ? spec.code : "";
      const specialty_name = spec ? spec.name : "";

      const row = [
        csvEscape(it.id),
        csvEscape(specialty_code),
        csvEscape(specialty_name),
        csvEscape(it.bloom_level || ""),
        csvEscape(it.learner_level || ""),
        csvEscape(it.status || ""),
        csvEscape(it.stem || ""),
        csvEscape(optA),
        csvEscape(optB),
        csvEscape(optC),
        csvEscape(optD),
        csvEscape(correctLabel),
        csvEscape(it.explanation || ""),
      ];

      rows.push(row.join(","));
    }

    const csv = rows.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="mcq_export.csv"',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lỗi export MCQ CSV", detail: String(err) },
      { status: 500 }
    );
  }
}
