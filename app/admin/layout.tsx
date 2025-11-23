import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-purple-700">
              ShapleyMCQ Lab – Admin
            </span>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/admin/users"
                className="px-2 py-1 rounded hover:bg-slate-100"
              >
                Users
              </Link>
              {/* Sau này có thể thêm: /admin/items, /admin/specialties ... */}
            </nav>
          </div>
          <div className="text-xs text-slate-500">
            <Link
              href="/dashboard"
              className="underline hover:text-slate-700"
            >
              ← Về Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
