"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!token) {
      setMsg("Token đặt lại mật khẩu không hợp lệ.");
      return;
    }
    if (password.length < 8) {
      setMsg("Mật khẩu phải ≥ 8 ký tự.");
      return;
    }
    if (password !== pwd2) {
      setMsg("Nhập lại mật khẩu không khớp.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });

    const json = await res.json();

    if (!res.ok) {
      setMsg(json.error || "Không thể đặt lại mật khẩu.");
      setLoading(false);
      return;
    }

    setMsg("Đặt lại mật khẩu thành công. Đang chuyển đến đăng nhập…");

    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border rounded-2xl shadow-sm p-5 space-y-4"
    >
      <h2 className="text-xl font-semibold">Đặt lại mật khẩu</h2>

      <input
        type="password"
        className="w-full border rounded-lg px-3 py-2 text-sm"
        placeholder="Mật khẩu mới"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        type="password"
        className="w-full border rounded-lg px-3 py-2 text-sm"
        placeholder="Nhập lại mật khẩu"
        value={pwd2}
        onChange={(e) => setPwd2(e.target.value)}
      />

      {msg && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {msg}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-1 px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700"
      >
        {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Suspense fallback={<div>Đang tải...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
