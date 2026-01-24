// app/admin/_components/AdminTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "./adminNav";

function isActive(pathname: string, href: string) {
  // active cho đúng nhóm route
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ADMIN_NAV.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition " +
              (active
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:border-brand-400 hover:text-brand-700")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
