// app/wizard/mcq/components/SelectorBar.tsx
"use client";

import type {
  Course,
  Lesson,
  LLO,
  AU,
  StemLength,
  DifficultyLevel,
} from "../types";

type Props = {
  courses: Course[];
  lessons: Lesson[];
  llos: LLO[];
  aus: AU[];
  selectedCourseId: string | "";
  selectedLessonId: string | "";
  selectedLloId: string | "";
  selectedAU: AU | null;

  onChangeCourseId: (id: string) => void;
  onChangeLessonId: (id: string) => void;
  onChangeLloId: (id: string) => void;
  onChangeAU: (id: string) => void;

  questionCount: number;
  onChangeQuestionCount: (n: number) => void;

  stemLength: StemLength;
  onChangeStemLength: (s: StemLength) => void;

  difficulty: DifficultyLevel;
  onChangeDifficulty: (d: DifficultyLevel) => void;

  clinicalVignette: boolean;
  onToggleClinicalVignette: (v: boolean) => void;

  loadingGen: boolean;
  onGenerateMCQs: () => void;
};

export function SelectorBar(props: Props) {
  const {
    courses,
    lessons,
    llos,
    aus,
    selectedCourseId,
    selectedLessonId,
    selectedLloId,
    selectedAU,
    onChangeCourseId,
    onChangeLessonId,
    onChangeLloId,
    onChangeAU,
    questionCount,
    onChangeQuestionCount,
    stemLength,
    onChangeStemLength,
    difficulty,
    onChangeDifficulty,
    clinicalVignette,
    onToggleClinicalVignette,
    loadingGen,
    onGenerateMCQs,
  } = props;

  const canGenerate =
    !loadingGen &&
    !!selectedCourseId &&
    !!selectedLessonId &&
    !!selectedLloId &&
    !!selectedAU &&
    questionCount >= 1;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap gap-3 items-end text-xs">
      {/* Course */}
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Học phần</label>
        <select
          className="border rounded-md px-2 py-1 text-xs min-w-[160px]"
          value={selectedCourseId}
          onChange={(e) => onChangeCourseId(e.target.value)}
        >
          <option value="">-- Chọn học phần --</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} – ` : ""}
              {c.title ?? "Không tên"}
            </option>
          ))}
        </select>
      </div>

      {/* Lesson */}
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Bài học</label>
        <select
          className="border rounded-md px-2 py-1 text-xs min-w-[140px]"
          value={selectedLessonId}
          onChange={(e) => onChangeLessonId(e.target.value)}
          disabled={!selectedCourseId}
        >
          <option value="">-- Chọn bài học --</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title ?? "Không tên"}
            </option>
          ))}
        </select>
      </div>

      {/* LLO */}
      <div className="flex flex-col">
        <label className="font-semibold mb-1">LLO</label>
        <select
          className="border rounded-md px-2 py-1 text-xs min-w-[160px]"
          value={selectedLloId}
          onChange={(e) => onChangeLloId(e.target.value)}
          disabled={!selectedLessonId}
        >
          <option value="">-- Chọn LLO --</option>
          {llos.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code ? `${l.code} – ` : ""}
              {l.text?.slice(0, 60) ?? "Không tên"}
            </option>
          ))}
        </select>
      </div>

      {/* AU */}
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Assessment Unit</label>
        <select
          className="border rounded-md px-2 py-1 text-xs min-w-[200px]"
          value={selectedAU?.id ?? ""}
          onChange={(e) => onChangeAU(e.target.value)}
          disabled={!selectedLloId}
        >
          <option value="">-- Chọn AU --</option>
          {aus.map((a) => (
            <option key={a.id} value={a.id}>
              {a.text.slice(0, 80)}
            </option>
          ))}
        </select>
      </div>

      {/* Số câu */}
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Số câu / lần (0–10)</label>
        <input
          type="number"
          min={0}
          max={10}
          className="border rounded-md px-2 py-1 text-xs w-20"
          value={questionCount}
          onChange={(e) =>
            onChangeQuestionCount(Number(e.target.value) || 0)
          }
        />
      </div>

      {/* Độ dài stem */}
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Độ dài stem</label>
        <select
          className="border rounded-md px-2 py-1 text-xs min-w-[120px]"
          value={stemLength}
          onChange={(e) => onChangeStemLength(e.target.value as StemLength)}
        >
          <option value="short">Ngắn (1–2 câu)</option>
          <option value="medium">Trung bình (3–5 câu)</option>
          <option value="long">Dài (vignette chi tiết)</option>
        </select>
      </div>

      {/* Độ khó */}
      <div className="flex flex-col">
        <label className="font-semibold mb-1">Mức độ khó</label>
        <select
          className="border rounded-md px-2 py-1 text-xs min-w-[120px]"
          value={difficulty}
          onChange={(e) =>
            onChangeDifficulty(e.target.value as DifficultyLevel)
          }
        >
          <option value="very_hard">Rất khó</option>
          <option value="hard">Khó</option>
          <option value="medium">Vừa phải</option>
          <option value="easy">Dễ</option>
        </select>
      </div>

      {/* Clinical vignette */}
      <label className="inline-flex items-center gap-1 text-xs mt-6">
        <input
          type="checkbox"
          className="rounded border-gray-300"
          checked={clinicalVignette}
          onChange={(e) => onToggleClinicalVignette(e.target.checked)}
        />
        Tình huống lâm sàng
      </label>

      {/* Nút generate */}
      <button
        onClick={onGenerateMCQs}
        disabled={!canGenerate}
        className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
      >
        {loadingGen ? "Đang sinh câu MCQ…" : "Generate MCQ (GPT)"}
      </button>
    </div>
  );
}
