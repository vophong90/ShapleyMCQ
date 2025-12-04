// app/api/auth/session/route.ts
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Invalid Authorization header" },
      { status: 401 }
    );
  }

  // ⚠️ LƯU Ý QUAN TRỌNG:
  // API SỬ DỤNG SERVICE ROLE KEY để xác thực token trên server
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // đúng nhất cho route server
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Kiểm tra token và lấy user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const res = NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
  });

  // Gửi userId qua header để các API khác dùng
  res.headers.set("Authorization", `Bearer ${user.id}`);

  return res;
}
