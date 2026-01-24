// app/wizard/context/hooks/useContextWizard.ts
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import {
  Specialty,
  Course,
  Lesson,
  ContextState,
  LloLine,
  LloEvalResult,
  ExistingLloRow,
} from "../types";

export function useContextWizard() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);

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

  const [lloList, setLloList] = useState<LloLine[]>([{ text: "" }]);
  const [advancedBloomPerLlo, setAdvancedBloomPerLlo] = useState(false);

  const [existingLlos, setExistingLlos] = useState<ExistingLloRow[]>([]);
  const [loadingExistingLlos, setLoadingExistingLlos] = useState(false);
  const [editingLloId, setEditingLloId] = useState<string | null>(null);
  const [editLloText, setEditLloText] = useState("");
  const [editLloBloom, setEditLloBloom] = useState<string | "">("");

  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [savedOk, setSavedOk] = useState(false);

  const [evalResult, setEvalResult] = useState<LloEvalResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // ===== Helpers =====

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

  function getCleanLloObjects(): LloLine[] {
    return lloList
      .map((l) => ({ ...l, text: l.text.trim() }))
      .filter((l) => l.text.length > 0);
  }

  function getCleanLloLines(): string[] {
    return getCleanLloObjects().map((l) => l.text);
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

  async function loadExistingLlosByLesson(
    ownerId: string,
    courseId?: string | null,
    lessonId?: string | null
  ) {
    if (!courseId || !lessonId) {
      setExistingLlos([]);
      return;
    }

    setLoadingExistingLlos(true);

    const { data, error } = await supabase
      .from("v_llos_with_stats")
      .select(
        "llo_id, text, bloom_suggested, level_suggested, au_count, mis_count, mcq_count"
      )
      .eq("owner_id", ownerId)
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading existing LLOs:", error);
      setExistingLlos([]);
    } else {
      setExistingLlos(data || []);
    }

    setLoadingExistingLlos(false);
  }

  // ===== INIT =====

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, specialty_id")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
      }

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

      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("shapleymcq_context");
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ContextState;
            setState((prev) => ({
              ...prev,
              ...parsed,
            }));

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

            if (parsed.course_id && parsed.lesson_id) {
              await loadExistingLlosByLesson(
                session.user.id,
                parsed.course_id,
                parsed.lesson_id
              );
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
  }, [router, supabase]);

  // specialtyName

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
  }, [state.course_id, supabase]);

  // Khi đổi course_id hoặc lesson_id, load lại LLO đã có

  useEffect(() => {
    async function syncExistingLlos() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      if (!state.course_id || !state.lesson_id) {
        setExistingLlos([]);
        return;
      }

      await loadExistingLlosByLesson(
        session.user.id,
        state.course_id,
        state.lesson_id
      );
    }

    syncExistingLlos();
  }, [state.course_id, state.lesson_id, supabase]);

  // ===== Reload / Delete helpers =====

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
      setExistingLlos([]);
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
      setExistingLlos([]);
    }

    setSavedOk(false);
    setMsg("Đã xóa Bài học.");
  }

  // ===== Update / Delete LLO đã có =====

  async function handleSaveEditLlo(lloId: string) {
    setMsg(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const payload: any = {
      text: editLloText.trim(),
    };

    if (editLloBloom) {
      payload.bloom_suggested = editLloBloom;
    } else {
      payload.bloom_suggested = null;
    }

    const { error } = await supabase
      .from("llos")
      .update(payload)
      .eq("id", lloId)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("update llo error:", error);
      setMsg("Không cập nhật được LLO.");
      return;
    }

    setEditingLloId(null);
    setEditLloText("");
    setEditLloBloom("");

    if (state.course_id && state.lesson_id) {
      await loadExistingLlosByLesson(
        session.user.id,
        state.course_id,
        state.lesson_id
      );
    }

    setMsg("Đã cập nhật LLO.");
  }

  function handleCancelEditLlo() {
    setEditingLloId(null);
    setEditLloText("");
    setEditLloBloom("");
  }

  async function handleDeleteExistingLlo(lloId: string, textPreview: string) {
    setMsg(null);

    const ok = window.confirm(
      `Xóa LLO này?\n\n"${textPreview.slice(
        0,
        120
      )}${textPreview.length > 120 ? "…" : ""}"\n\nTẤT CẢ AU / Mis / MCQ liên quan sẽ bị xóa theo (ON DELETE CASCADE).`
    );
    if (!ok) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("llos")
      .delete()
      .eq("id", lloId)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("delete llo error:", error);
      setMsg("Không xóa được LLO (kiểm tra log).");
      return;
    }

    if (state.course_id && state.lesson_id) {
      await loadExistingLlosByLesson(
        session.user.id,
        state.course_id,
        state.lesson_id
      );
    } else {
      setExistingLlos((prev) => prev.filter((l) => l.llo_id !== lloId));
    }

    setMsg("Đã xóa LLO cùng AU/Mis/MCQ liên quan.");
  }

  // ===== SAVE =====

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

    const cleanLlos = getCleanLloObjects();
    const lloTexts = cleanLlos.map((l) => l.text);

    try {
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

      if (cleanLlos.length === 0) {
        setMsg("Không có LLO hợp lệ để lưu.");
        setSaving(false);
        return;
      }

      const insertRows = cleanLlos.map((l) => ({
        owner_id: session.user.id,
        course_id: courseId,
        lesson_id: lessonId,
        text: l.text,
        bloom_suggested: advancedBloomPerLlo
          ? l.bloom_suggested || state.bloom_level || null
          : state.bloom_level || null,
        level_suggested: state.learner_level || null,
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

      await loadExistingLlosByLesson(
        session.user.id,
        courseId,
        lessonId || undefined
      );

      if (typeof window !== "undefined") {
        const llos_text_str = lloTexts.join("\n");
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

  function goStep2() {
    setMsg(null);
    router.push("/wizard/au");
  }

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

  function goDashboard() {
    router.push("/dashboard");
  }

  const cleanLloCount = getCleanLloObjects().length;

  return {
    specialties,
    courses,
    lessons,
    specialtyName,
    state,
    lloList,
    advancedBloomPerLlo,
    existingLlos,
    loadingExistingLlos,
    newCourseTitle,
    newCourseCode,
    creatingCourse,
    newLessonTitle,
    creatingLesson,
    msg,
    loading,
    saving,
    savedOk,
    evalResult,
    evalLoading,
    evalError,
    editingLloId,
    editLloText,
    editLloBloom,
    cleanLloCount,
    setLloList,
    setAdvancedBloomPerLlo,
    setNewCourseTitle,
    setNewCourseCode,
    setCreatingCourse,
    setNewLessonTitle,
    setCreatingLesson,
    setSavedOk,
    setExistingLlos,
    setMsg,
    setEditingLloId,
    setEditLloText,
    setEditLloBloom,
    handleChange,
    reloadCourses,
    reloadLessons,
    handleDeleteCourse,
    handleDeleteLesson,
    handleSaveEditLlo,
    handleCancelEditLlo,
    handleDeleteExistingLlo,
    handleSave,
    handleEvaluate,
    goStep2,
    goDashboard,
  } as const;
}

export type ContextWizardContext = ReturnType<typeof useContextWizard>;
