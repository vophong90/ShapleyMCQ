// app/admin/_components/AdminShell.tsx
"use client";

import type { ReactNode } from "react";
import AdminTabs from "./AdminTabs";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Admin
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              ShapleyMCQ Lab
            </h1>
          </div>

          <AdminTabs />
        </div>

        <div className="h-px bg-slate-200" />
      </div>

      {children}
    </div>
  );
}
