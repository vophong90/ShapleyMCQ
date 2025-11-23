import "./globals.css";
import type { ReactNode } from "react";
import { MainNav } from "./NavBar";

export const metadata = {
  title: "ShapleyMCQ Lab",
  description: "AI-driven MCQ generation with Shapley & Monte Carlo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="min-h-screen flex flex-col">
          {/* Top nav */}
          <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
            <MainNav />
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
