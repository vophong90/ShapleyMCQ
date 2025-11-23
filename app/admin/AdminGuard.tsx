// app/admin/AdminGuard.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

type GuardState = "checking" | "allowed";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
};

export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    async function checkAdmin() {
      // 1. Lấy user hiện tại
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        // Chưa đăng nhập → về /login kèm next=/admin
        router.replace("/login?next=/admin");
        return;
      }

      // 2. Lấy role từ profiles
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select<"id, email, name, role">("id, email, name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !data) {
        router.replace("/?denied=1&reason=no-profile");
        return;
      }

      const profile = data as unknown as Profile;

      if (profile.role === "admin") {
        setState("allowed");
      } else {
        router.replace("/?denied=1&reason=not-admin");
      }
    }

    checkAdmin();
  }, [router]);

  if (state === "checking") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-slate-600">
        Đang kiểm tra quyền truy cập admin…
      </div>
    );
  }

  return <>{children}</>;
}
