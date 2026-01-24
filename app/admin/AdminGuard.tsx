// app/admin/AdminGuard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

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

  // ✅ 1 instance duy nhất cho cả page
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      setState("checking");

      // 1) Lấy user hiện tại
      const { data, error: userError } = await supabase.auth.getUser();
      const user = data.user;

      if (userError || !user) {
        router.replace("/login?next=/admin");
        return;
      }

      // 2) Lấy role từ profiles
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileRow) {
        router.replace("/?denied=1&reason=no-profile");
        return;
      }

      const profile = profileRow as Profile;

      if (!mounted) return;

      if (profile.role === "admin") {
        setState("allowed");
      } else {
        router.replace("/?denied=1&reason=not-admin");
      }
    }

    checkAdmin();

    // ✅ bắt các thay đổi auth (logout/refresh/session update)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (state === "checking") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-slate-600">
        Đang kiểm tra quyền truy cập admin…
      </div>
    );
  }

  return <>{children}</>;
}
