"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** COURSE / LESSON / LLO / AU TYPES */
type Course = {
  id: string;
  title: string;
  code: string | null;
};

type Lesson = {
  id: string;
  title: string;
};

type LLO = {
  id: string;
  text: string;
};

type AU = {
  id: string;
  core_statement: string;
};

/** MCQ LIST + DETAIL TYPES */
type MCQListItem = {
  id: string;
  stem: string;
  au_id: string | null;
};

/** SIMULATION TYPES */
type SimOption = {
  label: string; // A, B, C, D
  text: string;
  is_correct: boolean;
};

type PersonaProb = {
  name: string;
  probs: Record<string, number>; // { A: 0.9, B: ... }
};

type AccuracyRow = {
  persona: string;
  accuracy: number;
  total: number;
};

type ResponseRow = {
  persona: string;
  chosen_option: string; // A, B, C, D
  chosen_text: string;
  is_correct: boolean;
};

type SimResult = {
  options: SimOption[];
  personas: PersonaProb[];
  N_per_persona: number;
  accuracy_summary: AccuracyRow[];
  response_matrix: ResponseRow[];
};

/** SHAPLEY TYPES */
type ShapleyRow = {
  label: string;
  text: string;
  shapley: number; // 0–1
  share_pct: number;
  wrong_pct: number;
  novice_pct: number;
  recommendation: string;
};

/** PERSONA WEIGHT UI */
type PersonaWeight = {
  name: string;
  weight: number; // percent
};

/** STATE CHO TỪNG CARD MCQ */
type MCQCardState = {
  id: string;
  stem: string;
  correct_answer: string;
  explanation: string;
  distractors: string[];
  simN: number; // tổng N Monte Carlo
  simLoading: boolean;
  simResult: SimResult | null;
  shapleyRows: ShapleyRow[] | null;
  saving: boolean;
  refineIndex: number | null; // distractor đang refine
};

const PAGE = 1000;

// ---------- HÀM TÍNH SHAPLEY ----------
function computeShapleyFromSim(sim: SimResult): ShapleyRow[] {
  const distractorLabels = sim.options
    .filter((o) => !o.is_correct)
    .map((o) => o.label);

  const allLabels = ["B", "C", "D", "E", "F"];
  const orderedLabels = allLabels.filter((l) => distractorLabels.includes(l));

  const wrongCounts: Record<string, number> = {};
  const wrongCountsNovice: Record<string, number> = {};

  const lowAbility = new Set(["Novice", "Weak"]);
  let totalWrongAll = 0;
  let totalWrongLow = 0;

  for (const row of sim.response_matrix) {
    if (!row.is_correct) {
      totalWrongAll++;
      wrongCounts[row.chosen_option] =
        (wrongCounts[row.chosen_option] || 0) + 1;
      if (lowAbility.has(row.persona)) {
        totalWrongLow++;
        wrongCountsNovice[row.chosen_option] =
          (wrongCountsNovice[row.chosen_option] || 0) + 1;
      }
    }
  }

  if (totalWrongAll === 0) {
    // Item quá dễ
    return orderedLabels.map((label) => {
      const opt = sim.options.find((o) => o.label === label)!;
      return {
        label,
        text: opt.text,
        shapley: 0,
        share_pct: 0,
        wrong_pct: 0,
        novice_pct: 0,
        recommendation:
          "Item quá dễ, hầu hết người học trả lời đúng – khó đánh giá distractor.",
      };
    });
  }

  const n = orderedLabels.length;
  const countsArr = orderedLabels.map((l) => wrongCounts[l] || 0);

  function v(subset: Set<number>): number {
    let sum = 0;
    subset.forEach((idx) => {
      sum += countsArr[idx];
    });
    return sum / totalWrongAll;
  }

  function permutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];
    const result: number[][] = [];
    const [first, ...rest] = arr;
    const perms = permutations(rest);
    for (const p of perms) {
      for (let i = 0; i <= p.length; i++) {
        const copy = [...p];
        copy.splice(i, 0, first);
        result.push(copy);
      }
    }
    return result;
  }

  const perms = permutations([...Array(n).keys()]);
  const shapleyArr = new Array(n).fill(0);

  for (const perm of perms) {
    const S = new Set<number>();
    for (const j of perm) {
      const before = v(S);
      S.add(j);
      const after = v(S);
      const delta = after - before;
      shapleyArr[j] += delta;
    }
  }

  const factor = 1 / perms.length;
  for (let i = 0; i < n; i++) {
    shapleyArr[i] *= factor;
  }

  const rows: ShapleyRow[] = [];
  for (let i = 0; i < n; i++) {
    const label = orderedLabels[i];
    const opt = sim.options.find((o) => o.label === label)!;
    const shap = shapleyArr[i];
    const share_pct = shap * 100;

    const wrong_pct =
      ((wrongCounts[label] || 0) / sim.response_matrix.length) * 100;
    const novice_pct =
      totalWrongLow > 0
        ? ((wrongCountsNovice[label] || 0) / totalWrongLow) * 100
        : 0;

    let recommendation: string;
    if (share_pct >= 40) {
      recommendation =
        "Distractor rất mạnh – nên giữ, có vai trò lớn trong việc phân tán câu trả lời sai.";
    } else if (share_pct >= 25) {
      recommendation =
        "Distractor khá mạnh – nên giữ, có thể tinh chỉnh wording để rõ ràng hơn.";
    } else if (share_pct >= 10) {
      recommendation =
        "Distractor trung bình – có thể giữ nếu cần đủ bốn lựa chọn, cân nhắc cải thiện để hấp dẫn hơn.";
    } else {
      recommendation =
        "Distractor yếu – ít đóng góp vào câu sai, cân nhắc thay bằng distractor khác hoặc bỏ.";
    }

    rows.push({
      label,
      text: opt.text,
      shapley: shap,
      share_pct,
      wrong_pct,
      novice_pct,
      recommendation,
    });
  }

  return rows;
}

