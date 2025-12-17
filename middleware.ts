// middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware tối thiểu:
 * - KHÔNG chặn các API tool như au-gen, file-extract
 * - KHÔNG đụng Supabase auth
 * - Chỉ định rõ matcher để tránh Edge default policy
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Cho phép toàn bộ API tools (RAG, GPT, upload)
  if (
    pathname.startsWith("/api/au-gen") ||
    pathname.startsWith("/api/file-extract") ||
    pathname.startsWith("/api/ping")
  ) {
    return NextResponse.next();
  }

  // ⚠️ Mọi route khác: không can thiệp
  return NextResponse.next();
}

/**
 * ⚠️ CỰC KỲ QUAN TRỌNG
 * Nếu không có matcher, Next/Vercel sẽ dùng default = dễ sinh 403
 */
export const config = {
  matcher: [
    /*
     * Áp middleware cho TẤT CẢ request
     * để override default Edge behavior
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
