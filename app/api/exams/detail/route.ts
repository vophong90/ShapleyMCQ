import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteClient();

    // 1) Check login
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }

    // 2) Get exam_id
    const { searchParams } = new URL(req.url);
    const exam_id = searchParams.get("exam_id");
    if (!exam_id) {
      return NextResponse.json({ error: "exam_id là bắt buộc" }, { status: 400 });
    }

    // 3) Load exam (RLS sẽ tự chặn nếu không phải owner)
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .select("id, title, blueprint_id, owner_id, course_id, created_at")
      .eq("id", exam_id)
      .single();

    if (examErr || !exam) {
      return NextResponse.json(
        { error: "Không tìm thấy đề thi hoặc bạn không có quyền xem." },
        { status: 404 }
      );
    }

    // 4) Load items + join mcq_items để lấy stem/options
    const { data: rows, error: itemsErr } = await supabase
      .from("exam_mcq_items")
      .select(`
        item_order,
        llo_id,
        mcq_item_id,
        mcq_items (
          id,
          stem,
          options_json
        )
      `)
      .eq("exam_id", exam_id)
      .order("item_order", { ascending: true });

    if (itemsErr) throw itemsErr;

    const items = (rows || []).map((r: any) => ({
      item_order: r.item_order,
      llo_id: r.llo_id,
      mcq_item_id: r.mcq_item_id,
      stem: r.mcq_items?.stem ?? "",
      options: r.mcq_items?.options_json ?? [],
    }));

    return NextResponse.json({ success: true, exam, items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Không tải được đề thi." },
      { status: 500 }
    );
  }
}
