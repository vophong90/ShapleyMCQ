import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Lấy session từ client cookie
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "No session" },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // Trả userId trong Header Authorization
  const res = NextResponse.json({ ok: true });
  res.headers.set("Authorization", `Bearer ${userId}`);
  return res;
}
