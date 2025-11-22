"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setProfile(data);
      }
      setLoading(false);
    }

    checkAuth();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-600">Đang tải thông tin…</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Xin chào{" "}
            <span className="font-medium">
              {profile?.name || profile?.email || "bạn"}
            </span>
            . Đây là trung tâm điều khiển cho pipeline AU → Misconceptions → MCQ
            → Monte Carlo → Shapley.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:border-brand-500 hover:text-brand-700"
        >
          Đăng xuất
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            1. LLO & Bối cảnh
          </h2>
          <p className="text-xs text-slate-600 mb-2">
            Chọn chuyên ngành, bậc học, Bloom, và LLO cho bài cần ra câu hỏi.
          </p>
          <a
            href="/wizard/context"
            className="mt-1 inline-flex px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
          >
            Bắt đầu
          </a>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            2. AU & Misconceptions
          </h2>
          <p className="text-xs text-slate-600 mb-2">
            Sinh và quản lý các Assessment Units và sai lầm thường gặp.
          </p>
          <button className="mt-1 inline-flex px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:border-brand-500 hover:text-brand-700">
            (Sẽ làm sau)
          </button>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            3. MCQ & Đánh giá
          </h2>
          <p className="text-xs text-slate-600 mb-2">
            Sinh câu MCQ, đánh giá theo chuẩn USMLE/NBME, Monte Carlo & Shapley.
          </p>
          <button className="mt-1 inline-flex px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:border-brand-500 hover:text-brand-700">
            (Sẽ làm sau)
          </button>
        </div>
      </div>
    </div>
  );
}
