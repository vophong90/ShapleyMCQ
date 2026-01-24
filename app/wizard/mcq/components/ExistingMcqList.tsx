// app/wizard/mcq/components/ExistingMcqList.tsx
"use client";

import type { ExistingMcqSummary, LLO, AU } from "../types";

type Props = {
  existingMcqs: ExistingMcqSummary[];
  loading: boolean;
  selectedLlo: LLO | null;
  selectedAU: AU | null;
};

export function ExistingMcqList({
  existingMcqs,
  loading,
  selectedLlo,
  selectedAU,
}: Props) {
  if (!selectedAU) return null;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 space-y-2 mt-1">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-700">
            Các câu MCQ đã có cho lựa chọn hiện tại
          </div>
          <p className="text-[11px] text-slate-500">
            Lọc theo <b>LLO</b> và <b>Assessment Unit</b> đang chọn. Dùng để
            tránh sinh lại các câu hỏi trùng ý.
          </p>
          <div className="mt-1 text-[11px] text-slate-600 space-y-0.5">
            {selectedLlo && (
              <div>
                <span className="font-semibold">LLO: </span>
                {selectedLlo.code ? `${selectedLlo.code} – ` : ""}
                {selectedLlo.text ?? ""}
              </div>
            )}
            {selectedAU && (
              <div>
                <span className="font-semibold">AU: </span>
                {selectedAU.text}
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          {loading ? (
            <span>Đang tải MCQ đã có…</span>
          ) : (
            <>
              Đã tìm thấy{" "}
              <span className="font-semibold text-slate-800">
                {existingMcqs.length}
              </span>{" "}
              câu
            </>
          )}
        </div>
      </div>

      <div className="border rounded-lg max-h-52 overflow-y-auto mt-2 text-xs">
        {loading && (
          <div className="p-2 text-slate-400">
            Đang tải danh sách MCQ đã có…
          </div>
        )}

        {!loading && existingMcqs.length === 0 && (
          <div className="p-2 text-slate-400">
            Chưa có MCQ nào được lưu cho tổ hợp LLO/AU này.
          </div>
        )}

        {!loading &&
          existingMcqs.length > 0 &&
          existingMcqs.map((q) => (
            <div
              key={q.id}
              className="px-3 py-2 border-b last:border-b-0 bg-slate-50/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[11px] text-slate-700">
                  {q.id.slice(0, 8)}…
                </div>
                {q.created_at && (
                  <div className="text-[10px] text-slate-400">
                    {new Date(q.created_at).toLocaleString("vi-VN")}
                  </div>
                )}
              </div>
              <div className="text-[11px] text-slate-800 line-clamp-2 mt-0.5">
                {q.stem}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
