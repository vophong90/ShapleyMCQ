import "./globals.css";
import type { ReactNode } from "react";
import { MainNav } from "./NavBar";
import { FooterBar } from "./FooterBar";

export const metadata = {
  title: "ShapleyMCQ Lab",
  description: "AI-driven MCQ generation with Shapley & Monte Carlo",
  icons: {
    icon: "/favicon-16.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
            <MainNav />
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t bg-white">
            <FooterBar />
          </footer>
        </div>
      </body>
    </html>
  );
}
