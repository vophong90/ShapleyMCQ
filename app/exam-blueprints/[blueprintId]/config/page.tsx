// app/exam-blueprints/[blueprintId]/config/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

/* ============================================================
   Types
============================================================ */

type Course = {
  id: string;
  title: string;
};

type LLO = {
  id: string;
  code: string;
  text: string;
};

type DistributionRow = {
  llo_id: string;
  weight_percent: number;
};

type BlueprintConfig = {
  course_id: string | null;
  total_questions: number;
  include_sources?: {
    own_mcq?: boolean;
    shared_mcq?: boolean;
  };
  llo_distribution: DistributionRow[];
};

/* ============================================================
   Page
============================================================ */

export default function BlueprintConfigPage({ params }: any) {
  const blueprintId = params.blueprintId;
  const router = useRouter();

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [user, setUser] = useState<any>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");

  const [llos, setLlos] = useState<LLO[]>([]);
  const [distribution, setDistribution] = useState<DistributionRow[]>([]);

  const [totalQuestions, setTotalQuestions] = useState<number>(40);

  const [includeOwn, setIncludeOwn] = useState<boolean>(true);
  const [includeShared, setIncludeShared] = useState<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ============================================================
     Load user
  ============================================================ */
  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error(error);
        return;
      }
      if (data.user) setUser(data.user);
    }
    loadUser();
  }, [supabase]);

  /* ============================================================
     Load existing blueprint config
  ============================================================ */
  useEffect(() => {
    if (!user) return;

    async function loadBlueprintConfig() {
      const { data, error } = await supabase
        .from("exam_blueprints")
        .select("config")
        .eq("id", blueprintId)
        .single();

      if (error) {
        console.error(error);
        alert("Không tải được cấu hình Blueprint.");
        return;
      }

      const cfg = (data?.config || {}) as BlueprintConfig;

      if (cfg.course_id) setCourseId(cfg.course_id);
      if (cfg.total_questions) setTotalQuestions(cfg.total_questions);

      setIncludeOwn(cfg.include_sources?.own_mcq !== false);
      setIncludeShared(cfg.include_sources?.shared_mcq === true);

      if (cfg.llo_distribution) {
        setDistribution(cfg.llo_distribution);
      }
    }

    loadBlueprintConfig();
  }, [user, blueprintId, supabase]);

  /* ============================================================
     Load courses
  ============================================================ */
  useEffect(() => {
    if (!user) return;

    async function loadCourses() {
      const res = await fetch(`/api/exams/courses?owner_id=${user.id}`);
      const json = await res.json();
      setCourses(json.courses || []);
    }

    loadCourses();
  }, [user]);

  /* ============================================================
     Load LLO when course changes
  ============================================================ */
  useEffect(() => {
    if (!courseId) return;

    async function loadLlos() {
      const res = await fetch(`/api/exams/llos?course_id=${courseId}`);
      const json = await res.json();
      const llosData = json.llos || [];
      setLlos(llosData);

      // Nếu distribution đang rỗng hoặc không khớp LLO → reset
      const currentIds = new Set(distribution.map((d) => d.llo_id));
      const newIds = new Set(llosData.map((l: LLO) => l.id));

      let mismatch = false;
      currentIds.forEach((id) => {
        if (!newIds.has(id)) mismatch = true;
      });

      if (distribution.length === 0 || mismatch) {
        if (
          distribution.length > 0 &&
          !confirm(
            "Đổi học phần sẽ làm mất phân bổ LLO hiện tại. Bạn có chắc không?"
          )
        ) {
          return;
        }

        setDistribution(
          llosData.map((llo: LLO) => ({
            llo_id: llo.id,
            weight_percent: 0,
          }))
        );
      }
    }

    loadLlos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  /* ============================================================
     Helpers
  ============================================================ */

  function updatePercent(index: number, value: number) {
    const updated = [...distribution];
    updated[index].weight_percent = value;
    setDistribution(updated);
  }

  const totalPercent = distribution.reduce(
    (s, r) => s + Number(r.weight_percent || 0),
    0
  );

  /* ============================================================
     Save Config
  ============================================================ */

  async function saveConfig() {
    if (Math.abs(totalPercent - 100) > 0.01) {
      alert("Tổng % phân bổ LLO phải bằng 100%.");
      return;
    }

    if (!courseId) {
      alert("Bạn phải chọn học phần.");
      return;
    }

    setSaving(true);

    const payload: BlueprintConfig = {
      course_id: courseId,
      total_questions: totalQuestions,
      include_sources: {
        own_mcq: includeOwn,
        shared_mcq: includeShared,
      },
      llo_distribution: distribution,
    };

    const { error } = await supabase
      .from("exam_blueprints")
      .update({ config: payload })
      .eq("id", blueprintId);

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Lỗi khi lưu cấu hình.");
      return;
    }

    alert("Đã lưu cấu hình Blueprint thành công!");
    router.push(`/exam-blueprints/${blueprintId}`);
  }

  /* ============================================================
     Render
  ============================================================ */

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Cấu hình Blueprint</h1>

      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-700">
        ⚠️ Thay đổi cấu hình Blueprint chỉ áp dụng cho các version đề được sinh
        sau thời điểm lưu. Các version đề đã tồn tại sẽ không bị thay đổi.
      </div>

      {/* Course selector */}
      <div>
        <label className="font-semibold">Chọn học phần</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="border p-2 w-full mt-2 rounded"
        >
          <option value="">-- Chọn học phần --</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Total questions */}
      <div>
        <label className="font-semibold">Tổng số câu hỏi</label>
        <input
          type="number"
          value={totalQuestions}
          onChange={(e) => setTotalQuestions(Number(e.target.value))}
          className="border p-2 w-full mt-2 rounded"
        />
      </div>

      {/* MCQ sources */}
      <div>
        <label className="font-semibold block mb-2">Nguồn MCQ</label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeOwn}
            onChange={(e) => setIncludeOwn(e.target.checked)}
          />
          MCQ tôi tạo
        </label>

        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={includeShared}
            onChange={(e) => setIncludeShared(e.target.checked)}
          />
          MCQ được chia sẻ với tôi
        </label>
      </div>

      {/* LLO distribution */}
      <div>
        <h2 className="text-xl font-semibold">Phân bổ theo LLO (%)</h2>
        <p className="text-sm text-slate-600">Tổng hiện tại: {totalPercent}%</p>

        <div className="space-y-3 mt-3">
          {llos.map((llo, idx) => (
            <div key={llo.id} className="border p-3 rounded">
              <div className="font-semibold mb-1">
                {llo.code} — {llo.text}
              </div>
              <input
                type="number"
                value={distribution[idx]?.weight_percent || 0}
                onChange={(e) =>
                  updatePercent(idx, Number(e.target.value) || 0)
                }
                className="border p-2 w-28 rounded"
              />{" "}
              %
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="pt-4">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình Blueprint"}
        </button>
      </div>
    </div>
  );
}
