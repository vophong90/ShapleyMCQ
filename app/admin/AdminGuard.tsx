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

// ✅ Cache kết quả kiểm tra admin cho cả module (1 tab)
let cachedIsAdmin: boolean | null = null;

export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();

  // Nếu đã biết chắc là admin rồi thì khỏi show trạng thái checking
  const [state, setState] = useState<GuardState>(
    cachedIsAdmin === true ? "allowed" : "checking"
  );

  // ✅ 1 instance Supabase duy nhất
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      // Nếu đã cache admin trong module => cho qua luôn
      if (cachedIsAdmin === true) {
        setState("allowed");
        return;
      }

      // 1) Lấy user hiện tại
      const { data, error: userError } = await supabase.auth.getUser();
      const user = data?.user;

      if (userError || !user) {
        if (!mounted) return;
        router.replace("/login?next=/admin");
        return;
      }

      // 2) Lấy role từ profiles
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      if (profileError || !profileRow) {
        cachedIsAdmin = false;
        router.replace("/?denied=1&reason=no-profile");
        return;
      }

      const profile = profileRow as Profile;

      if (profile.role === "admin") {
        cachedIsAdmin = true;
        setState("allowed");
      } else {
        cachedIsAdmin = false;
        router.replace("/?denied=1&reason=not-admin");
      }
    }

    // ❗ Chỉ check một lần khi mount (hoặc khi chưa có cache)
    if (cachedIsAdmin !== true) {
      checkAdmin();
    }

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // 👉 Không show text “Đang kiểm tra…” để đỡ khó chịu
  if (state === "checking") {
    return null;
  }

  return <>{children}</>;
}
