// app/forgot-password/page.tsx
"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email.trim()) {
      setMsg("Vui lòng nhập email.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Không gửi được email đặt lại mật khẩu.");
      }

      setMsg(
        "Nếu email tồn tại trong hệ thống, đường dẫn đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư."
      );
    } catch (err: any) {
      console.error(err);
      setMsg(err.message || "Có lỗi xảy ra, vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">
        Quên mật khẩu
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        Nhập email đã đăng ký, hệ thống sẽ gửi cho bạn một đường dẫn để đặt lại mật khẩu.
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
          {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
        </button>
      </form>
    </div>
  );
}
