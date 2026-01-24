"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";


import {
  AU,
  Course,
  Lesson,
  LLO,
  MCQCardState,
  MCQListItem,
  PersonaWeight,
  SimResult,
} from "./types";
import { computeShapleyFromSim } from "./utils/shapley";
import { CourseLessonSelector } from "./components/CourseLessonSelector";
import { PersonaWeightsTable } from "./components/PersonaWeightsTable";
import { MCQListPanel } from "./components/MCQListPanel";
import { MCQCard } from "./components/MCQCard";

const PAGE = 1000;

export default function MCQSimulateMultiPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [userId, setUserId] = useState<string | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const [llos, setLlos] = useState<LLO[]>([]);
  const [selectedLlo, setSelectedLlo] = useState<LLO | null>(null);

  const [aus, setAus] = useState<AU[]>([]);
  const [selectedAu, setSelectedAu] = useState<AU | null>(null);

  const [mcqList, setMcqList] = useState<MCQListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState<MCQCardState[]>([]);

  const [initLoading, setInitLoading] = useState(false);

  const [personaWeights, setPersonaWeights] = useState<PersonaWeight[]>([]);

  useEffect(() => {
    setPersonaWeights([
      { name: "Expert", weight: 5 },
      { name: "Proficient", weight: 20 },
      { name: "Average", weight: 40 },
      { name: "Novice", weight: 20 },
      { name: "Weak", weight: 10 },
      { name: "Guesser", weight: 5 },
    ]);
  }, []);

  const totalPersonaWeight = useMemo(
    () => personaWeights.reduce((s, p) => s + (p.weight || 0), 0),
    [personaWeights]
  );

  function updatePersonaWeight(name: string, w: number) {
    setPersonaWeights((prev) =>
      prev.map((p) => (p.name === name ? { ...p, weight: w } : p))
    );
  }

  // INIT: user + courses
  useEffect(() => {
    async function init() {
      setInitLoading(true);
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setCourses([]);
        setInitLoading(false);
        return;
      }

      let allCourses: Course[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("courses")
          .select("id, title, code")
          .eq("owner_id", uid)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) {
          console.error("Error loading courses:", error.message);
          break;
        }
        if (!data || data.length === 0) break;
        allCourses = allCourses.concat(data as Course[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      setCourses(allCourses);
      setInitLoading(false);
    }

    init();
  }, [supabase]);

  // helpers chỉnh card
  function updateCard(
    id: string,
    updater: (card: MCQCardState) => MCQCardState
  ) {
    setCards((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  // chọn course
  async function handleSelectCourse(course: Course | null) {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setSelectedLlo(null);
    setSelectedAu(null);

    setLessons([]);
    setLlos([]);
    setAus([]);
    setMcqList([]);
    setSelectedIds(new Set());
    setCards([]);

    if (!course || !userId) return;

    // Lessons
    let allLessons: Lesson[] = [];
    let fromL = 0;
    while (true) {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title")
        .eq("owner_id", userId)
        .eq("course_id", course.id)
        .order("order_in_course", { ascending: true })
        .range(fromL, fromL + PAGE - 1);

      if (error) {
        console.error("Error loading lessons:", error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allLessons = allLessons.concat(data as Lesson[]);
      if (data.length < PAGE) break;
      fromL += PAGE;
    }
    setLessons(allLessons);

    // LLO cho toàn course
    let allLlos: LLO[] = [];
    let fromLo = 0;
    while (true) {
      const { data, error } = await supabase
        .from("llos")
        .select("id, text")
        .eq("owner_id", userId)
        .eq("course_id", course.id)
        .order("created_at", { ascending: true })
        .range(fromLo, fromLo + PAGE - 1);

      if (error) {
        console.error("Error loading LLOs:", error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allLlos = allLlos.concat(data as LLO[]);
      if (data.length < PAGE) break;
      fromLo += PAGE;
    }
    setLlos(allLlos);
  }

  // chọn lesson
  async function handleSelectLesson(lesson: Lesson | null) {
    setSelectedLesson(lesson);
    setSelectedLlo(null);
    setSelectedAu(null);
    setAus([]);
    setMcqList([]);
    setSelectedIds(new Set());
    setCards([]);

    if (!lesson || !selectedCourse || !userId) return;

    const { data, error } = await supabase
      .from("llos")
      .select("id, text")
      .eq("owner_id", userId)
      .eq("course_id", selectedCourse.id)
      .eq("lesson_id", lesson.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error filtering LLOs by lesson:", error.message);
      return;
    }
    setLlos((data as LLO[]) || []);
  }

  // chọn LLO
  async function handleSelectLlo(llo: LLO | null) {
    setSelectedLlo(llo);
    setSelectedAu(null);
    setAus([]);
    setMcqList([]);
    setSelectedIds(new Set());
    setCards([]);

    if (!llo || !selectedCourse || !selectedLesson || !userId) return;

    const { data, error } = await supabase
      .from("assessment_units")
      .select("id, core_statement")
      .eq("owner_id", userId)
      .eq("course_id", selectedCourse.id)
      .eq("lesson_id", selectedLesson.id)
      .eq("llo_id", llo.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading AUs:", error.message);
      return;
    }

    setAus((data as AU[]) || []);
  }

  // chọn AU
  async function handleSelectAu(au: AU | null) {
    setSelectedAu(au);
    setMcqList([]);
    setSelectedIds(new Set());
    setCards([]);

    if (!userId || !selectedCourse || !au) return;

    setListLoading(true);

    const { data, error } = await supabase
      .from("mcq_items")
      .select("id, stem, au_id")
      .eq("owner_id", userId)
      .eq("course_id", selectedCourse.id)
      .eq("au_id", au.id)
      .order("created_at", { ascending: false });

    setListLoading(false);

    if (error) {
      console.error("Error loading MCQs:", error.message);
      return;
    }

    setMcqList((data as MCQListItem[]) || []);
  }

  // load chi tiết MCQ
  async function loadMCQCard(item: MCQListItem) {
    if (cards.some((c) => c.id === item.id)) return;

    const { data: itemData, error: itemError } = await supabase
      .from("mcq_items")
      .select("id, stem")
      .eq("id", item.id)
      .single();

    if (itemError || !itemData) {
      console.error("Error loading mcq_items:", itemError?.message);
      return;
    }

    const { data: optData, error: optError } = await supabase
      .from("mcq_options")
      .select("label, text, is_correct")
      .eq("item_id", item.id)
      .order("label", { ascending: true });

    if (optError) {
      console.error("Error loading mcq_options:", optError.message);
    }

    let correct_answer = "";
    const explanation = "";
    let distractors: string[] = [];

    if (optData && optData.length > 0) {
      const options = optData as {
        label: string;
        text: string;
        is_correct: boolean;
      }[];

      const correctOpt =
        options.find((o) => o.is_correct) ||
        options.find((o) => o.label === "A");

      if (correctOpt) {
        correct_answer = correctOpt.text;
      }

      distractors = options
        .filter((o) => !o.is_correct)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((o) => o.text);
    }

    let simResult: SimResult | null = null;
    let shapleyRows = null;

    const { data: metricData } = await supabase
      .from("mcq_metrics")
      .select("payload")
      .eq("item_id", item.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (metricData?.payload) {
      const payload = metricData.payload as any;
      if (payload.simResult) simResult = payload.simResult as SimResult;
      if (payload.shapleyRows)
        shapleyRows = payload.shapleyRows as MCQCardState["shapleyRows"];
    }

    setCards((prev) => [
      ...prev,
      {
        id: item.id,
        stem: (itemData.stem as string) || "",
        correct_answer,
        explanation,
        distractors,
        simN: 1200,
        simLoading: false,
        simResult,
        shapleyRows,
        saving: false,
        refineIndex: null,
      },
    ]);
  }

  // toggle chọn MCQ
  async function toggleSelectMCQ(item: MCQListItem) {
    const newSet = new Set(selectedIds);
    if (newSet.has(item.id)) {
      newSet.delete(item.id);
      setSelectedIds(newSet);
      setCards((prev) => prev.filter((c) => c.id !== item.id));
    } else {
      newSet.add(item.id);
      setSelectedIds(newSet);
      await loadMCQCard(item);
    }
  }

  // chạy mô phỏng cho 1 card
  async function runSimulationFor(id: string) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    const { stem, correct_answer, explanation, distractors, simN } = card;
    if (!stem.trim() || !correct_answer.trim() || distractors.length === 0) {
      alert("Thiếu stem, đáp án đúng hoặc distractor.");
      return;
    }

    if (totalPersonaWeight <= 0) {
      alert("Tổng % persona phải > 0.");
      return;
    }

    const persona_mix: Record<string, number> = {};
    personaWeights.forEach((p) => {
      const w = Math.max(p.weight || 0, 0);
      persona_mix[p.name] = w;
    });

    updateCard(id, (c) => ({
      ...c,
      simLoading: true,
      simResult: null,
      shapleyRows: null,
    }));

    const res = await fetch("/api/mcqs/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem,
        correct_answer,
        distractors,
        explanation,
        N: simN,
        persona_mix,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.error) {
      console.error("simulate error:", json);
      updateCard(id, (c) => ({ ...c, simLoading: false }));
      alert(json?.error || "Lỗi mô phỏng Monte Carlo.");
      return;
    }

    const simResult = json as SimResult;
    const shapleyRows = computeShapleyFromSim(simResult);

    updateCard(id, (c) => ({
      ...c,
      simLoading: false,
      simResult,
      shapleyRows,
    }));
  }

  // refine distractor
  async function refineDistractor(id: string, idx: number) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    const text = card.distractors[idx];
    if (!text || !text.trim()) return;

    updateCard(id, (c) => ({ ...c, refineIndex: idx }));

    const res = await fetch("/api/mcqs/refine-distractor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.error) {
      console.error("refine-distractor error:", json);
      updateCard(id, (c) => ({ ...c, refineIndex: null }));
      alert(json?.error || "Lỗi refine distractor.");
      return;
    }

    const refined = (json.refined as string)?.trim();
    if (refined) {
      updateCard(id, (c) => {
        const ds = [...c.distractors];
        ds[idx] = refined;
        return { ...c, distractors: ds, refineIndex: null };
      });
    } else {
      updateCard(id, (c) => ({ ...c, refineIndex: null }));
    }
  }

  // lưu card
  async function saveCard(id: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || !userId) return;

    const { stem, correct_answer, distractors, simResult, shapleyRows } = card;

    if (!stem.trim() || !correct_answer.trim() || distractors.length === 0) {
      alert("Vui lòng đảm bảo có stem, đáp án đúng và ít nhất một distractor.");
      return;
    }

    updateCard(id, (c) => ({ ...c, saving: true }));

    try {
      const { error: updError } = await supabase
        .from("mcq_items")
        .update({ stem })
        .eq("id", id);

      if (updError) {
        console.error("Error updating mcq_items:", updError.message);
        alert("Lỗi khi cập nhật mcq_items.");
        updateCard(id, (c) => ({ ...c, saving: false }));
        return;
      }

      const { error: delError } = await supabase
        .from("mcq_options")
        .delete()
        .eq("item_id", id);

      if (delError) {
        console.error("Error deleting mcq_options:", delError.message);
        alert("Lỗi khi xóa mcq_options cũ.");
        updateCard(id, (c) => ({ ...c, saving: false }));
        return;
      }

      const labels = ["A", "B", "C", "D", "E", "F"];
      const rows = [
        {
          item_id: id,
          label: labels[0],
          text: correct_answer,
          is_correct: true,
          misconception_id: null,
        },
        ...distractors.map((d, i) => ({
          item_id: id,
          label: labels[i + 1],
          text: d,
          is_correct: false,
          misconception_id: null,
        })),
      ];

      const { error: insError } = await supabase.from("mcq_options").insert(rows);

      if (insError) {
        console.error("Error inserting mcq_options:", insError.message);
        alert("Lỗi khi lưu mcq_options.");
        updateCard(id, (c) => ({ ...c, saving: false }));
        return;
      }

      if (simResult && shapleyRows) {
        const { error: metricError } = await supabase
          .from("mcq_metrics")
          .insert({
            item_id: id,
            payload: { simResult, shapleyRows },
          });

        if (metricError) {
          console.error("Error inserting mcq_metrics:", metricError.message);
        }
      }

      alert("Đã lưu MCQ và phân tích!");
    } catch (e: any) {
      console.error("saveCard error:", e);
      alert("Lỗi server khi lưu MCQ.");
    } finally {
      updateCard(id, (c) => ({ ...c, saving: false }));
    }
  }

  const totalSelected = useMemo(() => selectedIds.size, [selectedIds]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Bước 5 – Monte Carlo và Shapley cho nhiều MCQ
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Chọn Học phần, Bài học, LLO, AU rồi tick nhiều MCQ để phân tích song
            song. Mỗi câu được mô phỏng bởi nhiều nhóm người học (persona), sau đó
            tính Shapley để đánh giá sức mạnh distractor.
          </p>
        </div>
      </div>

      {/* COURSE / LESSON / LLO / AU */}
      <CourseLessonSelector
        courses={courses}
        lessons={lessons}
        llos={llos}
        aus={aus}
        selectedCourse={selectedCourse}
        selectedLesson={selectedLesson}
        selectedLlo={selectedLlo}
        selectedAu={selectedAu}
        initLoading={initLoading}
        onSelectCourse={handleSelectCourse}
        onSelectLesson={handleSelectLesson}
        onSelectLlo={handleSelectLlo}
        onSelectAu={handleSelectAu}
      />

      {/* MCQ LIST */}
      <MCQListPanel
        mcqList={mcqList}
        listLoading={listLoading}
        selectedIds={selectedIds}
        totalSelected={totalSelected}
        onToggle={toggleSelectMCQ}
      />

      {/* PERSONA WEIGHTS */}
      <PersonaWeightsTable
        personaWeights={personaWeights}
        totalPersonaWeight={totalPersonaWeight}
        onChangeWeight={updatePersonaWeight}
      />

      {/* MCQ CARDS */}
      {cards.length > 0 && (
        <div className="space-y-6">
          {cards.map((card) => (
            <MCQCard
              key={card.id}
              card={card}
              onChangeStem={(val) =>
                updateCard(card.id, (c) => ({ ...c, stem: val }))
              }
              onChangeExplanation={(val) =>
                updateCard(card.id, (c) => ({ ...c, explanation: val }))
              }
              onChangeCorrectAnswer={(val) =>
                updateCard(card.id, (c) => ({ ...c, correct_answer: val }))
              }
              onChangeDistractor={(idx, val) =>
                updateCard(card.id, (c) => {
                  const ds = [...c.distractors];
                  ds[idx] = val;
                  return { ...c, distractors: ds };
                })
              }
              onChangeSimN={(val) =>
                updateCard(card.id, (c) => ({ ...c, simN: val }))
              }
              onRunSimulation={() => runSimulationFor(card.id)}
              onSave={() => saveCard(card.id)}
              onRefineDistractor={(idx) => refineDistractor(card.id, idx)}
            />
          ))}
        </div>
      )}

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/wizard/mcq")}
            className={
              "px-3 py-1.5 rounded-full border transition text-xs font-medium " +
              "border-slate-300 bg-white text-slate-700 " +
              "hover:border-brand-400 hover:text-brand-700"
            }
          >
            ← Quay lại Bước 4
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={
              "px-3 py-1.5 rounded-full border transition text-xs font-medium " +
              "border-slate-300 bg-white text-slate-700 " +
              "hover:border-brand-400 hover:text-brand-700"
            }
          >
            Quay lại Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
