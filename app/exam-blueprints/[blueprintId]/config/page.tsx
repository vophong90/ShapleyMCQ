"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Course = {
  id: string;
  title: string;
};

type LLO = {
  id: string;
  code: string | null;
  text: string;
};

type LloConfigRow = {
  llo_id: string;
  code?: string | null;
  weight_percent: number;
};

type BlueprintConfig = {
  course_id: string | null;
  total_questions: number;
  include_sources?: {
    own_mcq?: boolean;
    shared_mcq?: boolean;
  };
  llo_distribution: LloConfigRow[];
};

export default function BlueprintConfigPage() {
  const params = useParams();
  const router = useRouter();
  const blueprintId = params.blueprintId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [llos, setLlos] = useState<LLO[]>([]);

  const [courseId, setCourseId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);

  const [includeOwn, setIncludeOwn] = useState(true);
  const [includeShared, setIncludeShared] = useState(true);

  const [distribution, setDistribution] = useState<LloConfigRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------------------------------------------
  // 1. LOAD blueprint + danh sách học phần của user
  // ----------------------------------------------------------------
  useEffect(() => {
    async function loadInitial() {
      setLoading(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Bạn cần đăng nhập.");

        // tải blueprint
        const { data: bp } = await supabase
          .from("exam_blueprints")
          .select("*")
          .eq("id", blueprintId)
          .single();

        if (!bp) throw new Error("Không tìm thấy blueprint.");

        const cfg = bp.config as BlueprintConfig;

        setCourseId(cfg.course_id || null);
        setTotalQuestions(cfg.total_questions || 0);
        setIncludeOwn(cfg.include_sources?.own_mcq !== false);
        setIncludeShared(cfg.include_sources?.shared_mcq !== false);
        setDistribution(cfg.llo_distribution || []);

        // tải học phần mà user sở hữu
        const { data: coursesData } = await supabase
          .from("courses")
          .select("id, title")
          .eq("owner_id", user.id);

        setCourses(coursesData || []);

        // nếu blueprint đã có course_id → load LLO
        if (cfg.course_id) {
          await loadLLO(cfg.course_id);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, [blueprintId]);

  // ----------------------------------------------------------------
  // 2. LOAD LLO theo học phần
  // ----------------------------------------------------------------
  async function loadLLO(course_id: string) {
    setLlos([]);

    const { data, error } = await supabase
      .from("llos")
      .select("id, code, text")
      .eq("course_id", course_id)
      .order("code");

    if (!error && data) {
      setLlos(data);
    }
  }

  // ----------------------------------------------------------------
  // 3. Thêm/xoá LLO khỏi blueprint
  // ----------------------------------------------------------------
  function toggleLlo(llo: LLO) {
    const exists = distribution.find((d) => d.llo_id === llo.id);

    if (exists) {
      setDistribution((prev) => prev.filter((d) => d.llo_id !== llo.id));
    } else {
      setDistribution((prev) => [
        ...prev,
        { llo_id: llo.id, code: llo.code, weight_percent: 0 },
      ]);
    }
  }

  function updateWeight(llo_id: string, value: number) {
    setDistribution((prev) =>
      prev.map((d) =>
        d.llo_id === llo_id ? { ...d, weight_percent: value } : d
      )
    );
  }

  // ----------------------------------------------------------------
  // 4. Lưu config
  // ----------------------------------------------------------------
  async function saveConfig() {
    if (!courseId) {
      setError("Bạn phải chọn học phần.");
      return;
    }

    const total = distribution.reduce(
      (sum, x) => sum + Number(x.weight_percent || 0),
      0
    );

    if (Math.abs(total - 100) > 0.01) {
      setError("Tổng % phân bổ LLO phải bằng 100%.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập.");

      const config: BlueprintConfig = {
        course_id: courseId,
        total_questions: totalQuestions,
        include_sources: {
          own_mcq: includeOwn,
          shared_mcq: includeShared,
        },
        llo_distribution: distribution,
      };

      const { error: updateErr } = await supabase
        .from("exam_blueprints")
        .update({ config })
        .eq("id", blueprintId);

      if (updateErr) throw updateErr;

      router.push(`/exam-blueprints/${blueprintId}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------------------------------
  // UI hiển thị
  // ----------------------------------------------------------------
  if (loading)
    return (
      <div className="max-w-4xl mx-auto py-10">Đang tải cấu hình...</div>
    );

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6 px-4">
      <h1 className="text-2xl font-semibold">Cấu hình Blueprint</h1>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* ------------------------------------------------------------ */}
      {/* CHỌN HỌC PHẦN */}
      {/* ------------------------------------------------------------ */}
      <div className="rounded-xl border p-5 bg-white">
        <h2 className="font-semibold mb-3">1. Chọn học phần</h2>

        <select
          value={courseId ?? ""}
          onChange={async (e) => {
            const cid = e.target.value;
            setCourseId(cid);
            await loadLLO(cid);
            setDistribution([]);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">-- Chọn học phần --</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* CHỌN TỔNG SỐ CÂU */}
      {/* ------------------------------------------------------------ */}
      <div className="rounded-xl border p-5 bg-white">
        <h2 className="font-semibold mb-3">2. Tổng số câu</h2>

        <input
          type="number"
          value={totalQuestions}
          onChange={(e) => setTotalQuestions(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm w-40"
        />
      </div>

      {/* ------------------------------------------------------------ */}
      {/* NGUỒN MCQ */}
      {/* ------------------------------------------------------------ */}
      <div className="rounded-xl border p-5 bg-white">
        <h2 className="font-semibold mb-3">3. Nguồn câu MCQ</h2>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeOwn}
            onChange={(e) => setIncludeOwn(e.target.checked)}
          />
          Câu của tôi
        </label>

        <label className="flex items-center gap-2 text-sm mt-2">
          <input
            type="checkbox"
            checked={includeShared}
            onChange={(e) => setIncludeShared(e.target.checked)}
          />
          Câu được chia sẻ cho tôi
        </label>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* DANH SÁCH LLO */}
      {/* ------------------------------------------------------------ */}
      <div className="rounded-xl border p-5 bg-white">
        <h2 className="font-semibold mb-3">4. Phân bổ LLO (% phải = 100)</h2>

        {llos.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có LLO cho học phần này.
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 text-left">Chọn</th>
                <th className="py-2 text-left">LLO</th>
                <th className="py-2 text-left w-32">% phân bổ</th>
              </tr>
            </thead>
            <tbody>
              {llos.map((l) => {
                const row = distribution.find((d) => d.llo_id === l.id);

                return (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={!!row}
                        onChange={() => toggleLlo(l)}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-semibold">
                        {l.code || l.id.slice(0, 6)}
                      </span>
                      <br />
                      <span className="text-xs text-slate-500">
                        {l.text.slice(0, 80)}...
                      </span>
                    </td>
                    <td>
                      {row ? (
                        <input
                          type="number"
                          value={row.weight_percent}
                          onChange={(e) =>
                            updateWeight(l.id, Number(e.target.value))
                          }
                          className="border rounded-lg px-2 py-1 text-sm w-20"
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Tổng % */}
        <div className="mt-3 font-medium">
          Tổng %:{" "}
          {distribution
            .reduce((s, x) => s + Number(x.weight_percent || 0), 0)
            .toFixed(1)}
          %
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* NÚT LƯU */}
      {/* ------------------------------------------------------------ */}
      <div className="flex justify-end">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </div>
    </div>
  );
}
