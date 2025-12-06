"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token");

  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit() {
    if (!token) return setMsg("Token không hợp lệ");

    const { error } = await supabase.auth.updateUser({
      password: pwd,
    });

    if (error) return setMsg("Đặt mật khẩu thất bại: " + error.message);

    setMsg("Đặt mật khẩu thành công! Hãy đăng nhập.");
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-xl font-semibold mb-4">Đặt lại mật khẩu</h1>
      <input
        type="password"
        className="border p-2 w-full"
        placeholder="Mật khẩu mới"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
      />
      <button
        onClick={handleSubmit}
        className="mt-4 bg-brand-600 text-white px-4 py-2 rounded"
      >
        Cập nhật
      </button>

      {msg && <p className="mt-3">{msg}</p>}
    </div>
  );
}
