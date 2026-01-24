// app/admin/_components/adminNav.ts
export type AdminNavItem = {
  href: string;
  label: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/books", label: "Books" },
];
