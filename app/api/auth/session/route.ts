import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.headers.get("cookie") ?? "";
        }
      }
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const userId = session.user.id;
  const res = NextResponse.json({ ok: true });
  res.headers.set("Authorization", `Bearer ${userId}`);
  return res;
}
