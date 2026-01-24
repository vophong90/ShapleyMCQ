// app/wizard/context/components/ContextForm.tsx
"use client";

import type { FormEvent } from "react";
import type { ContextWizardContext } from "../hooks/useContextWizard";
import { BLOOM_LEVELS, LEARNER_LEVELS } from "../types";

type Props = {
  ctx: ContextWizardContext;
};

export function ContextForm({ ctx }: Props) {
  const {
    specialties,
    courses,
    lessons,
    state,
    lloList,
    advancedBloomPerLlo,
    newCourseTitle,
    newCourseCode,
    creatingCourse,
    newLessonTitle,
    creatingLesson,
    msg,
    saving,
    evalLoading,
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
    handleChange,
    handleSave,
    handleEvaluate,
    reloadCourses,
    reloadLessons,
    handleDeleteCourse,
    handleDeleteLesson,
  } = ctx;

  const onSubmit = (e: FormEvent) => {
    void handleSave(e);
  };

  return (
    <form
      onSubmit={onSubmit}
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
            Mức Bloom mục tiêu (cho bộ câu hỏi)
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

          {/* Advanced mode: Bloom riêng cho từng LLO */}
          <div className="mt-2 flex items-start gap-2">
            <input
              id="advanced-bloom-toggle"
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
              checked={advancedBloomPerLlo}
              onChange={(e) => {
                setAdvancedBloomPerLlo(e.target.checked);
                setSavedOk(false);
              }}
            />
            <label
              htmlFor="advanced-bloom-toggle"
              className="text-[11px] text-slate-600"
            >
              <span className="font-medium">
                Bật chế độ nâng cao: chọn Bloom riêng cho từng LLO.
              </span>
              <br />
              <span className="text-[11px] text-slate-500">
                Nếu không chọn, mọi LLO mới sẽ mặc định dùng mức Bloom mục
                tiêu ở trên. Khi bật, bạn có thể đặt Bloom riêng cho từng
                LLO, song global Bloom vẫn là mục tiêu chung của bộ câu hỏi.
              </span>
            </label>
          </div>
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

        <div className="grid md:grid-cols-2 gap-4">
          {/* Course */}
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
                      setExistingLlos([]);
                    }}
                    className="text-[11px] text-brand-700 hover:underline"
                  >
                    + Tạo Học phần mới
                  </button>
                  <button
                    type="button"
                    onClick={() => reloadCourses()}
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

        {/* Quick manage lists */}
        <div className="grid md:grid-cols-2 gap-4 pt-2">
          {/* Courses list */}
          <div className="bg-white border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-semibold text-slate-800">
                Danh sách Học phần
              </div>
              <button
                type="button"
                onClick={() => reloadCourses()}
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
                      setExistingLlos([]);
                    }}
                    className="text-left text-[12px] text-slate-700 hover:underline flex-1"
                    title="Chọn học phần này"
                  >
                    {c.code ? `${c.code} – ${c.title}` : c.title}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDeleteCourse(c.id)}
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

          {/* Lessons list */}
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
                    onClick={() => void handleDeleteLesson(l.id)}
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

      {/* Block 3: LLOs mới */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[13px] font-medium text-slate-700">
            LLOs của bài cần ra câu hỏi (LLO mới sẽ được lưu thêm)
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
            <div key={idx} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
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

              {advancedBloomPerLlo && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-[11px] text-slate-500">
                    Bloom riêng cho LLO này:
                  </span>
                  <select
                    className="text-[11px] border rounded-full px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                    value={item.bloom_suggested ?? state.bloom_level ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSavedOk(false);
                      setLloList((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? {
                                ...row,
                                bloom_suggested: val || undefined,
                              }
                            : row
                        )
                      );
                    }}
                  >
                    <option value="">
                      = Dùng Bloom mục tiêu của bài học =
                    </option>
                    {BLOOM_LEVELS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setSavedOk(false);
            setLloList((prev) => [
              ...prev,
              { text: "", bloom_suggested: state.bloom_level || undefined },
            ]);
          }}
          className="mt-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-700 hover:border-brand-400 hover:text-brand-700"
        >
          + Thêm LLO
        </button>

        <p className="mt-1 text-[11px] text-slate-500">
          Mỗi dòng là một LLO riêng. Các bước sau sẽ dùng danh sách này để GPT
          đánh giá và sinh AU, misconceptions, MCQ. Nếu bật chế độ nâng cao,
          bạn có thể đặt Bloom riêng cho từng LLO.
        </p>
      </div>

      {msg && (
        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {msg}
        </div>
      )}

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
          onClick={() => void handleEvaluate()}
          disabled={evalLoading}
          className="px-4 py-2 rounded-xl border border-brand-500 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60"
        >
          {evalLoading
            ? "Đang đánh giá LLO…"
            : "Đánh giá LLO & Bloom & bậc học (GPT)"}
        </button>
      </div>
    </form>
  );
}
