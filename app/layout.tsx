import "./../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "ShapleyMCQ Lab",
  description: "AI-driven MCQ generation with Shapley & Monte Carlo"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="min-h-screen flex flex-col">
          {/* Top nav */}
          <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm">
                  S
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    ShapleyMCQ Lab
                  </div>
                  <div className="text-xs text-slate-500">
                    AU → Misconceptions → MCQ → Monte Carlo → Shapley
                  </div>
                </div>
              </div>
              <nav className="flex items-center gap-3 text-sm">
                <a href="/" className="text-slate-600 hover:text-brand-600">
                  Home
                </a>
                <a
                  href="/dashboard"
                  className="text-slate-600 hover:text-brand-600"
                >
                  Dashboard
                </a>
                <a
                  href="/login"
                  className="text-slate-600 hover:text-brand-600"
                >
                  Đăng nhập
                </a>
                <a
                  href="/register"
                  className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
                >
                  Đăng ký
                </a>
              </nav>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">{children}</main>

          {/* Footer */}
          <footer className="border-t bg-white">
            <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-slate-500 flex justify-between">
              <span>© {new Date().getFullYear()} ShapleyMCQ Lab</span>
              <span>Built with Next.js, Supabase & Tailwind CSS</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
