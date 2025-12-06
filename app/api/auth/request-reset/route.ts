// app/api/auth/request-reset/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email không hợp lệ." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Tìm user theo email trong bảng profiles
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("email", email)
      .single();

    // Không lộ thông tin tồn tại hay không tồn tại email
    if (profileErr || !profile) {
      return NextResponse.json(
        {
          success: true,
          message:
            "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu sẽ được gửi.",
        },
        { status: 200 }
      );
    }

    const userId = profile.id as string;
    const name = (profile.name as string) || "bạn";

    // 2. Tạo token reset
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    // 3. Lưu vào bảng password_reset_tokens
    // Bảng gợi ý:
    // create table public.password_reset_tokens (
    //   id uuid default gen_random_uuid() primary key,
    //   user_id uuid not null references auth.users(id) on delete cascade,
    //   token text not null unique,
    //   expires_at timestamptz not null,
    //   used_at timestamptz,
    //   created_at timestamptz not null default now()
    // );
    const { error: insertErr } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error("Error inserting reset token:", insertErr);
      return NextResponse.json(
        { error: "Không tạo được token đặt lại mật khẩu." },
        { status: 500 }
      );
    }

    // 4. Gửi email bằng Resend
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY chưa được cấu hình.");
      return NextResponse.json(
        { error: "Email server chưa được cấu hình." },
        { status: 500 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await resend.emails.send({
      from: "ShapleyMCQ Lab <no-reply@tradmed.edu.vn>",
      to: email,
      subject: "Đặt lại mật khẩu ShapleyMCQ Lab",
      html: `
        <p>Xin chào ${name},</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản ShapleyMCQ Lab.</p>
        <p>Vui lòng bấm vào liên kết sau để đặt lại mật khẩu (có hiệu lực trong 1 giờ):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
      `,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.",
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Error in /api/auth/request-reset:", e);
    return NextResponse.json(
      { error: e.message ?? "Lỗi không xác định." },
      { status: 500 }
    );
  }
}
