"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Specialty = {
  id: string;
  code: string;
  name: string;
};

export default function RegisterPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwd2, setPwd2] = useState("");

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtyId, setSpecialtyId] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Tải danh sách chuyên ngành
  useEffect(() => {
    let alive = true;

    async function loadSpecialties() {
      try {
        const { data, error } = await supabase
          .from("specialties")
          .select("id, code, name")
          .order("name", { ascending: true });

        if (!alive) return;

        if (error) {
          console.error(error);
          setMsg("Không tải được danh sách chuyên ngành.");
          setSpecialties([]);
          return;
        }

        setSpecialties((data || []) as Specialty[]);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setMsg("Không tải được danh sách chuyên ngành.");
        setSpecialties([]);
      }
    }

    loadSpecialties();
    return () => {
      alive = false;
    };
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    const n = name.trim();
    const em = email.trim();

    if (!n) return setMsg("Vui lòng nhập Họ tên.");
    if (!em) return setMsg("Vui lòng nhập Email.");
    if (password.length < 8) return setMsg("Mật khẩu phải ≥ 8 ký tự.");
    if (password !== pwd2) return setMsg("Nhập lại mật khẩu chưa khớp.");
    if (!specialtyId) return setMsg("Vui lòng chọn chuyên ngành chính.");

    setLoading(true);

    try {
      // 1) Đăng ký user qua Supabase Auth
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: em,
          password,
          options: {
            data: { name: n }, // metadata
          },
        });

      if (signUpError) {
        console.error(signUpError);
        setMsg("Đăng ký thất bại: " + signUpError.message);
        return;
      }

      const user = signUpData.user;
      if (!user) {
        setMsg("Không lấy được thông tin người dùng sau khi đăng ký.");
        return;
      }

      // 2) Upsert profile (có thể fail nếu bật email confirm và chưa có session đầy đủ)
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: em,
        name: n,
        specialty_id: specialtyId,
      });

      if (profileError) {
        // Không chặn luồng, chỉ log
        console.warn(
          "Không tạo/upsert được profile ngay sau signUp:",
          profileError
        );
      }

      // 3) Email welcome (không bắt buộc)
      try {
        await fetch("/api/email/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: em, name: n }),
        });
      } catch (err) {
        console.error("Không gửi được email Welcome:", err);
      }

      setMsg(
        "Đăng ký thành công. Nếu hệ thống yêu cầu xác minh email, vui lòng kiểm tra hộp thư và xác minh trước khi đăng nhập."
      );

      // điều hướng nhẹ nhàng về login
      window.setTimeout(() => router.push("/login"), 900);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Có lỗi xảy ra khi đăng ký.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Đăng ký</h1>
      <p className="text-sm text-slate-600 mb-6">
        Tạo tài khoản để sử dụng ShapleyMCQ Lab. Mỗi tài khoản gắn với một chuyên
        ngành chính để lọc MCQ và phân tích sau này.
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
            autoComplete="name"
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
            autoComplete="email"
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
              autoComplete="new-password"
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
              autoComplete="new-password"
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
