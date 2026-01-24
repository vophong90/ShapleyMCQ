// app/wizard/context/components/ContextHeader.tsx
"use client";

export function ContextHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">
        Bước 1 – Thiết lập bối cảnh câu hỏi
      </h1>
      <p className="text-sm text-slate-600">
        Chọn chuyên ngành, Học phần, Bài học, bậc đào tạo, mức Bloom và LLO
        của bài cần ra câu hỏi. Sau đó dùng GPT để đánh giá sự phù hợp của
        LLO.
      </p>
    </div>
  );
}
