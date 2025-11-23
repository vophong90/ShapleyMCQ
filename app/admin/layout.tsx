"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname ? pathname.startsWith(href) : false;

  return (
    <Link
      href={href}
      className={
        "px-2 py-1 rounded text-sm " +
        (active
          ? "bg-slate-900 text-white"
          : "hover:bg-slate-100 text-slate-700")
      }
    >
      {children}
    </Link>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg text-purple-700">
              ShapleyMCQ Lab – Admin
            </span>
            <nav className="flex items-center gap-2">
              <NavLink href="/admin/users">Users</NavLink>
              <NavLink href="/admin/items">MCQ Bank</NavLink>
              <NavLink href="/admin/blueprints">Blueprint &amp; Export</NavLink>
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
