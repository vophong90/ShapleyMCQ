"use client";

import type { AU, Course, Lesson, LLO } from "../types";

type Props = {
  courses: Course[];
  lessons: Lesson[];
  llos: LLO[];
  aus: AU[];

  selectedCourse: Course | null;
  selectedLesson: Lesson | null;
  selectedLlo: LLO | null;
  selectedAu: AU | null;

  initLoading: boolean;

  onSelectCourse: (course: Course | null) => void;
  onSelectLesson: (lesson: Lesson | null) => void;
  onSelectLlo: (llo: LLO | null) => void;
  onSelectAu: (au: AU | null) => void;
};

export function CourseLessonSelector({
  courses,
  lessons,
  llos,
  aus,
  selectedCourse,
  selectedLesson,
  selectedLlo,
  selectedAu,
  initLoading,
  onSelectCourse,
  onSelectLesson,
  onSelectLlo,
  onSelectAu,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700 mb-1">
          Chuỗi chọn Học phần, Bài học, LLO và Assessment Unit
        </div>
        {initLoading && (
          <div className="text-xs text-slate-500">
            Đang tải danh sách Học phần...
          </div>
        )}
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
              onSelectCourse(c);
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
              onSelectLesson(l);
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
              onSelectLlo(llo);
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
              onSelectAu(au);
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
  );
}
