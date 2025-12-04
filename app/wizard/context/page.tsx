"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Specialty = {
  id: string;
  code: string | null;
  name: string;
};

type Course = {
  id: string;
  code: string | null;
  title: string;
};

type Lesson = {
  id: string;
  title: string;
  course_id: string;
};

type ContextState = {
  specialty_id: string;
  learner_level: string;
  bloom_level: string;
  llos_text: string;
  course_id?: string;
  lesson_id?: string;
};

const LEARNER_LEVELS = [
  { value: "undergrad", label: "Sinh viên (Đại học)" },
  { value: "postgrad", label: "Học viên sau đại học" },
  { value: "phd", label: "Nghiên cứu sinh" },
];

const BLOOM_LEVELS = [
  { value: "remember", label: "Remember – Nhớ" },
  { value: "understand", label: "Understand – Hiểu" },
  { value: "apply", label: "Apply – Vận dụng" },
  { value: "analyze", label: "Analyze – Phân tích" },
  { value: "evaluate", label: "Evaluate – Đánh giá" },
  { value: "create", label: "Create – Sáng tạo" },
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [specialtyName, setSpecialtyName] = useState<string | undefined>(undefined);

  const [state, setState] = useState<ContextState>({
    specialty_id: "",
    learner_level: "",
    bloom_level: "",
    llos_text: "",
    course_id: "",
    lesson_id: "",
  });

  // Tạo mới học phần / bài học
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [evalResult, setEvalResult] = useState<LloEvalResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // ====== INIT: kiểm tra login, load specialties, courses, context ======
  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // Load profile (để gợi ý specialty)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, specialty_id")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
      }

      // Load specialties
      const { data: specs, error: specsError } = await supabase
        .from("specialties")
        .select("id, code, name")
        .order("name", { ascending: true });

      if (specsError) {
        console.error("Error loading specialties:", specsError);
        setMsg("Không tải được danh sách chuyên ngành.");
      } else if (specs) {
        setSpecialties(specs);
      }

      // Load courses của user
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("owner_id", session.user.id)
        .order("title", { ascending: true });

      if (courseError) {
        console.error("Error loading courses:", courseError);
      } else if (courseData) {
        setCourses(courseData);
      }

      // Load context từ localStorage nếu có
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("shapleymcq_context");
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ContextState;
            setState((prev) => ({
              ...prev,
              ...parsed,
            }));

            // Nếu có course_id thì load lessons
            if (parsed.course_id) {
              const { data: lessonData, error: lessonError } = await supabase
                .from("lessons")
                .select("id, title, course_id")
                .eq("owner_id", session.user.id)
                .eq("course_id", parsed.course_id)
                .order("order_in_course", { ascending: true });

              if (lessonError) {
                console.error("Error loading lessons:", lessonError);
              } else if (lessonData) {
                setLessons(lessonData);
              }
            }
          } catch {
            // ignore parse error
          }
        } else if (profile?.specialty_id) {
          setState((prev) => ({
            ...prev,
            specialty_id: profile.specialty_id,
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

  // Khi đổi course_id, load lại lessons
  useEffect(() => {
    async function loadLessonsForCourse() {
      if (!state.course_id) {
        setLessons([]);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, course_id")
        .eq("owner_id", session.user.id)
        .eq("course_id", state.course_id)
        .order("order_in_course", { ascending: true });

      if (error) {
        console.error("Error loading lessons:", error);
        setLessons([]);
      } else if (data) {
        setLessons(data);
      }
    }

    loadLessonsForCourse();
  }, [state.course_id]);

  // ====== Helpers ======

  function handleChange<K extends keyof ContextState>(
    key: K,
    value: ContextState[K]
  ) {
    setState((prev) => ({
      ...prev,
      [key]: value,
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

    // Course / Lesson
    if (!state.course_id && !newCourseTitle.trim()) {
      setMsg("Vui lòng chọn hoặc nhập tên Học phần.");
      return false;
    }
    if (!state.lesson_id && !newLessonTitle.trim()) {
      setMsg("Vui lòng chọn hoặc nhập tên Bài học.");
      return false;
    }

    return true;
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

  // ====== SAVE: tạo course/lesson nếu cần, lưu LLO, lưu context ======

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!validate()) return;

    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSaving(false);
      router.push("/login");
      return;
    }

    try {
      // 1) Course
      let courseId = state.course_id || "";

      if (!courseId) {
        const { data, error } = await supabase
          .from("courses")
          .insert({
            owner_id: session.user.id,
            specialty_id: state.specialty_id || null,
            title: newCourseTitle.trim(),
            code: newCourseCode.trim() || null,
          })
          .select("id")
          .single();

        if (error || !data) {
          console.error("Error inserting course:", error);
          setMsg("Lỗi lưu Học phần.");
          setSaving(false);
          return;
        }

        courseId = data.id;
        // cập nhật state để lưu vào localStorage
        setState((prev) => ({ ...prev, course_id: courseId }));
      }

      // 2) Lesson
      let lessonId = state.lesson_id || "";

      if (!lessonId) {
        const { data, error } = await supabase
          .from("lessons")
          .insert({
            owner_id: session.user.id,
            course_id: courseId,
            title: newLessonTitle.trim(),
          })
          .select("id")
          .single();

        if (error || !data) {
          console.error("Error inserting lesson:", error);
          setMsg("Lỗi lưu Bài học.");
          setSaving(false);
          return;
        }

        lessonId = data.id;
        setState((prev) => ({ ...prev, lesson_id: lessonId }));
      }

      // 3) LLOs
      const lloLines = state.llos_text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lloLines.length === 0) {
        setMsg("Không có LLO hợp lệ để lưu.");
        setSaving(false);
        return;
      }

      const insertRows = lloLines.map((text) => ({
        owner_id: session.user.id,
        course_id: courseId,
        lesson_id: lessonId,
        text,
        bloom_suggested: state.bloom_level,
        level_suggested: state.learner_level,
      }));

      const { error: lloError } = await supabase
        .from("llos")
        .insert(insertRows);

      if (lloError) {
        console.error("Error inserting llos:", lloError);
        setMsg("Lỗi lưu LLO vào Supabase.");
        setSaving(false);
        return;
      }

      // 4) Lưu context vào localStorage
      if (typeof window !== "undefined") {
        const contextToSave: ContextState = {
          specialty_id: state.specialty_id,
          learner_level: state.learner_level,
          bloom_level: state.bloom_level,
          llos_text: state.llos_text,
          course_id: courseId,
          lesson_id: lessonId,
        };
        window.localStorage.setItem(
          "shapleymcq_context",
          JSON.stringify(contextToSave)
        );
      }

      setMsg(
        "Đã lưu bối cảnh, Học phần, Bài học và LLO. Chuyển sang Bước 2 (AU)."
      );
      setSaving(false);

      setTimeout(() => {
        router.push("/wizard/au");
      }, 800);
    } catch (err: any) {
      console.error("Error in handleSave:", err);
      setMsg("Lỗi không xác định khi lưu dữ liệu.");
      setSaving(false);
    }
  }

  // ====== GPT: đánh giá LLO & Bloom ======

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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          specialty_name: specialtyName,
          learner_level: state.learner_level,
          bloom_level: state.bloom_level,
          llos_text: state.llos_text,
        }),
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

  // ====== UI ======

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-sm text-slate-600">Đang tải dữ liệu…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Bước 1 – Thiết lập bối cảnh câu hỏi
        </h1>
        <p className="text-sm text-slate-600">
          Chọn chuyên ngành, Học phần, Bài học, bậc đào tạo, mức Bloom và LLO
          của bài cần ra câu hỏi. Sau đó dùng GPT để đánh giá sự phù hợp của LLO
          trước khi đi tiếp sang bước AU &amp; Misconceptions.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white border rounded-2xl shadow-sm p-6 space-y-6"
      >
        {/* Block 1: Chuyên ngành, bậc học, Bloom */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Specialty */}
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
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
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Đối tượng / Bậc đào tạo
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {LEARNER_LEVELS.map((lv) => (
                <button
                  type="button"
                  key={lv.value}
                  onClick={() => handleChange("learner_level", lv.value)}
                  className={
                    "px-3 py-1.5 rounded-full border transition " +
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
          <div className="md:col-span-2">
            <label className="block text-[13px] font-medium text-slate-700 mb-1">
              Mức Bloom mục tiêu
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {BLOOM_LEVELS.map((b) => (
                <button
                  type="button"
                  key={b.value}
                  onClick={() => handleChange("bloom_level", b.value)}
                  className={
                    "px-3 py-1.5 rounded-full border transition " +
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
              Analyze cho case lâm sàng).
            </p>
          </div>
        </div>

        {/* Block 2: Học phần & Bài học */}
        <div className="border rounded-xl p-4 bg-slate-50/60 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Phạm vi Học phần &amp; Bài học
            </h2>
            <span className="text-[11px] text-slate-500">
              Dùng để lưu &amp; tải lại LLO cho từng bài học.
            </span>
          </div>

          {/* Course row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">
                Học phần (Course)
              </label>
              {!creatingCourse ? (
                <>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    value={state.course_id || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleChange("course_id", val);
                      handleChange("lesson_id", ""); // reset lesson khi đổi học phần
                    }}
                  >
                    <option value="">-- Chọn học phần --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code} – ${c.title}` : c.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingCourse(true);
                      setNewCourseTitle("");
                      setNewCourseCode("");
                      handleChange("course_id", "");
                      handleChange("lesson_id", "");
                      setLessons([]);
                    }}
                    className="mt-1 text-[11px] text-brand-700 hover:underline"
                  >
                    + Tạo Học phần mới
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    placeholder="Tên Học phần (ví dụ: Châm cứu học 1)"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                  />
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    placeholder="Mã Học phần (tùy chọn, ví dụ: YHCT301)"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingCourse(false);
                      setNewCourseTitle("");
                      setNewCourseCode("");
                    }}
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    ← Chọn từ danh sách có sẵn
                  </button>
                </div>
              )}
            </div>

            {/* Lesson */}
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">
                Bài học (Lesson)
              </label>
              {!creatingLesson ? (
                <>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    value={state.lesson_id || ""}
                    onChange={(e) => handleChange("lesson_id", e.target.value)}
                    disabled={!state.course_id && !creatingCourse}
                  >
                    <option value="">-- Chọn bài học --</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingLesson(true);
                      setNewLessonTitle("");
                    }}
                    className="mt-1 text-[11px] text-brand-700 hover:underline"
                    disabled={!state.course_id && !creatingCourse}
                  >
                    + Tạo Bài học mới
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    placeholder="Tên Bài học (ví dụ: Châm cứu điều trị đau lưng)"
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingLesson(false);
                      setNewLessonTitle("");
                    }}
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    ← Chọn từ danh sách có sẵn
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Block 3: LLOs */}
        <div>
          <label className="block text-[13px] font-medium text-slate-700 mb-1">
            LLOs của bài cần ra câu hỏi
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 min-h-[140px]"
            value={state.llos_text}
            onChange={(e) => handleChange("llos_text", e.target.value)}
            placeholder={
              "Mỗi dòng một LLO. Ví dụ:\n- Sinh viên giải thích được cơ chế bệnh sinh của ...\n- Sinh viên phân tích được nguyên nhân chính gây ..."
            }
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Các bước sau sẽ dùng LLO này để GPT đánh giá sự phù hợp với Bloom &amp;
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
                <p className="text-[11px] text-slate-600">{item.comments}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
