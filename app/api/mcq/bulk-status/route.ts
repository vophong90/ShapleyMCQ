// app/api/mcq/bulk-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  mcq_item_ids?: string[];
  status?: "draft" | "approved";
};

function isValidStatus(s: any): s is "draft" | "approved" {
  return s === "draft" || s === "approved";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getRouteClient();

    // Auth
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    const uid = auth.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const ids = Array.isArray(body.mcq_item_ids) ? body.mcq_item_ids : [];
    const status = body.status;

    if (!ids.length) {
      return NextResponse.json(
        { error: "mcq_item_ids[] là bắt buộc." },
        { status: 400 }
      );
    }
    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: 'status chỉ nhận "draft" | "approved".' },
        { status: 400 }
      );
    }

    // Bulk update (owner-only)
    const { data: updatedRows, error: upErr } = await supabase
      .from("mcq_items")
      .update({ status, updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("owner_id", uid)
      .select("id");

    if (upErr) throw upErr;

    const updatedCount = (updatedRows || []).length;

    return NextResponse.json({
      message:
        updatedCount > 0
          ? `Đã cập nhật trạng thái cho ${updatedCount} MCQ.`
          : "Không có MCQ nào được cập nhật (có thể bạn không phải owner hoặc id không hợp lệ).",
      updated_count: updatedCount,
      status,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Lỗi khi cập nhật trạng thái MCQ." },
      { status: 500 }
    );
  }
}
