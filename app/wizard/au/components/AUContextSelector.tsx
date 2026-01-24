"use client";

import type {
  ChangeEvent,
} from "react";

type WizardContext = {
  course_id?: string;
  course_title?: string;
  lesson_id?: string;
  lesson_title?: string;
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

type Props = {
  context: WizardContext;
  courses: Course[];
  lessons: Lesson[];
  onChangeCourse: (e: ChangeEvent<HTMLSelectElement>) => void;
  onChangeLesson: (e: ChangeEvent<HTMLSelectElement>) => void;
};

export function AUContextSelector({
  context,
  courses,
  lessons,
  onChangeCourse,
  onChangeLesson,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="text-xs font-semibold text-slate-700">
        Chọn Học phần &amp; Bài học làm bối cảnh sinh AU
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Học phần
          </label>
          <select
            value={context.course_id ?? ""}
            onChange={onChangeCourse}
            className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          >
            <option value="">-- Chọn Học phần --</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Bài học
          </label>
          <select
            value={context.lesson_id ?? ""}
            onChange={onChangeLesson}
            disabled={!context.course_id}
            className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:bg-slate-50"
          >
            <option value="">
              {context.course_id ? "-- Chọn Bài học --" : "Chọn Học phần trước"}
            </option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-1">
        Bạn có thể đổi Học phần/Bài học bất kỳ lúc nào. AU đã lưu sẽ hiện bên dưới
        tương ứng với lựa chọn hiện tại.
      </p>
    </div>
  );
}
