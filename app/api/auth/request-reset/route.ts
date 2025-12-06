// app/api/auth/request-reset/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const email = (body.email || "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email là bắt buộc." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1) Tìm user theo email trong profiles (anh đang dùng profiles làm bảng chính)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email, name")
      .eq("email", email)
      .single();

    if (profileErr || !profile) {
      // Không tiết lộ là email có tồn tại hay không
      console.error("request-reset: email không tìm thấy hoặc lỗi:", profileErr);
      return NextResponse.json({ success: true });
    }

    const userId = profile.id as string;

    // 2) Tạo token ngẫu nhiên + hạn sử dụng
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 giờ

    const { error: insertErr } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertErr) {
      console.error("Lỗi insert password_reset_tokens:", insertErr);
      return NextResponse.json(
        { error: "Không tạo được token đặt lại mật khẩu." },
        { status: 500 }
      );
    }

    // 3) Tạo link reset
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `http://localhost:3000`;

    const resetLink = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;

    // 4) Gửi email bằng Resend (nếu có key)
    if (!process.env.RESEND_API_KEY) {
      console.error("Thiếu RESEND_API_KEY, không gửi email được.");
    } else {
      await resend.emails.send({
        from: "ShapleyMCQ Lab <no-reply@tradmed.edu.vn>",
        to: email,
        subject: "Đặt lại mật khẩu ShapleyMCQ Lab",
        html: `
          <p>Xin chào ${profile.name || ""},</p>
          <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản ShapleyMCQ Lab.</p>
          <p>Nhấn vào đường link sau để đặt lại mật khẩu (hiệu lực trong 1 giờ):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Nếu bạn không yêu cầu, có thể bỏ qua email này.</p>
        `,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error in /api/auth/request-reset:", err);
    return NextResponse.json(
      { error: "Không tạo được token đặt lại mật khẩu." },
      { status: 500 }
    );
  }
}