// ===========================
// COMPONENT BƯỚC 5 – MULTI MCQ
// ===========================
export default function MCQSimulateMultiPage() {
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

  // ---- Persona weights (tổng ~ 100%) ----
  const [personaWeights, setPersonaWeights] = useState<PersonaWeight[]>([
    { name: "Expert", value: 5 } as any, // tránh nhầm – fix bên dưới
  ] as any); // TEMP init để TS không kêu – sẽ override ngay sau useEffect

  // khởi tạo đúng giá trị 1 lần
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

  // ----- INIT: lấy user + courses -----
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
  }, []);

  // ----- chọn course → reset & load lessons + LLO -----
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

    // LLO cho toàn course (lọc thêm theo lesson khi user chọn)
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

  // ----- chọn lesson → chỉ dùng để filter LLO & AU -----
  async function handleSelectLesson(lesson: Lesson | null) {
    setSelectedLesson(lesson);
    setSelectedLlo(null);
    setSelectedAu(null);
    setAus([]);
    setMcqList([]);
    setSelectedIds(new Set());
    setCards([]);

    if (!lesson || !selectedCourse || !userId) return;

    // Lọc lại LLO theo lesson
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

  // ----- chọn LLO → load AU thuộc LLO đó -----
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

  // ----- chọn AU → load MCQs -----
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

  // ----- load chi tiết 1 MCQ (stem + options + metrics) để thêm card -----
  async function loadMCQCard(item: MCQListItem) {
    if (cards.some((c) => c.id === item.id)) return;

    // 1) lấy stem
    const { data: itemData, error: itemError } = await supabase
      .from("mcq_items")
      .select("id, stem")
      .eq("id", item.id)
      .single();

    if (itemError || !itemData) {
      console.error("Error loading mcq_items:", itemError?.message);
      return;
    }

    // 2) lấy options từ mcq_options
    const { data: optData, error: optError } = await supabase
      .from("mcq_options")
      .select("label, text, is_correct")
      .eq("item_id", item.id)
      .order("label", { ascending: true });

    if (optError) {
      console.error("Error loading mcq_options:", optError.message);
    }

    let correct_answer = "";
    const explanation = ""; // hiện chưa có cột trong schema
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

    // 3) lấy metrics mới nhất (nếu có)
    let simResult: SimResult | null = null;
    let shapleyRows: ShapleyRow[] | null = null;

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
      if (payload.shapleyRows) shapleyRows = payload.shapleyRows as ShapleyRow[];
    }

    setCards((prev) => [
      ...prev,
      {
        id: item.id,
        stem: (itemData.stem as string) || "",
        correct_answer,
        explanation,
        distractors,
        simN: 1200, // default: 6 persona x 200
        simLoading: false,
        simResult,
        shapleyRows,
        saving: false,
        refineIndex: null,
      },
    ]);
  }

  // ----- toggle chọn MCQ -----
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

  // ----- helpers chỉnh sửa card -----
  function updateCard(
    id: string,
    updater: (card: MCQCardState) => MCQCardState
  ) {
    setCards((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  // ----- chạy mô phỏng cho 1 card -----
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

    // chuẩn hóa về 1.0 để backend dễ dùng
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
        persona_mix, // 👈 gửi phân bố persona lên backend
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

  // ----- refine distractor 1 card -----
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

  // ----- lưu MCQ + options + metrics -----
  async function saveCard(id: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || !userId) return;

    const {
      stem,
      correct_answer,
      explanation,
      distractors,
      simResult,
      shapleyRows,
    } = card;

    if (!stem.trim() || !correct_answer.trim() || distractors.length === 0) {
      alert("Vui lòng đảm bảo có stem, đáp án đúng và ít nhất một distractor.");
      return;
    }

    updateCard(id, (c) => ({ ...c, saving: true }));

    try {
      // 1) update mcq_items (chỉ stem, vì schema hiện không có correct_answer / explanation)
      const { error: updError } = await supabase
        .from("mcq_items")
        .update({
          stem,
        })
        .eq("id", id);

      if (updError) {
        console.error("Error updating mcq_items:", updError.message);
        alert("Lỗi khi cập nhật mcq_items.");
        updateCard(id, (c) => ({ ...c, saving: false }));
        return;
      }

      // 2) delete options cũ
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

      // 3) insert options mới: A = correct_answer, B.. = distractors
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

      const { error: insError } = await supabase
        .from("mcq_options")
        .insert(rows);

      if (insError) {
        console.error("Error inserting mcq_options:", insError.message);
        alert("Lỗi khi lưu mcq_options.");
        updateCard(id, (c) => ({ ...c, saving: false }));
        return;
      }

      // 4) lưu metrics nếu có
      if (simResult && shapleyRows) {
        const { error: metricError } = await supabase
          .from("mcq_metrics")
          .insert({
            item_id: id,
            payload: {
              simResult,
              shapleyRows,
            },
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

  // ============== UI ==============
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Bước 5 – Monte Carlo và Shapley cho nhiều MCQ
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Chọn Học phần, Bài học, LLO, AU rồi tick nhiều MCQ để phân tích
            song song. Mỗi câu được mô phỏng bởi nhiều nhóm người học
            (persona), sau đó tính Shapley để đánh giá sức mạnh distractor.
          </p>
        </div>
        {initLoading && (
          <div className="text-xs text-slate-500">
            Đang tải danh sách Học phần...
          </div>
        )}
      </div>

      {/* CARD 1: CHUỖI CHỌN COURSE → LESSON → LLO → AU */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="text-xs font-semibold text-slate-700 mb-1">
          Chuỗi chọn Học phần, Bài học, LLO và Assessment Unit
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          {/* Course */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Học phần (Course)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              value={selectedCourse?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const c = courses.find((cc) => cc.id === id) || null;
                handleSelectCourse(c);
              }}
            >
              <option value="">-- Chọn Học phần --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} – ${c.title}` : c.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Chỉ hiển thị các Học phần mà bạn sở hữu.
            </p>
          </div>

          {/* Lesson */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Bài học (Lesson)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:bg-slate-50"
              value={selectedLesson?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const l = lessons.find((ll) => ll.id === id) || null;
                handleSelectLesson(l);
              }}
              disabled={!selectedCourse}
            >
              <option value="">
                {selectedCourse ? "-- Chọn Bài học --" : "Chọn Học phần trước"}
              </option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Lesson giúp thu hẹp LLO và Assessment Unit tương ứng.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-xs">
          {/* LLO */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Learning Level Outcome (LLO)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:bg-slate-50"
              value={selectedLlo?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const llo = llos.find((ll) => ll.id === id) || null;
                handleSelectLlo(llo);
              }}
              disabled={!selectedLesson}
            >
              <option value="">
                {selectedLesson ? "-- Chọn LLO --" : "Chọn Bài học trước"}
              </option>
              {llos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.text}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              LLO dùng để lọc Assessment Unit trong Bài học này.
            </p>
          </div>

          {/* AU */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Assessment Unit (AU)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:bg-slate-50"
              value={selectedAu?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const au = aus.find((aa) => aa.id === id) || null;
                handleSelectAu(au);
              }}
              disabled={!selectedLlo}
            >
              <option value="">
                {selectedLlo ? "-- Chọn Assessment Unit --" : "Chọn LLO trước"}
              </option>
              {aus.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.core_statement}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              MCQ ở dưới sẽ được lọc theo AU đã chọn.
            </p>
          </div>
        </div>
      </div>

      {/* CARD 2: DANH SÁCH MCQ */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-700">
              Danh sách MCQ trong Assessment Unit đã chọn
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tick các câu MCQ bạn muốn phân tích. Mỗi câu sẽ xuất hiện ở một
              card riêng bên dưới.
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            Tổng MCQ:{" "}
            <span className="font-semibold text-slate-800">
              {mcqList.length}
            </span>{" "}
            – Đang chọn:{" "}
            <span className="font-semibold text-indigo-700">
              {totalSelected}
            </span>
          </div>
        </div>

        <div className="border rounded-xl max-h-72 overflow-y-auto text-xs">
          {listLoading && (
            <div className="p-3 text-slate-400">Đang tải danh sách MCQ...</div>
          )}

          {!listLoading && mcqList.length === 0 && (
            <div className="p-3 text-slate-400">
              Chưa có câu MCQ nào cho AU này, hoặc chưa gắn AU cho các MCQ.
            </div>
          )}

          {!listLoading &&
            mcqList.map((q) => (
              <label
                key={q.id}
                className="flex items-start gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleSelectMCQ(q)}
                />
                <div>
                  <div className="font-medium text-slate-800 line-clamp-2">
                    {q.stem}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Đáp án đúng đang lưu trong mcq_options (label A).
                  </div>
                </div>
              </label>
            ))}
        </div>
      </div>

      {/* CARD 2b: PHÂN BỐ PERSONA */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-700">
              Phân bố nhóm người học (persona) trong mô phỏng
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Thiết lập % Expert / Proficient / Average / Novice / Weak /
              Guesser. Các % này dùng chung cho tất cả câu MCQ ở bước này.
            </p>
          </div>
          <div
            className={`text-[11px] px-2 py-1 rounded-full ${
              Math.abs(totalPersonaWeight - 100) < 1e-6
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            Tổng: <b>{totalPersonaWeight}%</b>{" "}
            {Math.abs(totalPersonaWeight - 100) > 1e-6 && "(nên ≈ 100%)"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[420px] text-xs border">
            <thead>
              <tr className="bg-slate-100">
                <th className="border px-2 py-1 text-left">Persona</th>
                <th className="border px-2 py-1 text-right">% trong lớp</th>
              </tr>
            </thead>
            <tbody>
              {personaWeights.map((p) => (
                <tr key={p.name}>
                  <td className="border px-2 py-1">{p.name}</td>
                  <td className="border px-2 py-1 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        className="w-16 border rounded-md px-2 py-1 text-xs text-right outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                        value={p.weight}
                        onChange={(e) =>
                          updatePersonaWeight(
                            p.name,
                            Number(e.target.value) || 0
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500">
          Ví dụ: lớp nhiều sinh viên trung bình/yếu có thể đặt Average 40%,
          Novice 30%, Weak 15%, Expert 5%, Proficient 5%, Guesser 5%.
        </p>
      </div>

      {/* CARDS 3+: MỖI MCQ 1 CARD RIÊNG */}
      {cards.length > 0 && (
        <div className="space-y-6">
          {cards.map((card) => {
            const sim = card.simResult;
            const shapRows = card.shapleyRows;

            return (
              <div
                key={card.id}
                className="bg-white border rounded-2xl shadow-sm p-5 space-y-4"
              >
                {/* HEADER CARD */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-700">
                      MCQ: {card.id.slice(0, 8)}…
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xl">
                      Chỉnh sửa stem, đáp án, distractor; sau đó chạy mô phỏng
                      Monte Carlo và Shapley cho riêng câu này.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">
                        N mô phỏng (tổng):
                      </span>
                      <input
                        type="number"
                        min={400}
                        max={10000}
                        step={200}
                        className="w-20 border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                        value={card.simN}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          updateCard(card.id, (c) => ({
                            ...c,
                            simN: Math.min(Math.max(val, 400), 10000),
                          }));
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => runSimulationFor(card.id)}
                      disabled={card.simLoading}
                      className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50"
                    >
                      {card.simLoading
                        ? "Đang mô phỏng..."
                        : "Chạy mô phỏng (GPT + Monte Carlo)"}
                    </button>

                    <button
                      type="button"
                      onClick={() => saveCard(card.id)}
                      disabled={card.saving}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {card.saving
                        ? "Đang lưu MCQ..."
                        : "Lưu MCQ và phân tích"}
                    </button>
                  </div>
                </div>

                {/* STEM + ANSWER + DISTRACTORS (EDITABLE) */}
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {/* Stem + explanation */}
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold text-slate-800 mb-1">
                        Stem
                      </div>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                        rows={4}
                        value={card.stem}
                        onChange={(e) =>
                          updateCard(card.id, (c) => ({
                            ...c,
                            stem: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-1">
                        Explanation (nếu cần, dùng cho mô phỏng)
                      </div>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                        rows={3}
                        value={card.explanation}
                        onChange={(e) =>
                          updateCard(card.id, (c) => ({
                            ...c,
                            explanation: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Answer + distractors */}
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold text-slate-800 mb-1">
                        Đáp án đúng (A)
                      </div>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                        value={card.correct_answer}
                        onChange={(e) =>
                          updateCard(card.id, (c) => ({
                            ...c,
                            correct_answer: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-1">
                        Distractor (B, C, D...)
                      </div>
                      <div className="space-y-2">
                        {card.distractors.map((d, idx) => {
                          const label = String.fromCharCode(
                            "B".charCodeAt(0) + idx
                          );
                          const shap = card.shapleyRows?.find(
                            (r) => r.label === label
                          );
                          const isWeak = shap && shap.share_pct < 10;

                          return (
                            <div
                              key={idx}
                              className={`flex items-start gap-2 p-2 rounded-lg border ${
                                isWeak
                                  ? "bg-rose-50 border-rose-200"
                                  : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <div className="mt-1 text-xs font-semibold text-slate-700">
                                {label}.
                              </div>
                              <div className="flex-1 space-y-1">
                                <input
                                  className="w-full border rounded-md px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                                  value={d}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateCard(card.id, (c) => {
                                      const ds = [...c.distractors];
                                      ds[idx] = val;
                                      return { ...c, distractors: ds };
                                    });
                                  }}
                                />
                                {shap && (
                                  <div className="text-[10px] text-slate-600">
                                    Shapley:{" "}
                                      <span className="font-semibold">
                                      {shap.share_pct.toFixed(1)}%
                                    </span>{" "}
                                    – Wrong:{" "}
                                    {shap.wrong_pct.toFixed(1)}% – Novice hoặc
                                    Weak: {shap.novice_pct.toFixed(1)}%
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => refineDistractor(card.id, idx)}
                                disabled={card.refineIndex === idx}
                                className="text-[11px] text-brand-700 hover:underline ml-1"
                              >
                                {card.refineIndex === idx
                                  ? "Refining..."
                                  : "Refine"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SIM RESULT */}
                {sim && (
                  <div className="space-y-4">
                    <div>
                      <div className="font-semibold text-slate-800 mb-1">
                        Kết quả mô phỏng theo persona
                      </div>
                      <table className="w-full text-xs border">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border px-2 py-1 text-left">
                              Persona
                            </th>
                            <th className="border px-2 py-1 text-right">
                              % đúng
                            </th>
                            <th className="border px-2 py-1 text-right">
                              N mô phỏng
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sim.accuracy_summary.map((r) => (
                            <tr key={r.persona}>
                              <td className="border px-2 py-1">
                                {r.persona}
                              </td>
                              <td className="border px-2 py-1 text-right">
                                {(r.accuracy * 100).toFixed(1)}%
                              </td>
                              <td className="border px-2 py-1 text-right">
                                {r.total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 mb-1">
                        Xác suất chọn từng phương án (ước lượng bởi GPT)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border px-2 py-1 text-left">
                                Persona
                              </th>
                              {sim.options.map((o) => (
                                <th
                                  key={o.label}
                                  className="border px-2 py-1 text-right"
                                >
                                  {o.label}
                                  {o.is_correct && (
                                    <span className="text-emerald-700 ml-1">
                                      (đ)
                                    </span>
                                  )}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sim.personas.map((p) => (
                              <tr key={p.name}>
                                <td className="border px-2 py-1">
                                  {p.name}
                                </td>
                                {sim.options.map((o) => (
                                  <td
                                    key={o.label}
                                    className="border px-2 py-1 text-right"
                                  >
                                    {((p.probs[o.label] ?? 0) * 100).toFixed(
                                      1
                                    )}
                                    %
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* SHAPLEY TABLE */}
                {shapRows && (
                  <div className="space-y-3">
                    <div className="font-semibold text-slate-800 mb-1">
                      Shapley Distractor Evaluator
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border px-2 py-1 text-left">
                              Distractor
                            </th>
                            <th className="border px-2 py-1 text-right">
                              Shapley
                            </th>
                            <th className="border px-2 py-1 text-right">
                              Strength (%)
                            </th>
                            <th className="border px-2 py-1 text-right">
                              % tất cả lượt chọn
                            </th>
                            <th className="border px-2 py-1 text-right">
                              % Novice + Weak
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {shapRows.map((r) => {
                            const isWeak = r.share_pct < 10;
                            return (
                              <tr
                                key={r.label}
                                className={isWeak ? "bg-rose-50" : "bg-white"}
                              >
                                <td className="border px-2 py-1 align-top">
                                  <div className="font-semibold">{r.label}</div>
                                  <div className="text-gray-700 whitespace-pre-wrap">
                                    {r.text}
                                  </div>
                                </td>
                                <td className="border px-2 py-1 text-right align-top">
                                  {r.shapley.toFixed(3)}
                                </td>
                                <td className="border px-2 py-1 text-right align-top">
                                  {r.share_pct.toFixed(1)}%
                                </td>
                                <td className="border px-2 py-1 text-right align-top">
                                  {r.wrong_pct.toFixed(1)}%
                                </td>
                                <td className="border px-2 py-1 text-right align-top">
                                  {r.novice_pct.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {shapRows.map((r) => (
                      <div
                        key={r.label + "-rec"}
                        className={`border rounded-lg p-2 text-xs ${
                          r.share_pct < 10
                            ? "bg-rose-50 border-rose-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="font-semibold mb-1">
                          {r.label} – Khuyến nghị:
                        </div>
                        <div className="text-gray-800">{r.recommendation}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
