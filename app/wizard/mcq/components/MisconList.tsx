// app/wizard/mcq/components/MisconList.tsx
"use client";

import type { Miscon, AU } from "../types";

type Props = {
  selectedAU: AU | null;
  miscons: Miscon[];
  selectedMisIdx: number[];
  onToggleMisIndex: (idx: number) => void;
};

export function MisconList({
  selectedAU,
  miscons,
  selectedMisIdx,
  onToggleMisIndex,
}: Props) {
  return (
    <div className="bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b text-sm font-semibold">
        Misconceptions (chọn Mis dùng làm distractors)
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {!selectedAU && (
          <div className="text-gray-500">
            Chọn học phần → bài học → LLO → AU để xem danh sách misconceptions.
          </div>
        )}
        {selectedAU && miscons.length === 0 && (
          <div className="text-gray-500">AU này chưa có misconception nào.</div>
        )}
        {selectedAU &&
          miscons.length > 0 &&
          miscons.map((m, i) => (
            <label
              key={i}
              className="flex items-start gap-2 border rounded-lg px-2 py-1 bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selectedMisIdx.includes(i)}
                onChange={() => onToggleMisIndex(i)}
              />
              <div>
                <div className="font-semibold">
                  Mis {i + 1} – {m.error_type}
                </div>
                <div>{m.description}</div>
              </div>
            </label>
          ))}
      </div>
    </div>
  );
}
