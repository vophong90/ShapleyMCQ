import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    const { data, error } = await supabaseAdmin.auth.admin.generatePasswordResetCode(email);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // data.action_link chứa token reset password
    const token = new URL(data.action_link).searchParams.get("token");

    return NextResponse.json({ token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
