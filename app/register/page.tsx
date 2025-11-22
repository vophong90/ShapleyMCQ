"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Specialty = {
  id: string;
  code: string;
  name: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtyId, setSpecialtyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSpecialties() {
      const { data, error } = await supabase
        .from("specialties")
        .select("id, code, name")
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setMsg("Không tải được danh sách chuyên ngành.");
      } else if (data) {
        setSpecialties(data);
      }
    }
    loadSpecialties();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!name.trim()) {
      setMsg("Vui lòng nhập Họ tên.");
      return;
    }
    if (!email.trim()) {
      setMsg("Vui lòng nhập Email.");
      return;
    }
    if (password.length < 8) {
      setMsg("Mật khẩu phải ≥ 8 ký tự.");
      return;
    }
    if (password !== pwd2) {
      setMsg("Nhập lại mật khẩu chưa khớp.");
      return;
    }
    if (!specialtyId) {
      setMsg("Vui lòng chọn chuyên ngành chính.");
      return;
    }

    setLoading(true);

    // 1) Đăng ký Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      console.error(signUpError);
      setMsg("Đăng ký thất bại: " + signUpError.message);
      setLoading(false);
      return;
    }

    const user = signUpData.user;
    if (!user) {
      setMsg("Không lấy được thông tin người dùng sau khi đăng ký.");
      setLoading(false);
      return;
    }

    // 2) Tạo profile gắn với user + specialty
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email,
      name,
      specialty_id: specialtyId
    });

    if (profileError) {
      console.error(profileError);
      setMsg("Đăng ký thành công nhưng tạo hồ sơ thất bại: " + profileError.message);
      setLoading(false);
      return;
    }

    setMsg("Đăng ký thành công. Đang chuyển đến Dashboard…");
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Đăng ký</h1>
      <p className="text-sm text-slate-600 mb-6">
        Tạo tài khoản để sử dụng ShapleyMCQ Lab. Mỗi tài khoản gắn với một chuyên
        ngành chính, có thể dùng để lọc câu hỏi theo lĩnh vực sau này.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-2xl shadow-sm p-5 space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Họ tên
          </label>
          <input
            type="text"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Võ Thanh Phong"
          />
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="≥ 8 ký tự"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nhập lại mật khẩu
            </label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="Nhập lại"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Chuyên ngành chính
          </label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
            value={specialtyId}
            onChange={(e) => setSpecialtyId(e.target.value)}
          >
            <option value="">-- Chọn chuyên ngành --</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Thông tin này sẽ dùng để gắn tag cho MCQ và lọc câu hỏi theo lĩnh vực.
          </p>
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
          {loading ? "Đang xử lý..." : "Đăng ký"}
        </button>

        <p className="text-xs text-slate-600 mt-3">
          Đã có tài khoản?{" "}
          <a href="/login" className="text-brand-600 hover:underline">
            Đăng nhập
          </a>
        </p>
      </form>
    </div>
  );
}
