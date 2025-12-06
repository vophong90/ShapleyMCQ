import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || "https://shapley-mcq.vercel.app";

export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json();

    if (!email || !token) {
      return NextResponse.json({ error: "Thiếu email hoặc token" }, { status: 400 });
    }

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: "ShapleyMCQ Lab <no-reply@tradmed.edu.vn>",
      to: email,
      subject: "Khôi phục mật khẩu",
      html: `
        <p>Xin chào,</p>
        <p>Bạn yêu cầu khôi phục mật khẩu.</p>
        <p>Hãy nhấp vào liên kết sau để đặt mật khẩu mới:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
