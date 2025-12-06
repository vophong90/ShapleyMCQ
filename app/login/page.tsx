"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email.trim() || !password) {
      setMsg("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);
      setMsg("Đăng nhập thất bại: " + error.message);
      setLoading(false);
      return;
    }

    setMsg("Đăng nhập thành công. Đang chuyển đến Dashboard…");
    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">
        Đăng nhập
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        Sử dụng email và mật khẩu đã đăng ký để truy cập ShapleyMCQ Lab.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-2xl shadow-sm p-5 space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Mật khẩu
          </label>
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
          />
        </div>

        {msg && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {msg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>

        {/* Link quên mật khẩu */}
        <p className="text-xs text-slate-600 mt-3">
          <a href="/forgot-password" className="text-brand-600 hover:underline">
            Quên mật khẩu?
          </a>
        </p>

        <p className="text-xs text-slate-600 mt-1">
          Chưa có tài khoản?{" "}
          <a href="/register" className="text-brand-600 hover:underline">
            Đăng ký ngay
          </a>
        </p>
      </form>
    </div>
  );
}
