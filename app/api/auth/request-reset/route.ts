// app/api/auth/request-reset/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email as string | undefined)?.trim();

    if (!email) {
      return NextResponse.json(
        { error: "Thiếu email" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Tìm profile theo email
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email, name")
      .eq("email", email)
      .single();

    // Vì lý do bảo mật: nếu không tìm thấy user thì vẫn trả success
    if (profileErr || !profile) {
      console.warn("Không tìm thấy profile cho email reset:", email, profileErr);
      return NextResponse.json({ success: true });
    }

    const userId = profile.id as string;

    // 2. Tạo token reset ngẫu nhiên
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 phút

    // 3. Lưu token vào bảng password_reset_tokens (onConflict theo user_id)
    const { error: upsertErr } = await supabase
      .from("password_reset_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          used: false,
          expires_at: expiresAt,
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      console.error("Lỗi upsert password_reset_tokens:", upsertErr);
      return NextResponse.json(
        { error: "Không tạo được token đặt lại mật khẩu." },
        { status: 500 }
      );
    }

    // 4. Gửi email bằng Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "ShapleyMCQ Lab <no-reply@tradmed.edu.vn>";
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    if (!resendApiKey) {
      console.error("Thiếu RESEND_API_KEY trong env");
      return NextResponse.json(
        { error: "Thiếu cấu hình gửi email" },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Đặt lại mật khẩu ShapleyMCQ Lab",
      html: `
        <p>Xin chào ${profile.name || ""},</p>
        <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản ShapleyMCQ Lab.</p>
        <p>Nhấn vào nút bên dưới trong vòng <b>60 phút</b> để đặt lại mật khẩu:</p>
        <p>
          <a href="${resetUrl}"
             style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;display:inline-block;">
            Đặt lại mật khẩu
          </a>
        </p>
        <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Lỗi không xác định trong /api/auth/request-reset:", e);
    return NextResponse.json(
      { error: "Lỗi không xác định khi tạo yêu cầu reset." },
      { status: 500 }
    );
  }
}
