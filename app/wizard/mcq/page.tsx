// app/wizard/mcq/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

import {
  type Course,
  type Lesson,
  type LLO,
  type AU,
  type Miscon,
  type MCQ,
  type NbmeResult,
  type EduFitResult,
  type ExistingMcqSummary,
  type StemLength,
  type DifficultyLevel,
} from "./types";

import { MCQHeader } from "./components/Header";
import { SelectorBar } from "./components/SelectorBar";
import { MisconList } from "./components/MisconList";
import { ExistingMcqList } from "./components/ExistingMcqList";
import { MCQList } from "./components/MCQList";

export default function MCQWizard() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  // ===== Context Step 1–3 =====
  const [context, setContext] = useState<any | null>(null);

  // ===== Course / Lesson / LLO / AU =====
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [llos, setLlos] = useState<LLO[]>([]);
  const [aus, setAus] = useState<AU[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<string | "">("");
  const [selectedLessonId, setSelectedLessonId] = useState<string | "">("");
  const [selectedLloId, setSelectedLloId] = useState<string | "">("");
  const [selectedAU, setSelectedAU] = useState<AU | null>(null);

  // ===== Misconceptions =====
  const [miscons, setMiscons] = useState<Miscon[]>([]);
  const [selectedMisIdx, setSelectedMisIdx] = useState<number[]>([]);

  // ===== Batch MCQ =====
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [loadingGen, setLoadingGen] = useState(false);

  // ===== Checks =====
  const [nbmeResults, setNbmeResults] = useState<(NbmeResult | null)[]>([]);
  const [nbmeLoadingIndex, setNbmeLoadingIndex] = useState<number | null>(null);

  const [eduFitResults, setEduFitResults] = useState<(EduFitResult | null)[]>(
    []
  );
  const [eduLoadingIndex, setEduLoadingIndex] = useState<number | null>(null);

  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // ===== Controls =====
  const [questionCount, setQuestionCount] = useState<number>(3);
  const [clinicalVignette, setClinicalVignette] = useState<boolean>(false);
  const [stemLength, setStemLength] = useState<StemLength>("medium");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");

  // ===== Existing MCQs =====
  const [existingMcqs, setExistingMcqs] = useState<ExistingMcqSummary[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);

  // ========== INIT CONTEXT & COURSES ==========
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

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

  // Khi chọn course -> lessons
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
      setExistingMcqs([]);
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
  }, [selectedCourseId, supabase]);

  // Khi chọn lesson -> LLOs
  useEffect(() => {
    if (!selectedLessonId) {
      setLlos([]);
      setSelectedLloId("");
      setAus([]);
      setSelectedAU(null);
      setMiscons([]);
      setSelectedMisIdx([]);
      setMcqs([]);
      setExistingMcqs([]);
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
  }, [selectedLessonId, supabase]);

  // Khi chọn LLO -> AUs
  useEffect(() => {
    if (!selectedLloId) {
      setAus([]);
      setSelectedAU(null);
      setMiscons([]);
      setSelectedMisIdx([]);
      setMcqs([]);
      setExistingMcqs([]);
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
  }, [selectedLloId, supabase]);

  // Load misconceptions cho AU
  async function loadMiscons(au: AU) {
    const { data, error } = await supabase
      .from("misconceptions")
      .select("description, error_type")
      .eq("au_id", au.id);

    if (!error && data) {
      const arr = data as Miscon[];
      setMiscons(arr);
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

  function chooseAUById(id: string) {
    const au = aus.find((x) => x.id === id) || null;
    setSelectedAU(au);
    setMcqs([]);
    setNbmeResults([]);
    setEduFitResults([]);
    if (au) loadMiscons(au);
  }

  // Load MCQ đã có
  useEffect(() => {
    async function loadExisting() {
      if (!selectedAU) {
        setExistingMcqs([]);
        return;
      }
      setExistingLoading(true);

      let query = supabase
        .from("mcq_items")
        .select("id, stem, created_at, llo_ids, au_id")
        .eq("au_id", selectedAU.id as string)
        .order("created_at", { ascending: false })
        .limit(50);

      if (selectedLloId) {
        query = query.contains("llo_ids", [selectedLloId]);
      }

      const { data, error } = await query;
      setExistingLoading(false);

      if (!error && data) {
        const rows = (data as any[]).map((row) => ({
          id: row.id as string,
          stem: (row.stem as string) ?? "",
          created_at: (row.created_at as string) ?? null,
        }));
        setExistingMcqs(rows);
      } else {
        setExistingMcqs([]);
      }
    }

    if (selectedAU) {
      loadExisting();
    } else {
      setExistingMcqs([]);
    }
  }, [supabase, selectedAU, selectedLloId]);

  // ========== GENERATE MCQ ==========
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
        stem_length: stemLength,
        difficulty,
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

  // ========== UPDATE / REFINE / CHECK / SAVE ==========

  function updateMCQAt(index: number, key: keyof MCQ, value: any) {
    setMcqs((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;
      copy[index] = { ...item, [key]: value };
      return copy;
    });
  }

  async function refineStem(index: number) {
    const mcq = mcqs[index];
    if (!mcq) return;

    const res = await fetch("/api/mcqs/refine-stem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stem: mcq.stem }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      alert(json.error || "Lỗi refine stem.");
      return;
    }
    if (json.refined) updateMCQAt(index, "stem", json.refined);
  }

  async function refineDistractor(index: number, di: number) {
    const mcq = mcqs[index];
    if (!mcq) return;

    const res = await fetch("/api/mcqs/refine-distractor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: mcq.distractors[di] }),
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

      if (selectedAU.llo_id) {
        await supabase.from("mcq_item_llos").insert({
          mcq_item_id: mcqId,
          llo_id: selectedAU.llo_id,
        });
      }

      const labels = ["A", "B", "C", "D", "E", "F"];

      const optionRows = [
        {
          item_id: mcqId,
          label: labels[0],
          text: mcq.correct_answer,
          is_correct: true,
          misconception_id: null,
        },
        ...mcq.distractors.slice(0, labels.length - 1).map((d: string, i: number) => ({
          item_id: mcqId,
          label: labels[i + 1],
          text: d,
          is_correct: false,
          misconception_id: null,
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

      alert(`MCQ #${index + 1} đã được lưu!`);
    } catch (e) {
      console.error(e);
      alert("Lỗi server khi lưu MCQ.");
    } finally {
      setSavingIndex(null);
    }
  }

  const selectedLloObj = llos.find((l) => l.id === selectedLloId) ?? null;

  // ========== RENDER ==========
  return (
    <div className="h-[calc(100vh-60px)] bg-gray-50 p-6 pb-24">
      <div className="max-w-6xl mx-auto h-full flex flex-col gap-4">
        <MCQHeader context={context} />

        <SelectorBar
          courses={courses}
          lessons={lessons}
          llos={llos}
          aus={aus}
          selectedCourseId={selectedCourseId}
          selectedLessonId={selectedLessonId}
          selectedLloId={selectedLloId}
          selectedAU={selectedAU}
          onChangeCourseId={setSelectedCourseId}
          onChangeLessonId={setSelectedLessonId}
          onChangeLloId={setSelectedLloId}
          onChangeAU={chooseAUById}
          questionCount={questionCount}
          onChangeQuestionCount={setQuestionCount}
          stemLength={stemLength}
          onChangeStemLength={setStemLength}
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          clinicalVignette={clinicalVignette}
          onToggleClinicalVignette={setClinicalVignette}
          loadingGen={loadingGen}
          onGenerateMCQs={handleGenerateMCQs}
        />

        <ExistingMcqList
          existingMcqs={existingMcqs}
          loading={existingLoading}
          selectedLlo={selectedLloObj}
          selectedAU={selectedAU}
        />

        <div className="grid grid-cols-1 md:grid-cols-[280px,1fr] gap-4 flex-1 overflow-hidden">
          <MisconList
            selectedAU={selectedAU}
            miscons={miscons}
            selectedMisIdx={selectedMisIdx}
            onToggleMisIndex={toggleMisIndex}
          />

          <MCQList
            mcqs={mcqs}
            nbmeResults={nbmeResults}
            eduFitResults={eduFitResults}
            nbmeLoadingIndex={nbmeLoadingIndex}
            eduLoadingIndex={eduLoadingIndex}
            savingIndex={savingIndex}
            onUpdateMCQ={updateMCQAt}
            onRefineStem={refineStem}
            onRefineDistractor={refineDistractor}
            onRunNbmeCheck={runNbmeCheck}
            onRunEduFitCheck={runEduFitCheck}
            onSaveOneMCQ={saveOneMCQ}
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/wizard/misconcepts")}
            className={
              "px-3 py-1.5 rounded-full border transition text-xs font-medium " +
              "border-slate-300 bg-white text-slate-700 " +
              "hover:border-brand-400 hover:text-brand-700"
            }
          >
            ← Quay lại Bước 3
          </button>

          <button
            type="button"
            onClick={() => router.push("/wizard/simulate")}
            className={
              "px-3.5 py-1.5 rounded-full border transition text-xs font-semibold " +
              "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
            }
          >
            Tiếp tục Bước 5 →
          </button>
        </div>
      </div>
    </div>
  );
}
