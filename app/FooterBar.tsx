"use client";

export function FooterBar() {
  const year = new Date().getFullYear();

  return (
    <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-slate-500 flex justify-between">
      <span>© {year} ShapleyMCQ Lab</span>
      <span>Built with Next.js, Supabase &amp; Tailwind CSS</span>
    </div>
  );
}
