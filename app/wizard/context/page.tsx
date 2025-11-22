"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Specialty = {
  id: string;
  code: string;
  name: string;
};

type ContextState = {
  specialty_id: string;
  learner_level: string;
  bloom_level: string;
  llos_text: string;
};

const LEARNER_LEVELS = [
  { value: "undergrad", label: "Sinh viên (Đại học)" },
  { value: "postgrad", label: "Học viên sau đại học" },
  { value: "phd", label: "Nghiên cứu sinh" }
];

const BLOOM_LEVELS = [
  { value: "remember", label: "Remember – Nhớ" },
  { value: "understand", label: "Understand – Hiểu" },
  { value: "apply", label: "Apply – Vận dụng" },
  { value: "analyze", label: "Analyze – Phân tích" },
  { value: "evaluate", label: "Evaluate – Đánh giá" },
  { value: "create", label: "Create – Sáng tạo" }
];

type LloEvalItem = {
  llo: string;
  inferred_bloom: string;
  bloom_match: "good" | "too_low" | "too_high" | string;
  level_fit: "good" | "too_easy" | "too_hard" | string;
  comments: string;
};

type LloEvalResult = {
  overall_comment: string;
  items: LloEvalItem[];
};

export default function ContextWizardPage() {
  const router = useRouter();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtyName, setSpecialtyName] = useState<string | undefined>(undefined);
  const [state, setState] = useState<ContextState>({
    specialty_id: "",
    learner_level: "",
    bloom_level: "",
    llos_text: ""
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [evalResult, setEvalResult] = useState<LloEvalResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // 1) Kiểm tra login
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // 2) Tải profile (để gợi ý specialty)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, specialty_id")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error(profileError);
      }

      // 3) Tải specialties
      const { data: specs, error: specsError } = await supabase
        .from("specialties")
        .select("id, code, name")
        .order("name", { ascending: true });

      if (specsError) {
        console.error(specsError);
        setMsg("Không tải được danh sách chuyên ngành.");
      } else if (specs) {
        setSpecialties(specs);
      }

      // 4) Load context từ localStorage nếu có
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("shapleymcq_context");
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ContextState;
            setState((prev) => ({
              ...prev,
              ...parsed
            }));
          } catch {
            // ignore
          }
        } else if (profile?.specialty_id) {
          setState((prev) => ({
            ...prev,
            specialty_id: profile.specialty_id
          }));
        }
      }

      setLoading(false);
    }

    init();
  }, [router]);

  // Cập nhật specialtyName mỗi khi state.specialty_id hoặc specialties thay đổi
  useEffect(() => {
    if (!state.specialty_id || specialties.length === 0) return;
    const spec = specialties.find((s) => s.id === state.specialty_id);
    setSpecialtyName(spec?.name);
  }, [state.specialty_id, specialties]);

  function handleChange<K extends keyof ContextState>(
    key: K,
    value: ContextState[K]
  ) {
    setState((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  function validate(): boolean {
    if (!state.specialty_id) {
      setMsg("Vui lòng chọn chuyên ngành.");
      return false;
    }
    if (!state.learner_level) {
      setMsg("Vui lòng chọn bậc đào tạo (SV / sau đại học / NCS).");
      return false;
    }
    if (!state.bloom_level) {
      setMsg("Vui lòng chọn mức Bloom.");
      return false;
    }
    if (!state.llos_text.trim()) {
      setMsg("Vui lòng nhập ít nhất một LLO (mỗi dòng một LLO).");
      return false;
    }
    return true;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!validate()) return;

    setSaving(true);

    // MVP: lưu context vào localStorage để dùng ở các bước sau (AU, MCQ…)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "shapleymcq_context",
        JSON.stringify(state)
      );
    }

    setMsg(
      "Đã lưu bối cảnh (chuyên ngành, bậc học, Bloom, LLO). Bạn có thể tiếp tục sang bước AU & Misconceptions."
    );
    setSaving(false);

    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  }

  async function handleEvaluate() {
    setEvalError(null);
    setEvalResult(null);
    setMsg(null);

    if (!validate()) {
      return;
    }

    setEvalLoading(true);

    try {
      const res = await fetch("/api/llo-eval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          specialty_name: specialtyName,
          learner_level: state.learner_level,
          bloom_level: state.bloom_level,
          llos_text: state.llos_text
        })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        setEvalError(
          errorBody?.error || "Không đánh giá được LLO. Vui lòng thử lại."
        );
        setEvalLoading(false);
        return;
      }

      const data = (await res.json()) as LloEvalResult;
      setEvalResult(data);
      setEvalLoading(false);
    } catch (e: any) {
      console.error(e);
      setEvalError("Lỗi mạng hoặc server. Vui lòng thử lại.");
      setEvalLoading(false);
    }
  }

  function renderBadgeBloomMatch(m: string) {
    switch (m) {
      case "good":
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Bloom phù hợp
          </span>
        );
      case "too_low":
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Bloom mục tiêu cao hơn LLO
          </span>
        );
      case "too_high":
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Bloom mục tiêu thấp hơn LLO
          </span>
        );
      default:
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            Bloom: {m}
          </span>
        );
    }
  }

  function renderBadgeLevelFit(m: string) {
    switch (m) {
      case "good":
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Phù hợp bậc học
          </span>
        );
      case "too_easy":
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Quá dễ so với bậc học
          </span>
        );
      case "too_hard":
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Quá khó so với bậc học
          </span>
        );
      default:
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            Level: {m}
          </span>
        );
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-600">Đang tải dữ liệu…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900 mb-2">
          Bước 1 – Thiết lập bối cảnh câu hỏi
        </h1>
        <p className="text-sm text-slate-600">
          Chọn chuyên ngành, bậc đào tạo, mức Bloom và LLO của bài cần ra câu hỏi.
          Sau đó dùng GPT để đánh giá sự phù hợp của LLO với thang Bloom & bậc
          học, trước khi đi tiếp sang bước AU & Misconceptions.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white border rounded-2xl shadow-sm p-5 space-y-5"
      >
        {/* Specialty */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Chuyên ngành / Lĩnh vực
          </label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
            value={state.specialty_id}
            onChange={(e) => handleChange("specialty_id", e.target.value)}
          >
            <option value="">-- Chọn chuyên ngành --</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Dùng để gắn tag cho câu hỏi và lọc theo lĩnh vực sau này.
          </p>
        </div>

        {/* Learner level */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Đối tượng / Bậc đào tạo
          </label>
          <div className="flex flex-wrap gap-3 text-xs">
            {LEARNER_LEVELS.map((lv) => (
              <button
                type="button"
                key={lv.value}
                onClick={() => handleChange("learner_level", lv.value)}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (state.learner_level === lv.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-700")
                }
              >
                {lv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bloom level */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Mức Bloom mục tiêu
          </label>
          <div className="flex flex-wrap gap-3 text-xs">
            {BLOOM_LEVELS.map((b) => (
              <button
                type="button"
                key={b.value}
                onClick={() => handleChange("bloom_level", b.value)}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (state.bloom_level === b.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-700")
                }
              >
                {b.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Đây là mức Bloom bạn muốn câu hỏi đạt được (ví dụ: Apply hoặc
            Analyze cho câu lâm sàng).
          </p>
        </div>

        {/* LLOs */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            LLOs của bài cần ra câu hỏi
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 min-h-[120px]"
            value={state.llos_text}
            onChange={(e) => handleChange("llos_text", e.target.value)}
            placeholder={
              "Mỗi dòng một LLO. Ví dụ:\n- Sinh viên giải thích được cơ chế bệnh sinh của ...\n- Sinh viên phân tích được nguyên nhân chính gây ..."
            }
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Các bước sau sẽ dùng LLO này để GPT đánh giá sự phù hợp với Bloom &
            bậc học, và làm nền sinh AU, misconceptions, MCQ.
          </p>
        </div>

        {msg && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {msg}
          </div>
        )}

        <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700"
            >
              Quay lại Dashboard
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Đang lưu…" : "Lưu bối cảnh (Bước 1)"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleEvaluate}
            disabled={evalLoading}
            className="px-4 py-2 rounded-xl border border-brand-500 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60"
          >
            {evalLoading
              ? "Đang đánh giá LLO…"
              : "Đánh giá LLO & Bloom & bậc học (GPT)"}
          </button>
        </div>
      </form>

      {/* Kết quả đánh giá LLO */}
      {evalError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl px-4 py-3">
          {evalError}
        </div>
      )}

      {evalResult && (
        <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Kết quả đánh giá LLO
            </div>
            <p className="text-sm text-slate-700">
              {evalResult.overall_comment}
            </p>
          </div>

          <div className="space-y-3">
            {evalResult.items?.map((item, idx) => (
              <div
                key={idx}
                className="border border-slate-100 rounded-xl px-3 py-2.5 bg-slate-50/60"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-xs font-medium text-slate-800">
                    {item.llo}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-50">
                      Bloom thực tế: {item.inferred_bloom}
                    </span>
                    {renderBadgeBloomMatch(item.bloom_match)}
                    {renderBadgeLevelFit(item.level_fit)}
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">
                  {item.comments}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
