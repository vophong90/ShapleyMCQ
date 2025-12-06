"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

export default function BlueprintConfigPage({ params }: any) {
  const blueprintId = params.blueprintId;
  const router = useRouter();

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

  // -------------------------------------------------------------
  // Load user
  // -------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  // -------------------------------------------------------------
  // Load courses of this user via new API
  // -------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    async function loadCourses() {
      const res = await fetch(`/api/exams/courses?owner_id=${user.id}`);
      const json = await res.json();
      setCourses(json.courses || []);

      // Auto-select first course
      if (json.courses?.length) {
        setCourseId(json.courses[0].id);
      }
    }

    loadCourses();
  }, [user]);

  // -------------------------------------------------------------
  // Load LLO via new API
  // -------------------------------------------------------------
  useEffect(() => {
    if (!courseId) return;

    async function loadLlos() {
      const res = await fetch(`/api/exams/llos?course_id=${courseId}`);
      const json = await res.json();
      setLlos(json.llos || []);

      // Initialize distribution rows
      setDistribution(
        (json.llos || []).map((llo: LLO) => ({
          llo_id: llo.id,
          weight_percent: 0,
        }))
      );
    }

    loadLlos();
  }, [courseId]);

  // -------------------------------------------------------------
  // Auto-calc remaining %
  // -------------------------------------------------------------
  function updatePercent(index: number, value: number) {
    const updated = [...distribution];
    updated[index].weight_percent = value;
    setDistribution(updated);
  }

  const totalPercent = distribution.reduce(
    (s, r) => s + Number(r.weight_percent || 0),
    0
  );

  // -------------------------------------------------------------
  // Save config (via new API)
  // -------------------------------------------------------------
  async function saveConfig() {
    if (Math.abs(totalPercent - 100) > 0.01) {
      alert("Tổng % phân bổ LLO phải bằng 100% trước khi lưu.");
      return;
    }

    setSaving(true);

    const payload = {
      blueprint_id: blueprintId,
      course_id: courseId,
      total_questions: totalQuestions,
      include_sources: {
        own_mcq: includeOwn,
        shared_mcq: includeShared,
      },
      llo_distribution: distribution,
    };

    const res = await fetch("/api/exams/update-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    setSaving(false);

    if (!json.success) {
      alert(json.error || "Lỗi lưu cấu hình");
      return;
    }

    alert("Đã lưu thành công!");
    router.push(`/exam-blueprints/${blueprintId}`);
  }

  // -------------------------------------------------------------
  // Render UI
  // -------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Cấu hình Blueprint</h1>

      {/* Course selector */}
      <div className="mb-6">
        <label className="font-semibold">Chọn học phần</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="border p-2 w-full mt-2 rounded"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Total questions */}
      <div className="mb-6">
        <label className="font-semibold">Số câu hỏi tổng</label>
        <input
          type="number"
          value={totalQuestions}
          onChange={(e) => setTotalQuestions(Number(e.target.value))}
          className="border p-2 w-full mt-2 rounded"
        />
      </div>

      {/* Include MCQ options */}
      <div className="mb-6">
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
      <h2 className="text-xl font-semibold mt-8 mb-3">Phân bổ theo LLO (%)</h2>
      <p className="text-gray-600 mb-2">Tổng: {totalPercent}%</p>

      <div className="space-y-4">
        {llos.map((llo, idx) => (
          <div key={llo.id} className="border p-4 rounded">
            <div className="font-semibold mb-1">
              {llo.code} — {llo.text}
            </div>
            <input
              type="number"
              value={distribution[idx]?.weight_percent || 0}
              onChange={(e) =>
                updatePercent(idx, Number(e.target.value) || 0)
              }
              className="border p-2 mt-2 w-32 rounded"
            />{" "}
            %
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="mt-10">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </div>
    </div>
  );
}
