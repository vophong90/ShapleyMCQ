"use client";

import type { PersonaWeight } from "../types";

type Props = {
  personaWeights: PersonaWeight[];
  totalPersonaWeight: number;
  onChangeWeight: (name: string, value: number) => void;
};

export function PersonaWeightsTable({
  personaWeights,
  totalPersonaWeight,
  onChangeWeight,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-700">
            Phân bố nhóm người học (persona) trong mô phỏng
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Thiết lập % Expert / Proficient / Average / Novice / Weak / Guesser.
            Các % này dùng chung cho tất cả câu MCQ ở bước này.
          </p>
        </div>
        <div
          className={`text-[11px] px-2 py-1 rounded-full ${
            Math.abs(totalPersonaWeight - 100) < 1e-6
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          Tổng: <b>{totalPersonaWeight}%</b>{" "}
          {Math.abs(totalPersonaWeight - 100) > 1e-6 && "(nên ≈ 100%)"}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[420px] text-xs border">
          <thead>
            <tr className="bg-slate-100">
              <th className="border px-2 py-1 text-left">Persona</th>
              <th className="border px-2 py-1 text-right">% trong lớp</th>
            </tr>
          </thead>
          <tbody>
            {personaWeights.map((p) => (
              <tr key={p.name}>
                <td className="border px-2 py-1">{p.name}</td>
                <td className="border px-2 py-1 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      className="w-16 border rounded-md px-2 py-1 text-xs text-right outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                      value={p.weight}
                      onChange={(e) =>
                        onChangeWeight(p.name, Number(e.target.value) || 0)
                      }
                    />
                    <span>%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">
        Ví dụ: lớp nhiều sinh viên trung bình/yếu có thể đặt Average 40%, Novice
        30%, Weak 15%, Expert 5%, Proficient 5%, Guesser 5%.
      </p>
    </div>
  );
}
