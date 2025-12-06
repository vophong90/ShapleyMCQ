import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email, name } = await req.json();

  await resend.emails.send({
    from: "ShapleyMCQ Lab <no-reply@tradmed.edu.vn>",
    to: email,
    subject: "Chào mừng đến ShapleyMCQ Lab!",
    html: `<p>Xin chào ${name},</p><p>Chúc mừng bạn đã đăng ký thành công.</p>`,
  });

  return NextResponse.json({ success: true });
}
