"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

import { AUContextSelector } from "./components/AUContextSelector";
import { AULloPanel } from "./components/AULloPanel";
import { AUSourceCard } from "./components/AUSourceCard";
import { AUSavedList } from "./components/AUSavedList";
import { AUNewList } from "./components/AUNewList";
import { AUFooterNav } from "./components/AUFooterNav";

/* =========================
   Types
========================= */

type WizardContext = {
  specialty_id?: string;
  specialty_name?: string;
  course_id?: string;
  course_title?: string;
  lesson_id?: string;
  lesson_title?: string;
  learner_level?: string;
  bloom_level?: string;
  // Giữ để tương thích backward – nhưng ưu tiên LLO từ DB
  llos_text?: string;
};

type GeneratedAU = {
  core_statement: string;
  short_explanation?: string | null;
  bloom_min?: string | null;
  selected: boolean;
};

type Course = {
  id: string;
  title: string;
};

type Lesson = {
  id: string;
  title: string;
  course_id: string;
};

type SavedAU = {
  id: string;
  core_statement: string;
  short_explanation?: string | null;
  bloom_min?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type LLO = {
  id: string;
  text: string;
  bloom_suggested?: string | null;
  level_suggested?: string | null;
};

type Book = {
  id: string;
  title: string;
  subtitle: string | null;
  specialty_id: string | null;
  specialty_name: string | null;
  status: string;
  is_active: boolean;
};

export type AuSourceMode = "upload" | "book" | "gpt";

/* =========================
   Utils
========================= */

function normalizeCore(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/* =========================
   Page
========================= */

export default function AUPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [context, setContext] = useState<WizardContext | null>(null);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState<File[]>([]);
  const [aus, setAus] = useState<GeneratedAU[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // userId + courses/lessons + AU đã lưu
  const [userId, setUserId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [savedAus, setSavedAus] = useState<SavedAU[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // LLO từ Supabase cho course/lesson hiện tại
  const [llos, setLlos] = useState<LLO[]>([]);
  const [loadingLLOs, setLoadingLLOs] = useState(false);
  const [selectedLloId, setSelectedLloId] = useState<string | null>(null);

  // NEW: số lượng AU cần sinh
  const [auCount, setAuCount] = useState<number>(8);

  // NEW: loading khi xóa AU đã lưu
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // NEW: nguồn sinh AU
  const [sourceMode, setSourceMode] = useState<AuSourceMode>("upload");

  // NEW: book trong DB
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  // ====== Load context từ localStorage ======
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem("shapleymcq_context");
    if (!saved) {
      router.push("/wizard/context");
      return;
    }

    try {
      const parsed = JSON.parse(saved) as WizardContext;
      setContext(parsed);
    } catch (e) {
      console.error("Lỗi parse shapleymcq_context:", e);
      setError("Không đọc được bối cảnh. Vui lòng thiết lập lại ở Bước 1.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // ====== lấy session để có userId ======
  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) return;
      setUserId(session.user.id);
    }
    loadSession();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ====== load danh sách Học phần của user ======
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadCourses() {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .eq("owner_id", userId)
        .order("title", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Load courses error:", error);
        return;
      }
      setCourses(data ?? []);
    }

    loadCourses();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  // ====== load Lessons khi chọn course ======
  useEffect(() => {
    if (!userId || !context?.course_id) {
      setLessons([]);
      return;
    }

    const courseId = context.course_id;
    let cancelled = false;

    async function loadLessons() {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, course_id")
        .eq("owner_id", userId)
        .eq("course_id", courseId)
        .order("order_in_course", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Load lessons error:", error);
        return;
      }
      setLessons(data ?? []);
    }

    loadLessons();
    return () => {
      cancelled = true;
    };
  }, [userId, context?.course_id, supabase]);

  // ====== helper reload Saved AUs ======
  async function reloadSavedAus(
    currentUserId?: string,
    courseId?: string,
    lessonId?: string
  ) {
    if (!currentUserId || !courseId || !lessonId) {
      setSavedAus([]);
      return;
    }
    setLoadingSaved(true);
    const { data, error } = await supabase
      .from("assessment_units")
      .select(
        "id, core_statement, short_explanation, bloom_min, status, created_at"
      )
      .eq("owner_id", currentUserId)
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Reload saved AUs error:", error);
      setLoadingSaved(false);
      return;
    }

    setSavedAus(data ?? []);
    setLoadingSaved(false);
  }

  // ====== load AU đã lưu cho course + lesson hiện tại ======
  useEffect(() => {
    if (!userId || !context?.course_id || !context.lesson_id) {
      setSavedAus([]);
      return;
    }

    reloadSavedAus(userId, context.course_id, context.lesson_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, context?.course_id, context?.lesson_id]);

  // ====== load LLOs từ Supabase cho course + lesson hiện tại ======
  useEffect(() => {
    if (!userId || !context?.course_id || !context.lesson_id) {
      setLlos([]);
      return;
    }

    const courseId = context.course_id!;
    const lessonId = context.lesson_id!;

    let cancelled = false;

    async function loadLLOs() {
      setLoadingLLOs(true);
      const { data, error } = await supabase
        .from("llos")
        .select("id, text, bloom_suggested, level_suggested")
        .eq("owner_id", userId)
        .eq("course_id", courseId)
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Load LLOs error:", error);
        setLlos([]);
      } else {
        const list = data ?? [];
        setLlos(list);
        // auto-chọn LLO đầu tiên nếu chưa có
        if (!selectedLloId && list.length > 0) {
          setSelectedLloId(list[0].id);
        }
      }
      setLoadingLLOs(false);
    }

    loadLLOs();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, context?.course_id, context?.lesson_id, supabase]);

  // ====== load Books (sách đã ingest vào DB) cho user ======
  useEffect(() => {
    if (!userId) {
      setBooks([]);
      return;
    }

    let cancelled = false;

    async function loadBooks() {
      setLoadingBooks(true);
      const { data, error } = await supabase
        .from("books")
        .select(
          "id, title, subtitle, specialty_id, specialty_name, status, is_active"
        )
        .eq("owner_id", userId)
        .eq("is_active", true)
        .eq("status", "ready")
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Load books error:", error);
        setBooks([]);
      } else {
        setBooks((data || []) as Book[]);
      }
      setLoadingBooks(false);
    }

    loadBooks();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  // ====== persist context vào localStorage ======
  function persistContext(next: WizardContext) {
    setContext(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("shapleymcq_context", JSON.stringify(next));
    }
  }

  // ====== Helper: lấy danh sách LLO hiện tại ======
  function getCurrentLloLines(): string[] {
    // Ưu tiên LLO đang chọn
    if (selectedLloId && llos.length > 0) {
      const l = llos.find((x) => x.id === selectedLloId);
      if (l?.text?.trim()) {
        return [l.text.trim()];
      }
    }

    // Nếu chưa chọn cụ thể LLO, nhưng vẫn muốn dùng toàn bộ (fallback cũ)
    const fromDb = llos
      .map((l) => (l.text || "").trim())
      .filter((t) => t.length > 0);
    if (fromDb.length > 0) return fromDb;

    // Fallback: lấy từ context.llos_text (case cũ)
    if (context?.llos_text) {
      const fromContext = context.llos_text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (fromContext.length > 0) return fromContext;
    }

    return [];
  }

  // ====== chọn lại Học phần / Bài học ======
  function handleChangeCourse(e: ChangeEvent<HTMLSelectElement>) {
    const courseId = e.target.value || undefined;
    const course = courses.find((c) => c.id === courseId);
    if (!context) return;

    const updated: WizardContext = {
      ...context,
      course_id: courseId,
      course_title: course?.title,
      // reset lesson khi đổi học phần
      lesson_id: undefined,
      lesson_title: undefined,
    };

    persistContext(updated);
    // reset AU tạm & AU đã lưu & LLO (sẽ reload bằng effect)
    setAus([]);
    setSavedAus([]);
    setLlos([]);
    setSelectedLloId(null);
    setFiles([]);
    setMsg(null);
    setError(null);
  }

  function handleChangeLesson(e: ChangeEvent<HTMLSelectElement>) {
    const lessonId = e.target.value || undefined;
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!context) return;

    const updated: WizardContext = {
      ...context,
      lesson_id: lessonId,
      lesson_title: lesson?.title,
    };

    persistContext(updated);
    // reset AU tạm & AU đã lưu & LLO (sẽ reload bằng effect)
    setAus([]);
    setSavedAus([]);
    setLlos([]);
    setSelectedLloId(null);
    setFiles([]);
    setMsg(null);
    setError(null);
  }

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList) return;

    const arr = Array.from(fileList);
    setFiles(arr);
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ====== Tiếp tục sang Bước 3: bỏ điều kiện, click là qua thẳng ======
  function handleContinue() {
    setError(null);
    setMsg(null);
    router.push("/wizard/misconcepts");
  }

  // ====== Xóa AU đã lưu ======
  async function handleDeleteSavedAU(auId: string) {
    if (!userId) {
      setError("Thiếu thông tin người dùng để xóa AU.");
      return;
    }

    const ok = window.confirm(
      "Bạn chắc chắn muốn xóa AU này? Thao tác không thể hoàn tác."
    );
    if (!ok) return;

    setDeletingId(auId);
    setError(null);
    setMsg(null);

    try {
      const { error: delErr } = await supabase
        .from("assessment_units")
        .delete()
        .eq("id", auId)
        .eq("owner_id", userId);

      if (delErr) {
        console.error("Delete saved AU error:", delErr);
        setError("Không xóa được AU. Vui lòng thử lại.");
        setDeletingId(null);
        return;
      }

      setSavedAus((prev) => prev.filter((x) => x.id !== auId));
      setMsg("Đã xóa AU.");
      setDeletingId(null);
    } catch (e: any) {
      console.error(e);
      setError("Lỗi server khi xóa AU.");
      setDeletingId(null);
    }
  }

  // ====== Gọi GPT sinh AU ======
  async function handleGenAU() {
    if (!context) {
      setError("Chưa có bối cảnh. Vui lòng quay lại Bước 1.");
      return;
    }

    if (!selectedLloId) {
      setError("Vui lòng chọn LLO mục tiêu trước khi sinh AU.");
      return;
    }

    if (!context.course_id || !context.lesson_id) {
      setError("Vui lòng chọn Học phần và Bài học trước khi sinh AU.");
      return;
    }

    const selectedLlo = llos.find((l) => l.id === selectedLloId);
    const bloomToUse =
      selectedLlo?.bloom_suggested?.trim() ||
      context.bloom_level?.trim() ||
      null;

    const lloLines = getCurrentLloLines();
    if (lloLines.length === 0) {
      setError(
        "Chưa tìm thấy LLO cho bài học này. Vui lòng đảm bảo đã nhập LLO ở Bước 1."
      );
      return;
    }

    if (sourceMode === "book" && !selectedBookId) {
      setError("Vui lòng chọn một sách trong hệ thống để dùng làm nguồn sinh AU.");
      return;
    }

    const llos_text_to_use = lloLines.join("\n");

    setGenLoading(true);
    setMsg(null);
    setError(null);
    setAus([]);

    try {
      const formData = new FormData();
      formData.append("llos_text", llos_text_to_use);

      // số lượng AU cần sinh
      formData.append(
        "au_count",
        String(Math.max(1, Math.min(40, auCount || 8)))
      );

      // nguồn sinh AU
      formData.append("source_mode", sourceMode);

      if (context.learner_level)
        formData.append("learner_level", context.learner_level);
      if (bloomToUse) {
        formData.append("bloom_level", bloomToUse);
      }
      if (context.specialty_name)
        formData.append("specialty_name", context.specialty_name);
      if (context.course_title)
        formData.append("course_title", context.course_title);
      if (context.lesson_title)
        formData.append("lesson_title", context.lesson_title);

      // Nguồn 1 – Tài liệu upload
      if (sourceMode === "upload") {
        for (const file of files) {
          formData.append("files", file);
        }
      }

      // Nguồn 2 – Sách trong DB
      if (sourceMode === "book" && selectedBookId) {
        formData.append("book_id", selectedBookId);
      }

      // Nguồn 3 – GPT: không cần file/book, chỉ dùng context + LLO

      const res = await fetch("/api/au-gen", {
        method: "POST",
        body: formData,
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        console.error("AU-gen FAILED", {
          status: res.status,
          statusText: res.statusText,
          contentType: res.headers.get("content-type"),
          rawText,
          parsed: data,
        });

        setError(
          data?.error ||
            data?.detail ||
            `Lỗi sinh AU (HTTP ${res.status}). Xem console để biết chi tiết.`
        );
        setGenLoading(false);
        return;
      }

      const rawAus = Array.isArray(data?.aus) ? data.aus : [];
      const existingKeys = new Set<string>();
      savedAus.forEach((a) => {
        existingKeys.add(normalizeCore(a.core_statement || ""));
      });

      const mapped: GeneratedAU[] = [];
      for (const au of rawAus) {
        const core = (au.core_statement ?? au.text ?? "").toString();
        const norm = normalizeCore(core);
        if (!core.trim()) continue;
        if (existingKeys.has(norm)) continue;
        existingKeys.add(norm);
        mapped.push({
          core_statement: core,
          short_explanation: au.short_explanation ?? null,
          bloom_min: (au.bloom_min ?? null) || bloomToUse,
          selected: true,
        });
      }

      if (mapped.length === 0) {
        setError(
          "GPT không sinh được AU mới (có thể trùng với AU đã có). Vui lòng kiểm tra lại LLO hoặc nguồn tài liệu."
        );
      } else {
        setAus(mapped);
        setMsg(
          `Đã sinh được ${mapped.length} AU mới (không trùng với AU đã lưu). Bạn có thể chỉnh sửa, chọn/bỏ chọn trước khi lưu.`
        );
      }

      setGenLoading(false);
    } catch (e: any) {
      console.error(e);
      setError("Lỗi mạng hoặc server khi gọi GPT.");
      setGenLoading(false);
    }
  }

  // ====== Chỉnh sửa / Xóa AU trong danh sách tạm ======
  function toggleSelectAU(index: number) {
    setAus((prev) =>
      prev.map((au, i) =>
        i === index ? { ...au, selected: !au.selected } : au
      )
    );
  }

  function updateAUField(
    index: number,
    field: "core_statement" | "short_explanation" | "bloom_min",
    value: string
  ) {
    setAus((prev) =>
      prev.map((au, i) =>
        i === index
          ? {
              ...au,
              [field]:
                field === "short_explanation" || field === "bloom_min"
                  ? value || null
                  : value,
            }
          : au
      )
    );
  }

  function removeAU(index: number) {
    setAus((prev) => prev.filter((_, i) => i !== index));
  }

  // ====== Lưu AU xuống Supabase ======
  async function handleSaveAU() {
    if (!context) {
      setError("Chưa có bối cảnh. Vui lòng quay lại Bước 1.");
      return;
    }

    const selected = aus.filter((au) => au.selected);
    if (selected.length === 0) {
      setError("Bạn chưa chọn AU nào để lưu.");
      return;
    }

    if (!context.course_id || !context.lesson_id) {
      setError(
        "Thiếu Học phần hoặc Bài học trong bối cảnh. Vui lòng thiết lập lại ở Bước 1."
      );
      return;
    }

    if (!selectedLloId) {
      setError("Vui lòng chọn LLO mục tiêu để gắn AU.");
      return;
    }

    setSaveLoading(true);
    setError(null);
    setMsg(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const rows = selected.map((au) => ({
        owner_id: session.user.id,
        course_id: context.course_id!,
        lesson_id: context.lesson_id!,
        llo_id: selectedLloId,
        core_statement: au.core_statement.trim(),
        short_explanation: (au.short_explanation || "")?.trim() || null,
        bloom_min: (au.bloom_min || "")?.trim() || null,
        status: "draft",
      }));

      const { error: insertError } = await supabase
        .from("assessment_units")
        .insert(rows);

      if (insertError) {
        console.error("Insert assessment_units error:", insertError);
        setError("Lỗi lưu AU xuống Supabase. Vui lòng thử lại.");
        setSaveLoading(false);
        return;
      }

      setMsg("Đã lưu AU được chọn.");
      setSaveLoading(false);

      await reloadSavedAus(
        userId || session.user.id,
        context.course_id!,
        context.lesson_id!
      );
    } catch (e: any) {
      console.error(e);
      setError("Lỗi server khi lưu AU.");
      setSaveLoading(false);
    }
  }

  // ====== Render ======
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm text-slate-600">Đang tải bối cảnh…</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm text-rose-700">
          Không tìm thấy bối cảnh. Vui lòng quay lại Bước 1 để thiết lập.
        </p>
        <button
          onClick={() => router.push("/wizard/context")}
          className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
        >
          Quay lại Bước 1
        </button>
      </div>
    );
  }

  const currentLloLines = getCurrentLloLines();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Bước 2 – Assessment Units (AU)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Từ LLO và các nguồn tài liệu, GPT sẽ gợi ý các Assessment Unit (AU)
            cốt lõi. Bạn có thể chỉnh sửa, xóa, chọn/bỏ chọn AU trước khi lưu
            xuống hệ thống.
          </p>
        </div>
      </div>

      {/* Card chọn Học phần / Bài học */}
      <AUContextSelector
        context={context}
        courses={courses}
        lessons={lessons}
        onChangeCourse={handleChangeCourse}
        onChangeLesson={handleChangeLesson}
      />

      {/* Card: Thông tin bối cảnh + LLO */}
      <AULloPanel
        context={context}
        llos={llos}
        selectedLloId={selectedLloId}
        onChangeSelectedLloId={setSelectedLloId}
        loadingLLOs={loadingLLOs}
        currentLloLines={currentLloLines}
      />

      {/* Card: Nguồn sinh AU (Upload / Book / GPT) + nút Sinh AU */}
      <AUSourceCard
        sourceMode={sourceMode}
        onChangeSourceMode={setSourceMode}
        auCount={auCount}
        onChangeAuCount={setAuCount}
        files={files}
        onFilesChange={handleFilesChange}
        onRemoveFile={handleRemoveFile}
        books={books}
        loadingBooks={loadingBooks}
        selectedBookId={selectedBookId}
        onChangeSelectedBookId={setSelectedBookId}
        onGenAU={handleGenAU}
        genLoading={genLoading}
      />

      {/* Thông báo */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-3">
          {msg}
        </div>
      )}

      {/* AU đã lưu trước đó */}
      <AUSavedList
        savedAus={savedAus}
        loadingSaved={loadingSaved}
        deletingId={deletingId}
        onDeleteSavedAU={handleDeleteSavedAU}
      />

      {/* Kết quả AU mới sinh ra */}
      {aus.length > 0 && (
        <AUNewList
          aus={aus}
          onToggleSelect={toggleSelectAU}
          onUpdateAUField={updateAUField}
          onRemoveAU={removeAU}
          onSaveSelected={handleSaveAU}
          saveLoading={saveLoading}
        />
      )}

      {/* Footer navigation */}
      <AUFooterNav
        onBackStep1={() => router.push("/wizard/context")}
        onNextStep3={handleContinue}
      />
    </div>
  );
}
