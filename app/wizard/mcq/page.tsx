"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Course = {
  id: string;
  code?: string | null;
  title?: string | null;
};

type Lesson = {
  id: string;
  title: string | null;
};

type LLO = {
  id: string;
  code?: string | null;
  text: string | null;
};

type AU = {
  id: string;
  text: string;
  llo_id: string | null;
};

type Miscon = {
  description: string;
  error_type: string;
};

type MCQ = {
  stem: string;
  correct_answer: string;
  distractors: string[];
  explanation: string;
};

type NbmeResult = {
  hard_rules: {
    passed: boolean;
    flags: string[];
  };
  rubric: {
    overall_score: number;
    summary: string;
    dimensions: {
      [key: string]: {
        score: number;
        comment: string;
      };
    };
    suggestions: string;
    [key: string]: any;
  };
};

type EduFitResult = {
  inferred_bloom: string;
  bloom_match: string; // "good" | "too_low" | "too_high" | string
  level_fit: string;   // "good" | "too_easy" | "too_hard" | string
  summary: string;
  llo_coverage: {
    llo: string;
    coverage: string; // "direct" | "indirect" | "none" | string
    comment: string;
  }[];
  recommendations: string[];
};

export default function MCQWizard() {
  // ===== Bối cảnh từ Step 1–3 =====
  const [context, setContext] = useState<any | null>(null);

  // ===== Học phần / bài học / LLO / AU =====
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [llos, setLlos] = useState<LLO[]>([]);
  const [aus, setAus] = useState<AU[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<string | "">("");
  const [selectedLessonId, setSelectedLessonId] = useState<string | "">("");
  const [selectedLloId, setSelectedLloId] = useState<string | "">("");
  const [selectedAU, setSelectedAU] = useState<AU | null>(null);

  // ===== Misconceptions (chọn được) =====
  const [miscons, setMiscons] = useState<Miscon[]>([]);
  const [selectedMisIdx, setSelectedMisIdx] = useState<number[]>([]);

  // ===== Batch MCQ =====
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [loadingGen, setLoadingGen] = useState(false);

  // ===== Phân tích theo index của MCQ =====
  const [nbmeResults, setNbmeResults] = useState<(NbmeResult | null)[]>([]);
  const [nbmeLoadingIndex, setNbmeLoadingIndex] = useState<number | null>(null);

  const [eduFitResults, setEduFitResults] = useState<(EduFitResult | null)[]>([]);
  const [eduLoadingIndex, setEduLoadingIndex] = useState<number | null>(null);

  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // ===== Điều khiển batch =====
  const [questionCount, setQuestionCount] = useState<number>(3); // 0–10
  const [clinicalVignette, setClinicalVignette] = useState<boolean>(false);

  // ========== LOAD CONTEXT & COURSES ==========

  useEffect(() => {
    // load context từ localStorage
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("shapleymcq_context");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setContext(parsed);
          if (parsed.course_id) setSelectedCourseId(parsed.course_id);
          if (parsed.lesson_id) setSelectedLessonId(parsed.lesson_id);
          if (parsed.llo_id) setSelectedLloId(parsed.llo_id);
        } catch {
          // ignore
        }
      }
    }

    loadCourses();
  }, []);

  async function loadCourses() {
    const { data, error } = await supabase
      .from("courses")
      .select("id, code, title")
      .order("code", { ascending: true });

    if (!error && data) {
      setCourses(
        data.map((c: any) => ({
          id: c.id,
          code: c.code ?? null,
          title: c.title ?? null,
        }))
      );
    }
  }

  // Khi chọn course → load lessons
  useEffect(() => {
    if (!selectedCourseId) {
      setLessons([]);
      setSelectedLessonId("");
      setLlos([]);
      setSelectedLloId("");
      setAus([]);
      setSelectedAU(null);
      setMiscons([]);
      setSelectedMisIdx([]);
      setMcqs([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title")
        .eq("course_id", selectedCourseId)
        .order("title", { ascending: true });

      if (!error && data) {
        setLessons(
          data.map((l: any) => ({
            id: l.id,
            title: l.title ?? null,
          }))
        );
      }
    })();
  }, [selectedCourseId]);

  // Khi chọn lesson → load LLOs
  useEffect(() => {
    if (!selectedLessonId) {
      setLlos([]);
      setSelectedLloId("");
      setAus([]);
      setSelectedAU(null);
      setMiscons([]);
      setSelectedMisIdx([]);
      setMcqs([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("llos")
        .select("id, code, text")
        .eq("lesson_id", selectedLessonId)
        .order("code", { ascending: true });

      if (!error && data) {
        setLlos(
          data.map((r: any) => ({
            id: r.id,
            code: r.code ?? null,
            text: r.text ?? null,
          }))
        );
      }
    })();
  }, [selectedLessonId]);

  // Khi chọn LLO → load AUs
  useEffect(() => {
    if (!selectedLloId) {
      setAus([]);
      setSelectedAU(null);
      setMiscons([]);
      setSelectedMisIdx([]);
      setMcqs([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("assessment_units")
        .select("id, core_statement, llo_id")
        .eq("llo_id", selectedLloId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setAus(
          (data as any[]).map((row) => ({
            id: row.id,
            text: row.core_statement as string,
            llo_id: (row.llo_id as string | null) ?? null,
          }))
        );
      }
    })();
  }, [selectedLloId]);

  // ===== Load misconceptions cho AU =====
  async function loadMiscons(au: AU) {
    const { data, error } = await supabase
      .from("misconceptions")
      .select("description, error_type")
      .eq("au_id", au.id);

    if (!error && data) {
      const arr = data as Miscon[];
      setMiscons(arr);
      // mặc định chọn tất cả Mis
      setSelectedMisIdx(arr.map((_, i) => i));
    } else {
      setMiscons([]);
      setSelectedMisIdx([]);
    }
  }

  function toggleMisIndex(idx: number) {
    setSelectedMisIdx((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  function chooseAU(au: AU) {
    setSelectedAU(au);
    setMcqs([]);
    setNbmeResults([]);
    setEduFitResults([]);
    loadMiscons(au);
  }

  // ========== GENERATE MCQ BATCH ==========

  async function handleGenerateMCQs() {
    if (!selectedAU) return;
    if (!questionCount || questionCount < 1) {
      alert("Số câu mỗi lần sinh phải ≥ 1");
      return;
    }

    const usedMis = miscons.filter((_, i) => selectedMisIdx.includes(i));

    setLoadingGen(true);
    setMcqs([]);
    setNbmeResults([]);
    setEduFitResults([]);

    const res = await fetch("/api/mcq-gen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        au_text: selectedAU.text,
        misconceptions: usedMis,
        specialty_name: context?.specialty_name || "Y học cổ truyền",
        learner_level: context?.learner_level || "Sinh viên đại học",
        bloom_level: context?.bloom_level || "Analyze",
        count: questionCount,
        clinical_vignette: clinicalVignette,
      }),
    });

    const json = await res.json();
    setLoadingGen(false);

    if (!res.ok || json.error) {
      alert(json.error || "Lỗi sinh MCQ từ GPT.");
      return;
    }

    const items = Array.isArray(json) ? json : json.items;
    if (!Array.isArray(items) || items.length === 0) {
      alert("GPT không trả về danh sách MCQ hợp lệ.");
      return;
    }

    setMcqs(items as MCQ[]);
    setNbmeResults(items.map(() => null));
    setEduFitResults(items.map(() => null));
  }

  // ========== CẬP NHẬT MCQ TỪNG CÂU ==========

  function updateMCQAt(index: number, key: keyof MCQ, value: any) {
    setMcqs((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;
      copy[index] = { ...item, [key]: value };
      return copy;
    });
  }

  // ========== REFINE STEM / DISTRACTOR CHO 1 CÂU ==========

  async function refineStem(index: number) {
    const mcq = mcqs[index];
    if (!mcq) return;

    const res = await fetch("/api/mcqs/refine-stem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: mcq.stem,
      }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      alert(json.error || "Lỗi refine stem.");
      return;
    }

    if (json.refined) {
      updateMCQAt(index, "stem", json.refined);
    }
  }

  async function refineDistractor(index: number, di: number) {
    const mcq = mcqs[index];
    if (!mcq) return;

    const res = await fetch("/api/mcqs/refine-distractor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: mcq.distractors[di],
      }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      alert(json.error || "Lỗi refine distractor.");
      return;
    }

    if (json.refined) {
      setMcqs((prev) => {
        const copy = [...prev];
        const item = copy[index];
        if (!item) return prev;
        const arr = [...item.distractors];
        arr[di] = json.refined;
        copy[index] = { ...item, distractors: arr };
        return copy;
      });
    }
  }

  // ========== NBME CHECK CHO 1 CÂU ==========

  async function runNbmeCheck(index: number) {
    const mcq = mcqs[index];
    if (!mcq) return;

    setNbmeLoadingIndex(index);
    setNbmeResults((prev) => {
      const copy = [...prev];
      copy[index] = null;
      return copy;
    });

    const res = await fetch("/api/mcqs/nbme-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: mcq.stem,
        correct_answer: mcq.correct_answer,
        distractors: mcq.distractors,
        explanation: mcq.explanation,
      }),
    });

    const json = await res.json();
    setNbmeLoadingIndex(null);

    if (!res.ok || json.error) {
      alert(json.error || "Lỗi NBME Style Check.");
      return;
    }

    setNbmeResults((prev) => {
      const copy = [...prev];
      copy[index] = json as NbmeResult;
      return copy;
    });
  }

  // ========== EDU-FIT CHECK CHO 1 CÂU ==========

  async function runEduFitCheck(index: number) {
    const mcq = mcqs[index];
    if (!mcq || !context) return;

    setEduLoadingIndex(index);
    setEduFitResults((prev) => {
      const copy = [...prev];
      copy[index] = null;
      return copy;
    });

    const res = await fetch("/api/mcqs/edu-fit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: mcq.stem,
        correct_answer: mcq.correct_answer,
        distractors: mcq.distractors,
        explanation: mcq.explanation,
        learner_level: context.learner_level,
        bloom_level: context.bloom_level,
        llos_text: context.llos_text,
        specialty_name: context.specialty_name,
      }),
    });

    const json = await res.json();
    setEduLoadingIndex(null);

    if (!res.ok || json.error) {
      alert(json.error || "Lỗi Educational Fit Check.");
      return;
    }

    setEduFitResults((prev) => {
      const copy = [...prev];
      copy[index] = json as EduFitResult;
      return copy;
    });
  }

  // ========== SAVE 1 MCQ ==========

  async function saveOneMCQ(index: number) {
    const mcq = mcqs[index];
    if (!mcq || !selectedAU) return;

    setSavingIndex(index);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      alert("Chưa đăng nhập.");
      setSavingIndex(null);
      return;
    }

    try {
      const nbmeResult = nbmeResults[index] ?? null;
      const eduFitResult = eduFitResults[index] ?? null;

      const { data, error } = await supabase
        .from("mcq_items")
        .insert({
          owner_id: userId,
          au_id: selectedAU.id,
          course_id: selectedCourseId || null,
          primary_specialty_id: context?.specialty_id ?? null,
          stem: mcq.stem,
          bloom_level: null,
          visibility: "private",
          status: "draft",
          learner_level: context?.learner_level ?? null,
          target_bloom: context?.bloom_level ?? null,
          usmle_nbme_score: nbmeResult,
          level_fit_score: eduFitResult,
          llo_ids: selectedAU.llo_id ? [selectedAU.llo_id] : null,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error(error);
        alert("Lưu MCQ thất bại (mcq_items).");
        setSavingIndex(null);
        return;
      }

      const mcqId = data.id as string;

      // Link LLO nếu có
      if (selectedAU.llo_id) {
        await supabase.from("mcq_item_llos").insert({
          mcq_item_id: mcqId,
          llo_id: selectedAU.llo_id,
        });
      }

            // Insert options vào mcq_options
      const labels = ["A", "B", "C", "D", "E", "F"]; // đủ cho 1 đáp án đúng + 5 distractor

      const optionRows = [
        {
          item_id: mcqId,          // 👈 đúng tên cột
          label: labels[0],        // A = đáp án đúng
          text: mcq.correct_answer,
          is_correct: true,
          misconception_id: null,  // tạm thời chưa gán cụ thể Mis
        },
        ...mcq.distractors.slice(0, labels.length - 1).map((d: string, i: number) => ({
          item_id: mcqId,
          label: labels[i + 1],    // B, C, D...
          text: d,
          is_correct: false,
          misconception_id: null,  // sau này nếu muốn map từng distractor ↔ misconception thì chỉnh ở đây
        })),
      ];

      const { error: optError } = await supabase
        .from("mcq_options")
        .insert(optionRows);

      if (optError) {
        console.error(optError);
        alert("Lưu MCQ thất bại (mcq_options).");
        setSavingIndex(null);
        return;
      }

  // ========== RENDER ==========

  return (
    <div className="h-[calc(100vh-60px)] bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto h-full flex flex-col gap-4">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold mb-1">
            Bước 4 – Sinh & phân tích câu MCQ
          </h1>
          {context && (
            <div className="text-xs text-gray-600 space-y-0.5">
              {context.course_name && (
                <div>
                  <span className="font-semibold">Học phần: </span>
                  {context.course_name}
                </div>
              )}
              {context.lesson_name && (
                <div>
                  <span className="font-semibold">Bài học: </span>
                  {context.lesson_name}
                </div>
              )}
              {context.bloom_level && (
                <div>
                  <span className="font-semibold">Bloom mục tiêu: </span>
                  {context.bloom_level}
                </div>
              )}
              {context.learner_level && (
                <div>
                  <span className="font-semibold">Bậc đào tạo: </span>
                  {context.learner_level}
                </div>
              )}
            </div>
          )}
        </div>

        {/* THANH CHỌN: Course – Lesson – LLO – AU – Mis – Số câu – Clinical vignette – Generate */}
        <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap gap-3 items-end text-xs">
          {/* Course */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1">Học phần</label>
            <select
              className="border rounded-md px-2 py-1 text-xs min-w-[160px]"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              <option value="">-- Chọn học phần --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} – ` : ""}
                  {c.title ?? "Không tên"}
                </option>
              ))}
            </select>
          </div>

          {/* Lesson */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1">Bài học</label>
            <select
              className="border rounded-md px-2 py-1 text-xs min-w-[140px]"
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              disabled={!selectedCourseId}
            >
              <option value="">-- Chọn bài học --</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title ?? "Không tên"}
                </option>
              ))}
            </select>
          </div>

          {/* LLO */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1">LLO</label>
            <select
              className="border rounded-md px-2 py-1 text-xs min-w-[160px]"
              value={selectedLloId}
              onChange={(e) => setSelectedLloId(e.target.value)}
              disabled={!selectedLessonId}
            >
              <option value="">-- Chọn LLO --</option>
              {llos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code ? `${l.code} – ` : ""}
                  {l.text?.slice(0, 60) ?? "Không tên"}
                </option>
              ))}
            </select>
          </div>

          {/* AU */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1">Assessment Unit</label>
            <select
              className="border rounded-md px-2 py-1 text-xs min-w-[200px]"
              value={selectedAU?.id ?? ""}
              onChange={(e) => {
                const au = aus.find((x) => x.id === e.target.value) || null;
                if (au) chooseAU(au);
              }}
              disabled={!selectedLloId}
            >
              <option value="">-- Chọn AU --</option>
              {aus.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.text.slice(0, 80)}
                </option>
              ))}
            </select>
          </div>

          {/* Số câu / Clinical vignette / Generate */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1">Số câu / lần (0–10)</label>
            <input
              type="number"
              min={0}
              max={10}
              className="border rounded-md px-2 py-1 text-xs w-20"
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value) || 0)}
            />
          </div>

          <label className="inline-flex items-center gap-1 text-xs mt-6">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={clinicalVignette}
              onChange={(e) => setClinicalVignette(e.target.checked)}
            />
            Tình huống lâm sàng
          </label>

          <button
            onClick={handleGenerateMCQs}
            disabled={
              loadingGen ||
              !selectedCourseId ||
              !selectedLessonId ||
              !selectedLloId ||
              !selectedAU ||
              questionCount < 1
            }
            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loadingGen ? "Đang sinh câu MCQ…" : "Generate MCQ (GPT)"}
          </button>
        </div>

        {/* HAI KHỐI: MISCON – DANH SÁCH MCQ */}
        <div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-4 flex-1 overflow-hidden">
          {/* MISCON (CHỌN MIS) */}
          <div className="bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b text-sm font-semibold">
              Misconceptions (chọn Mis dùng làm distractors)
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {!selectedAU && (
                <div className="text-gray-500">
                  Chọn học phần → bài học → LLO → AU để xem danh sách
                  misconceptions.
                </div>
              )}
              {selectedAU && miscons.length === 0 && (
                <div className="text-gray-500">
                  AU này chưa có misconception nào.
                </div>
              )}
              {selectedAU &&
                miscons.length > 0 &&
                miscons.map((m, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-2 border rounded-lg px-2 py-1 bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selectedMisIdx.includes(i)}
                      onChange={() => toggleMisIndex(i)}
                    />
                    <div>
                      <div className="font-semibold">
                        Mis {i + 1} – {m.error_type}
                      </div>
                      <div>{m.description}</div>
                    </div>
                  </label>
                ))}
            </div>
          </div>

          {/* DANH SÁCH MCQ */}
          <div className="bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b text-sm font-semibold flex justify-between items-center">
              <span>Các câu MCQ sinh ra</span>
              {mcqs.length > 0 && (
                <span className="text-xs text-gray-500">
                  Đã sinh {mcqs.length} câu – chỉnh sửa từng câu, chạy phân tích
                  và bấm Lưu ở từng card.
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(!selectedAU || mcqs.length === 0) && (
                <div className="text-sm text-gray-500">
                  • Chọn đầy đủ học phần – bài học – LLO – AU – Mis.  
                  • Chọn số câu muốn sinh (3–5 gợi ý).  
                  • Tick “Tình huống lâm sàng” nếu muốn dạng clinical vignette.  
                  • Bấm <b>Generate MCQ (GPT)</b> để xem kết quả ở đây.
                </div>
              )}

              {mcqs.map((mcq, idx) => {
                const nbme = nbmeResults[idx];
                const edu = eduFitResults[idx];
                const nbmeLoading = nbmeLoadingIndex === idx;
                const eduLoading = eduLoadingIndex === idx;
                const saving = savingIndex === idx;

                return (
                  <div
                    key={idx}
                    className="border rounded-xl p-4 bg-slate-50 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        MCQ #{idx + 1}
                      </div>
                      <button
                        onClick={() => saveOneMCQ(idx)}
                        disabled={saving}
                        className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-700 disabled:opacity-60"
                      >
                        {saving ? "Đang lưu…" : "Lưu MCQ này"}
                      </button>
                    </div>

                    {/* STEM */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="font-semibold text-xs">Stem</h3>
                        <button
                          onClick={() => refineStem(idx)}
                          className="text-blue-600 hover:underline text-[11px]"
                        >
                          Refine Stem
                        </button>
                      </div>
                      <textarea
                        className="w-full border rounded-lg px-2 py-1 text-xs"
                        rows={4}
                        value={mcq.stem}
                        onChange={(e) =>
                          updateMCQAt(idx, "stem", e.target.value)
                        }
                      />
                    </div>

                    {/* CORRECT ANSWER */}
                    <div>
                      <h3 className="font-semibold text-xs mb-1">
                        Correct Answer
                      </h3>
                      <input
                        className="w-full border rounded-lg px-2 py-1 text-xs"
                        value={mcq.correct_answer}
                        onChange={(e) =>
                          updateMCQAt(idx, "correct_answer", e.target.value)
                        }
                      />
                    </div>

                    {/* DISTRACTORS */}
                    <div>
                      <h3 className="font-semibold text-xs mb-2">
                        Distractors
                      </h3>
                      {mcq.distractors.map((d, di) => (
                        <div key={di} className="mb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">
                              Distractor {di + 1}
                            </span>
                            <button
                              onClick={() => refineDistractor(idx, di)}
                              className="text-blue-600 hover:underline text-[11px]"
                            >
                              Refine
                            </button>
                          </div>
                          <input
                            className="w-full border rounded-lg px-2 py-1 mt-1 text-xs"
                            value={d}
                            onChange={(e) => {
                              const arr = [...mcq.distractors];
                              arr[di] = e.target.value;
                              updateMCQAt(idx, "distractors", arr);
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* EXPLANATION */}
                    <div>
                      <h3 className="font-semibold text-xs mb-1">Explanation</h3>
                      <textarea
                        className="w-full border rounded-lg px-2 py-1 text-xs"
                        rows={3}
                        value={mcq.explanation}
                        onChange={(e) =>
                          updateMCQAt(idx, "explanation", e.target.value)
                        }
                      />
                    </div>

                    {/* NÚT PHÂN TÍCH */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        onClick={() => runNbmeCheck(idx)}
                        disabled={nbmeLoading}
                        className="px-3 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
                      >
                        {nbmeLoading
                          ? "Đang NBME check…"
                          : "NBME / USMLE Style Check"}
                      </button>

                      <button
                        onClick={() => runEduFitCheck(idx)}
                        disabled={eduLoading || !context}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {eduLoading
                          ? "Đang edu-fit…"
                          : "Educational Fit (Bloom–bậc–LLO)"}
                      </button>

                      {/* chừa slot cho nút phân tích thứ 3 sau này (vd. ShapleyDistractor) */}
                    </div>

                    {/* KẾT QUẢ NBME */}
                    <div className="bg-white border rounded-lg p-3 space-y-2 text-[11px]">
                      {!nbme && (
                        <div className="text-gray-500">
                          Chưa chạy NBME / USMLE Style Check cho câu này.
                        </div>
                      )}
                      {nbme && (
                        <>
                          <div>
                            <span className="font-semibold">Hard rules: </span>
                            {nbme.hard_rules.passed ? (
                              <span className="text-emerald-600">PASSED</span>
                            ) : (
                              <span className="text-red-600">FAILED</span>
                            )}
                          </div>
                          {nbme.hard_rules.flags.length > 0 && (
                            <ul className="list-disc list-inside text-red-700">
                              {nbme.hard_rules.flags.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          )}
                          <div>
                            <span className="font-semibold">
                              Overall score:{" "}
                            </span>
                            <span className="text-blue-700">
                              {nbme.rubric.overall_score}/5
                            </span>
                          </div>
                          <div>{nbme.rubric.summary}</div>
                          <div className="grid grid-cols-1 gap-1">
                            {Object.entries(nbme.rubric.dimensions || {}).map(
                              ([k, v]: any) => (
                                <div
                                  key={k}
                                  className="border rounded-md px-2 py-1 bg-slate-50"
                                >
                                  <div className="font-semibold">
                                    {k}{" "}
                                    <span className="text-blue-700">
                                      ({v.score}/5)
                                    </span>
                                  </div>
                                  <div>{v.comment}</div>
                                </div>
                              )
                            )}
                          </div>
                          <div>
                            <div className="font-semibold">Gợi ý chỉnh sửa:</div>
                            <pre className="whitespace-pre-wrap">
                              {nbme.rubric.suggestions}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>

                    {/* KẾT QUẢ EDU-FIT */}
                    <div className="bg-white border rounded-lg p-3 space-y-2 text-[11px]">
                      {!edu && (
                        <div className="text-gray-500">
                          Chưa chạy Educational Fit cho câu này.
                        </div>
                      )}
                      {edu && (
                        <>
                          <div>
                            <span className="font-semibold">
                              Bloom suy luận:{" "}
                            </span>
                            <span className="text-blue-700">
                              {edu.inferred_bloom}
                            </span>
                          </div>
                          <div>
                            So với Bloom mục tiêu:{" "}
                            <span className="font-semibold">
                              {edu.bloom_match === "good"
                                ? "Phù hợp"
                                : edu.bloom_match === "too_low"
                                ? "Thấp hơn mục tiêu"
                                : edu.bloom_match === "too_high"
                                ? "Cao hơn mục tiêu"
                                : edu.bloom_match}
                            </span>
                          </div>
                          <div>
                            Phù hợp với bậc học:{" "}
                            <span className="font-semibold">
                              {edu.level_fit === "good"
                                ? "Phù hợp"
                                : edu.level_fit === "too_easy"
                                ? "Quá dễ"
                                : edu.level_fit === "too_hard"
                                ? "Quá khó"
                                : edu.level_fit}
                            </span>
                          </div>

                          <div>
                            <div className="font-semibold">Tóm tắt:</div>
                            <div>{edu.summary}</div>
                          </div>

                          <div>
                            <div className="font-semibold">LLO coverage:</div>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {edu.llo_coverage.map((c, i) => (
                                <div
                                  key={i}
                                  className="border rounded-md px-2 py-1 bg-slate-50"
                                >
                                  <div className="font-semibold">
                                    • {c.llo}
                                  </div>
                                  <div>
                                    Coverage:{" "}
                                    <span className="italic">
                                      {c.coverage}
                                    </span>{" "}
                                    – {c.comment}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="font-semibold">
                              Gợi ý chỉnh sửa:
                            </div>
                            <ul className="list-disc list-inside">
                              {edu.recommendations.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
