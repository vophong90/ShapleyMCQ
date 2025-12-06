"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit() {
    setMsg("");

    // 1. Yêu cầu Supabase tạo token
    const r1 = await fetch("/api/auth/request-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const d1 = await r1.json();
    if (!r1.ok) return setMsg("Không tạo được token reset: " + d1.error);

    // 2. Gửi email bằng Resend
    const r2 = await fetch("/api/auth/send-reset-email", {
      method: "POST",
      body: JSON.stringify({ email, token: d1.token }),
    });

    const d2 = await r2.json();
    if (!r2.ok) return setMsg("Không gửi được email: " + d2.error);

    setMsg("Đã gửi email khôi phục mật khẩu.");
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-xl font-semibold mb-4">Quên mật khẩu</h1>
      <input
        type="email"
        value={email}
        placeholder="Email"
        className="border p-2 w-full"
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        onClick={handleSubmit}
        className="mt-4 bg-brand-600 text-white px-4 py-2 rounded"
      >
        Gửi email khôi phục
      </button>

      {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
    </div>
  );
}
