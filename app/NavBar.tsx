"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
};

// ✅ Tạo supabase client dạng singleton ở module-level
const supabase = getSupabaseBrowser();

export function MainNav() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        // 1. Lấy session hiện tại
        const { data, error } = await supabase.auth.getSession();
        const user = data?.session?.user;

        if (!alive) return;

        if (error || !user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // 2. Lấy profile từ bảng profiles
        const { data: profileRow, error: profileErr } = await supabase
          .from("profiles")
          .select("id, email, name, role")
          .eq("id", user.id)
          .single();

        if (!alive) return;

        if (profileErr || !profileRow) {
          setProfile(null);
        } else {
          setProfile(profileRow as Profile);
        }
      } catch (e) {
        console.error("Load profile error in MainNav:", e);
        if (!alive) return;
        setProfile(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    // ✅ chỉ chạy 1 lần khi NavBar mount
    loadProfile();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 👈 không phụ thuộc supabase nữa

  const displayName = profile?.name || profile?.email || "";

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }
    setProfile(null);
    setAccountOpen(false);
    router.push("/login");
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

        <Link href="/dashboard" className="text-slate-600 hover:text-brand-600">
          Dashboard
        </Link>

        {profile && (
          <Link
            href="/exam-blueprints"
            className="text-slate-600 hover:text-brand-600"
          >
            Khảo thí
          </Link>
        )}

        {profile?.role === "admin" && (
          <Link href="/admin" className="text-slate-600 hover:text-brand-600">
            Admin
          </Link>
        )}

        {/* Trạng thái auth */}
        {loading ? (
          <span className="text-xs text-slate-400">Đang tải…</span>
        ) : profile ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              <span className="max-w-[160px] truncate">{displayName}</span>
              <svg
                className="ml-1 h-3 w-3 text-slate-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {accountOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white shadow-lg text-xs overflow-hidden z-20">
                <Link
                  href="/account"
                  onClick={() => setAccountOpen(false)}
                  className="block px-3 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Tài khoản
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 text-slate-500 hover:bg-slate-50 hover:text-red-600"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/login" className="text-slate-600 hover:text-brand-600">
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
            >
              Đăng ký
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
