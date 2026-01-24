"use client";

import type { MCQListItem } from "../types";

type Props = {
  mcqList: MCQListItem[];
  listLoading: boolean;
  selectedIds: Set<string>;
  totalSelected: number;
  onToggle: (item: MCQListItem) => void;
};

export function MCQListPanel({
  mcqList,
  listLoading,
  selectedIds,
  totalSelected,
  onToggle,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-700">
            Danh sách MCQ trong Assessment Unit đã chọn
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tick các câu MCQ bạn muốn phân tích. Mỗi câu sẽ xuất hiện ở một card
            riêng bên dưới.
          </p>
        </div>
        <div className="text-[11px] text-slate-500">
          Tổng MCQ:{" "}
          <span className="font-semibold text-slate-800">{mcqList.length}</span>{" "}
          – Đang chọn:{" "}
          <span className="font-semibold text-indigo-700">{totalSelected}</span>
        </div>
      </div>

      <div className="border rounded-xl max-h-72 overflow-y-auto text-xs">
        {listLoading && (
          <div className="p-3 text-slate-400">Đang tải danh sách MCQ...</div>
        )}

        {!listLoading && mcqList.length === 0 && (
          <div className="p-3 text-slate-400">
            Chưa có câu MCQ nào cho AU này, hoặc chưa gắn AU cho các MCQ.
          </div>
        )}

        {!listLoading &&
          mcqList.map((q) => (
            <label
              key={q.id}
              className="flex items-start gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedIds.has(q.id)}
                onChange={() => onToggle(q)}
              />
              <div>
                <div className="font-medium text-slate-800 line-clamp-2">
                  {q.stem}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Đáp án đúng đang lưu trong mcq_options (label A).
                </div>
              </div>
            </label>
          ))}
      </div>
    </div>
  );
}
