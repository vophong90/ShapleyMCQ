// app/admin/layout.tsx
import type { ReactNode } from "react";
import AdminGuard from "./AdminGuard";

export const metadata = {
  title: "Admin – ShapleyMCQ Lab",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </div>
    </AdminGuard>
  );
}
