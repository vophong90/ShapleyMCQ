// app/wizard/context/page.tsx
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

// Giữ llos_text để đọc lại localStorage cũ, nhưng UI sẽ dùng lloList
type ContextState = {
  specialty_id: string;
  learner_level: string;
  bloom_level: string;
  course_id?: string;
  lesson_id?: string;
  llos_text?: string; // chỉ để load cũ, không dùng trực tiếp trong UI
};

type LloLine = {
  id?: string; // để sau này nếu cần map với Supabase
  text: string;
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

  const [specialtyName, setSpecialtyName] = useState<string | undefined>(
    undefined
  );

  const [state, setState] = useState<ContextState>({
    specialty_id: "",
    learner_level: "",
    bloom_level: "",
    course_id: "",
    lesson_id: "",
    llos_text: "",
  });

  // Danh sách LLO để nhập từng dòng + thêm/xóa
  const [lloList, setLloList] = useState<LloLine[]>([{ text: "" }]);

  // Tạo mới học phần / bài học
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // (có thể giữ để hiển thị thông báo sau khi lưu, không dùng để chặn bước)
  const [savedOk, setSavedOk] = useState(false);

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

            // LLO list từ llos_text cũ (nếu có)
            if (parsed.llos_text) {
              const lines = parsed.llos_text
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

              if (lines.length > 0) {
                setLloList(lines.map((t) => ({ text: t })));
              } else {
                setLloList([{ text: "" }]);
              }
            } else {
              setLloList([{ text: "" }]);
            }

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
          } catch (e) {
            console.error("Parse shapleymcq_context error:", e);
            setLloList([{ text: "" }]);
          }
        } else if (profile?.specialty_id) {
          setState((prev) => ({
            ...prev,
            specialty_id: profile.specialty_id,
          }));
          setLloList([{ text: "" }]);
        } else {
          setLloList([{ text: "" }]);
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
    setSavedOk(false);
    setState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function getCleanLloLines(): string[] {
    return lloList
      .map((l) => l.text.trim())
      .filter((line) => line.length > 0);
  }

  function validate(): boolean {
    const lines = getCleanLloLines();

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
    if (lines.length === 0) {
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

  // ====== Reload / Delete helpers ======

  async function reloadCourses() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("courses")
      .select("id, code, title")
      .eq("owner_id", session.user.id)
      .order("title", { ascending: true });

    if (error) {
      console.error("reloadCourses error:", error);
      return;
    }
    setCourses(data || []);
  }

  async function reloadLessons(courseId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("lessons")
      .select("id, title, course_id")
      .eq("owner_id", session.user.id)
      .eq("course_id", courseId)
      .order("order_in_course", { ascending: true });

    if (error) {
      console.error("reloadLessons error:", error);
      return;
    }
    setLessons(data || []);
  }

  async function handleDeleteCourse(courseId: string) {
    setMsg(null);

    const ok = window.confirm(
      "Xóa Học phần này? Nếu có Bài học/LLO liên quan, hệ thống có thể từ chối xóa tùy theo ràng buộc."
    );
    if (!ok) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("delete course error:", error);
      setMsg("Không xóa được Học phần (có thể đang có bài học/LLO liên quan).");
      return;
    }

    setCourses((prev) => prev.filter((c) => c.id !== courseId));

    if (state.course_id === courseId) {
      handleChange("course_id", "");
      handleChange("lesson_id", "");
      setLessons([]);
    }

    setSavedOk(false);
    setMsg("Đã xóa Học phần.");
  }

  async function handleDeleteLesson(lessonId: string) {
    setMsg(null);

    const ok = window.confirm(
      "Xóa Bài học này? Nếu có LLO liên quan, hệ thống có thể từ chối xóa tùy theo ràng buộc."
    );
    if (!ok) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("delete lesson error:", error);
      setMsg("Không xóa được Bài học (có thể đang có LLO liên quan).");
      return;
    }

    setLessons((prev) => prev.filter((l) => l.id !== lessonId));

    if (state.lesson_id === lessonId) {
      handleChange("lesson_id", "");
    }

    setSavedOk(false);
    setMsg("Đã xóa Bài học.");
  }

  // ====== SAVE: tạo course/lesson nếu cần, lưu LLO, lưu context ======

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setEvalError(null);

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

    const lloLines = getCleanLloLines();

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
        setState((prev) => ({ ...prev, course_id: courseId }));

        await reloadCourses();

        setCreatingCourse(false);
        setNewCourseTitle("");
        setNewCourseCode("");
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

        await reloadLessons(courseId);

        setCreatingLesson(false);
        setNewLessonTitle("");
      }

      // 3) LLOs
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

      const { error: lloError } = await supabase.from("llos").insert(insertRows);

      if (lloError) {
        console.error("Error inserting llos:", lloError);
        setMsg("Lỗi lưu LLO vào Supabase.");
        setSaving(false);
        return;
      }

      // 4) Lưu context vào localStorage
      if (typeof window !== "undefined") {
        const llos_text_str = lloLines.join("\n");
        const contextToSave: ContextState = {
          specialty_id: state.specialty_id,
          learner_level: state.learner_level,
          bloom_level: state.bloom_level,
          llos_text: llos_text_str,
          course_id: courseId,
          lesson_id: lessonId,
        };
        window.localStorage.setItem(
          "shapleymcq_context",
          JSON.stringify(contextToSave)
        );
      }

      setMsg("Đã lưu bối cảnh, Học phần, Bài học và LLO.");
      setSavedOk(true);
      setSaving(false);
    } catch (err: any) {
      console.error("Error in handleSave:", err);
      setMsg("Lỗi không xác định khi lưu dữ liệu.");
      setSaving(false);
    }
  }

  // ✅ Không điều kiện: bấm là qua thẳng Bước 2
  function handleNextStep2() {
    setMsg(null);
    router.push("/wizard/au");
  }

  // ====== GPT: đánh giá LLO & Bloom ======

  async function handleEvaluate() {
    setEvalError(null);
    setEvalResult(null);
    setMsg(null);

    if (!validate()) {
      return;
    }

    const lloLines = getCleanLloLines();
    const llos_text_str = lloLines.join("\n");

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
          llos_text: llos_text_str,
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

  const cleanLloCount = getCleanLloLines().length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 pb-24 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Bước 1 – Thiết lập bối cảnh câu hỏi
        </h1>
        <p className="text-sm text-slate-600">
          Chọn chuyên ngành, Học phần, Bài học, bậc đào tạo, mức Bloom và LLO của
          bài cần ra câu hỏi. Sau đó dùng GPT để đánh giá sự phù hợp của LLO.
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
                      handleChange("lesson_id", "");
                    }}
                  >
                    <option value="">-- Chọn học phần --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code} – ${c.title}` : c.title}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between mt-1">
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
                      className="text-[11px] text-brand-700 hover:underline"
                    >
                      + Tạo Học phần mới
                    </button>
                    <button
                      type="button"
                      onClick={reloadCourses}
                      className="text-[11px] text-slate-500 hover:underline"
                    >
                      Tải lại
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    placeholder="Tên Học phần (ví dụ: Châm cứu học 1)"
                    value={newCourseTitle}
                    onChange={(e) => {
                      setNewCourseTitle(e.target.value);
                      setSavedOk(false);
                    }}
                  />
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    placeholder="Mã Học phần (tùy chọn, ví dụ: YHCT301)"
                    value={newCourseCode}
                    onChange={(e) => {
                      setNewCourseCode(e.target.value);
                      setSavedOk(false);
                    }}
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
                  <div className="flex items-center justify-between mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingLesson(true);
                        setNewLessonTitle("");
                      }}
                      className="text-[11px] text-brand-700 hover:underline disabled:opacity-60"
                      disabled={!state.course_id && !creatingCourse}
                    >
                      + Tạo Bài học mới
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        state.course_id && reloadLessons(state.course_id)
                      }
                      disabled={!state.course_id}
                      className="text-[11px] text-slate-500 hover:underline disabled:opacity-50"
                    >
                      Tải lại
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    placeholder="Tên Bài học (ví dụ: Châm cứu điều trị đau lưng)"
                    value={newLessonTitle}
                    onChange={(e) => {
                      setNewLessonTitle(e.target.value);
                      setSavedOk(false);
                    }}
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

          {/* ✅ Quick manage lists */}
          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div className="bg-white border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-semibold text-slate-800">
                  Danh sách Học phần
                </div>
                <button
                  type="button"
                  onClick={reloadCourses}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Tải lại
                </button>
              </div>

              <div className="max-h-44 overflow-auto space-y-1">
                {courses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleChange("course_id", c.id);
                        handleChange("lesson_id", "");
                        setSavedOk(false);
                      }}
                      className="text-left text-[12px] text-slate-700 hover:underline flex-1"
                      title="Chọn học phần này"
                    >
                      {c.code ? `${c.code} – ${c.title}` : c.title}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(c.id)}
                      className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[11px] hover:bg-rose-100"
                    >
                      Xóa
                    </button>
                  </div>
                ))}

                {courses.length === 0 && (
                  <div className="text-[11px] text-slate-500">
                    Chưa có học phần.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-semibold text-slate-800">
                  Danh sách Bài học
                </div>
                <button
                  type="button"
                  onClick={() =>
                    state.course_id && reloadLessons(state.course_id)
                  }
                  disabled={!state.course_id}
                  className="text-[11px] text-slate-500 hover:underline disabled:opacity-50"
                >
                  Tải lại
                </button>
              </div>

              <div className="max-h-44 overflow-auto space-y-1">
                {lessons.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleChange("lesson_id", l.id);
                        setSavedOk(false);
                      }}
                      className="text-left text-[12px] text-slate-700 hover:underline flex-1"
                      title="Chọn bài học này"
                    >
                      {l.title}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteLesson(l.id)}
                      className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[11px] hover:bg-rose-100"
                    >
                      Xóa
                    </button>
                  </div>
                ))}

                {!state.course_id && (
                  <div className="text-[11px] text-slate-500">
                    Chọn một học phần để xem danh sách bài học.
                  </div>
                )}

                {state.course_id && lessons.length === 0 && (
                  <div className="text-[11px] text-slate-500">
                    Chưa có bài học.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Block 3: LLOs */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[13px] font-medium text-slate-700">
              LLOs của bài cần ra câu hỏi
            </label>
            <span className="text-[11px] text-slate-500">
              Tổng:{" "}
              <span className="font-semibold text-slate-800">
                {cleanLloCount}
              </span>{" "}
              LLO
            </span>
          </div>

          <div className="space-y-2">
            {lloList.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  value={item.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSavedOk(false);
                    setLloList((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, text: val } : row
                      )
                    );
                  }}
                  placeholder={`LLO ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSavedOk(false);
                    setLloList((prev) =>
                      prev.length === 1
                        ? [{ text: "" }]
                        : prev.filter((_, i) => i !== idx)
                    );
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[11px] hover:bg-rose-100"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSavedOk(false);
              setLloList((prev) => [...prev, { text: "" }]);
            }}
            className="mt-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-700 hover:border-brand-400 hover:text-brand-700"
          >
            + Thêm LLO
          </button>

          <p className="mt-1 text-[11px] text-slate-500">
            Mỗi dòng là một LLO riêng. Các bước sau sẽ dùng danh sách này để GPT
            đánh giá và sinh AU, misconceptions, MCQ.
          </p>
        </div>

        {msg && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {msg}
          </div>
        )}

        {/* ✅ Trên card chỉ còn nút Lưu bối cảnh + nút GPT Evaluate */}
        <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu bối cảnh"}
          </button>

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

      {/* ✅ FOOTER: pill style giống button trong nội dung */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={
              "px-3 py-1.5 rounded-full border transition text-xs font-medium " +
              "border-slate-300 bg-white text-slate-700 " +
              "hover:border-brand-400 hover:text-brand-700"
            }
          >
            ← Quay lại Dashboard
          </button>

          <button
            type="button"
            onClick={handleNextStep2}
            className={
              "px-3.5 py-1.5 rounded-full border transition text-xs font-semibold " +
              "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
            }
          >
            Tiếp Bước 2 →
          </button>
        </div>
      </div>
    </div>
  );
}
