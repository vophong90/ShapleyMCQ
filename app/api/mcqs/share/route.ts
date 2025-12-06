// app/api/mcq/share/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ShareRequestBody = {
  to_profile_id?: string;
  mcq_item_ids?: string[];
};

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Thiếu Authorization header" },
        { status: 401 }
      );
    }

    const fromUserId = authHeader.replace("Bearer ", "").trim();
    if (!fromUserId) {
      return NextResponse.json(
        { error: "Authorization header không hợp lệ" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ShareRequestBody;
    const toProfileId = body.to_profile_id;
    const mcqItemIds = Array.isArray(body.mcq_item_ids)
      ? body.mcq_item_ids.filter(Boolean)
      : [];

    if (!toProfileId) {
      return NextResponse.json(
        { error: "to_profile_id là bắt buộc" },
        { status: 400 }
      );
    }

    if (!mcqItemIds.length) {
      return NextResponse.json(
        { error: "mcq_item_ids[] trống" },
        { status: 400 }
      );
    }

    if (toProfileId === fromUserId) {
      return NextResponse.json(
        { error: "Không thể chia sẻ MCQ cho chính mình" },
        { status: 400 }
      );
    }

    // 1. Kiểm tra các MCQ đều thuộc sở hữu fromUserId
    const { data: mcqRows, error: mcqErr } = await supabase
      .from("mcq_items")
      .select("id, owner_id")
      .in("id", mcqItemIds);

    if (mcqErr) {
      console.error("Error fetching mcq_items:", mcqErr);
      return NextResponse.json(
        { error: "Không lấy được danh sách MCQ" },
        { status: 500 }
      );
    }

    if (!mcqRows || !mcqRows.length) {
      return NextResponse.json(
        { error: "Không tìm thấy MCQ nào phù hợp" },
        { status: 400 }
      );
    }

    // kiểm tra owner
    const invalidOwner = mcqRows.find((m) => m.owner_id !== fromUserId);
    if (invalidOwner) {
      return NextResponse.json(
        {
          error:
            "Bạn chỉ được phép chia sẻ MCQ mà bạn là owner. Có MCQ không thuộc quyền sở hữu.",
        },
        { status: 403 }
      );
    }

    // 2. Insert mcq_item_shares (tránh duplicate bằng cách lọc trước)
    // Có thể xoá duplicates theo (mcq_item_id, from_user_id, to_user_id) tuỳ ý
    const payload = mcqItemIds.map((id) => ({
      mcq_item_id: id,
      from_user_id: fromUserId,
      to_user_id: toProfileId,
      can_edit: false,
    }));

    const { error: insertErr } = await supabase
      .from("mcq_item_shares")
      .insert(payload);

    if (insertErr) {
      console.error("Error inserting mcq_item_shares:", insertErr);
      return NextResponse.json(
        { error: "Lỗi khi lưu chia sẻ MCQ" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: `Đã chia sẻ ${mcqItemIds.length} MCQ cho user ${toProfileId}`,
        count: mcqItemIds.length,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Unexpected error in /api/mcq/share:", e);
    return NextResponse.json(
      { error: e.message ?? "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
