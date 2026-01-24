// app/admin/layout.tsx
import type { ReactNode } from "react";
import AdminGuard from "./AdminGuard";
import AdminShell from "./_components/AdminShell";

export const metadata = {
  title: "Admin – ShapleyMCQ Lab",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
