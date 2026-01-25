// app/api/exams/[examId]/route.ts
import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Helper: lấy Supabase client + user từ cookie (giống các route khác dùng getRouteClient)
 */
async function getUserAndClient() {
  const supabase = await getRouteClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.user) {
    throw new Error("Chưa đăng nhập");
  }

  return { supabase, user: data.user };
}

/**
 * GET /api/exams/:examId
 * -> Trả về thông tin cơ bản của exam (dùng cho trang phân tích đề nếu cần).
 * Không bắt buộc FE hiện tại, nhưng tiện để sau này dùng.
 */
export async function GET(_req: Request, context: any) {
  try {
    const examId: string | undefined = context?.params?.examId;
    if (!examId) {
      return NextResponse.json(
        { success: false, error: "Thiếu examId" },
        { status: 400 }
      );
    }

    const { supabase } = await getUserAndClient();

    const { data, error } = await supabase
      .from("exams")
      .select("id, blueprint_id, version_no, title, created_at")
      .eq("id", examId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy exam" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, exam: data });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exams/:examId
 * -> Dùng cho nút "Xoá" version trong trang blueprint.
 *   exam_mcq_items đã có ON DELETE CASCADE nên sẽ tự xoá theo.
 */
export async function DELETE(_req: Request, context: any) {
  try {
    const examId: string | undefined = context?.params?.examId;
    if (!examId) {
      return NextResponse.json(
        { success: false, error: "Thiếu examId" },
        { status: 400 }
      );
    }

    const { supabase } = await getUserAndClient();

    const { error } = await supabase
      .from("exams")
      .delete()
      .eq("id", examId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
