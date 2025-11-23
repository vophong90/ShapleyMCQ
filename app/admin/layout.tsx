"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type GuardState = "checking" | "allowed";

export const metadata = {
  title: "Admin – ShapleyMCQ Lab",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
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
        // Chưa đăng nhập → chuyển tới /login, kèm next=/admin
        router.replace("/login?next=/admin");
        return;
      }

      // 2. Lấy role từ profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        // Không lấy được profile → đưa về trang chủ
        router.replace("/?denied=1&reason=no-profile");
        return;
      }

      if (profile.role === "admin") {
        setState("allowed");
      } else {
        // Không phải admin → đá về home
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

  // Đã xác nhận là admin
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {children}
    </div>
  );
}
