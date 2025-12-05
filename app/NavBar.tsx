"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
};

export function MainNav() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      // 1. Lấy user hiện tại từ Supabase Auth
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // 2. Lấy profile (kèm role) từ public.profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  const displayName = profile?.name || profile?.email || ""; // ưu tiên name, fallback email

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    router.push("/"); // hoặc "/login" tuỳ anh
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      {/* Logo + subtitle */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm">
          S
        </div>
        <div>
          <div className="font-semibold text-slate-900">ShapleyMCQ Lab</div>
          <div className="text-xs text-slate-500">
            AU → Misconceptions → MCQ → Monte Carlo → Shapley
          </div>
        </div>
      </div>

      {/* Nav phải */}
      <nav className="flex items-center gap-3 text-sm">
        <Link href="/" className="text-slate-600 hover:text-brand-600">
          Home
        </Link>

        <Link
          href="/dashboard"
          className="text-slate-600 hover:text-brand-600"
        >
          Dashboard
        </Link>

        {/* Nếu là admin thì thêm nút Admin */}
        {profile?.role === "admin" && (
          <Link href="/admin" className="text-slate-600 hover:text-brand-600">
            Admin
          </Link>
        )}

        {/* Loading */}
        {loading ? (
          <span className="text-xs text-slate-400">Đang tải…</span>
        ) : profile ? (
          // ĐÃ LOGIN: hiện tên + nút Đăng xuất
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {displayName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          // CHƯA LOGIN: hiện Đăng nhập + Đăng ký
          <>
            <Link
              href="/login"
              className="text-slate-600 hover:text-brand-600"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
              hrefLang="vi"
            >
              Đăng ký
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
