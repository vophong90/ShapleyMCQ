// app/wizard/mcq/components/Header.tsx
"use client";

type Props = {
  context: any | null;
};

export function MCQHeader({ context }: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        Bước 4 – Sinh & phân tích câu MCQ
      </h1>
      {context && (
        <div className="text-xs text-gray-600 space-y-0.5">
          {context.course_name && (
            <div>
              <span className="font-semibold">Học phần: </span>
              {context.course_name}
            </div>
          )}
          {context.lesson_name && (
            <div>
              <span className="font-semibold">Bài học: </span>
              {context.lesson_name}
            </div>
          )}
          {context.bloom_level && (
            <div>
              <span className="font-semibold">Bloom mục tiêu: </span>
              {context.bloom_level}
            </div>
          )}
          {context.learner_level && (
            <div>
              <span className="font-semibold">Bậc đào tạo: </span>
              {context.learner_level}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
