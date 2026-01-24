"use client";

import type { MCQCardState } from "../types";

type Props = {
  card: MCQCardState;
  onChangeStem: (val: string) => void;
  onChangeExplanation: (val: string) => void;
  onChangeCorrectAnswer: (val: string) => void;
  onChangeDistractor: (index: number, val: string) => void;
  onChangeSimN: (val: number) => void;

  onRunSimulation: () => void;
  onSave: () => void;
  onRefineDistractor: (index: number) => void;
};

export function MCQCard({
  card,
  onChangeStem,
  onChangeExplanation,
  onChangeCorrectAnswer,
  onChangeDistractor,
  onChangeSimN,
  onRunSimulation,
  onSave,
  onRefineDistractor,
}: Props) {
  const sim = card.simResult;
  const shapRows = card.shapleyRows;

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      {/* HEADER CARD */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-700">
            MCQ: {card.id.slice(0, 8)}…
          </div>
          <p className="text-[11px] text-slate-500 max-w-xl">
            Chỉnh sửa stem, đáp án, distractor; sau đó chạy mô phỏng Monte Carlo
            và Shapley cho riêng câu này.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500">
              N mô phỏng (tổng):
            </span>
            <input
              type="number"
              min={400}
              max={10000}
              step={200}
              className="w-20 border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              value={card.simN}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 0;
                onChangeSimN(Math.min(Math.max(val, 400), 10000));
              }}
            />
          </div>

          <button
            type="button"
            onClick={onRunSimulation}
            disabled={card.simLoading}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {card.simLoading
              ? "Đang mô phỏng..."
              : "Chạy mô phỏng (GPT + Monte Carlo)"}
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={card.saving}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {card.saving ? "Đang lưu MCQ..." : "Lưu MCQ và phân tích"}
          </button>
        </div>
      </div>

      {/* STEM + ANSWER + DISTRACTORS (EDITABLE) */}
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        {/* Stem + explanation */}
        <div className="space-y-3">
          <div>
            <div className="font-semibold text-slate-800 mb-1">Stem</div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              rows={4}
              value={card.stem}
              onChange={(e) => onChangeStem(e.target.value)}
            />
          </div>

          <div>
            <div className="font-semibold text-slate-800 mb-1">
              Explanation (nếu cần, dùng cho mô phỏng)
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              rows={3}
              value={card.explanation}
              onChange={(e) => onChangeExplanation(e.target.value)}
            />
          </div>
        </div>

        {/* Answer + distractors */}
        <div className="space-y-3">
          <div>
            <div className="font-semibold text-slate-800 mb-1">
              Đáp án đúng (A)
            </div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              value={card.correct_answer}
              onChange={(e) => onChangeCorrectAnswer(e.target.value)}
            />
          </div>

          <div>
            <div className="font-semibold text-slate-800 mb-1">
              Distractor (B, C, D...)
            </div>
            <div className="space-y-2">
              {card.distractors.map((d, idx) => {
                const label = String.fromCharCode("B".charCodeAt(0) + idx);
                const shap = card.shapleyRows?.find(
                  (r) => r.label === label
                );
                const isWeak = shap && shap.share_pct < 10;

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 p-2 rounded-lg border ${
                      isWeak
                        ? "bg-rose-50 border-rose-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="mt-1 text-xs font-semibold text-slate-700">
                      {label}.
                    </div>
                    <div className="flex-1 space-y-1">
                      <input
                        className="w-full border rounded-md px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                        value={d}
                        onChange={(e) =>
                          onChangeDistractor(idx, e.target.value)
                        }
                      />
                      {shap && (
                        <div className="text-[10px] text-slate-600">
                          Shapley:{" "}
                          <span className="font-semibold">
                            {shap.share_pct.toFixed(1)}%
                          </span>{" "}
                          – Wrong: {shap.wrong_pct.toFixed(1)}% – Novice hoặc
                          Weak: {shap.novice_pct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRefineDistractor(idx)}
                      disabled={card.refineIndex === idx}
                      className="text-[11px] text-brand-700 hover:underline ml-1"
                    >
                      {card.refineIndex === idx ? "Refining..." : "Refine"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SIM RESULT */}
      {sim && (
        <div className="space-y-4">
          <div>
            <div className="font-semibold text-slate-800 mb-1">
              Kết quả mô phỏng theo persona
            </div>
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border px-2 py-1 text-left">Persona</th>
                  <th className="border px-2 py-1 text-right">% đúng</th>
                  <th className="border px-2 py-1 text-right">N mô phỏng</th>
                </tr>
              </thead>
              <tbody>
                {sim.accuracy_summary.map((r) => (
                  <tr key={r.persona}>
                    <td className="border px-2 py-1">{r.persona}</td>
                    <td className="border px-2 py-1 text-right">
                      {(r.accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="font-semibold text-slate-800 mb-1">
              Xác suất chọn từng phương án (ước lượng bởi GPT)
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border px-2 py-1 text-left">Persona</th>
                    {sim.options.map((o) => (
                      <th
                        key={o.label}
                        className="border px-2 py-1 text-right"
                      >
                        {o.label}
                        {o.is_correct && (
                          <span className="text-emerald-700 ml-1">(đ)</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sim.personas.map((p) => (
                    <tr key={p.name}>
                      <td className="border px-2 py-1">{p.name}</td>
                      {sim.options.map((o) => (
                        <td
                          key={o.label}
                          className="border px-2 py-1 text-right"
                        >
                          {((p.probs[o.label] ?? 0) * 100).toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SHAPLEY TABLE */}
      {shapRows && (
        <div className="space-y-3">
          <div className="font-semibold text-slate-800 mb-1">
            Shapley Distractor Evaluator
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border px-2 py-1 text-left">Distractor</th>
                  <th className="border px-2 py-1 text-right">Shapley</th>
                  <th className="border px-2 py-1 text-right">Strength (%)</th>
                  <th className="border px-2 py-1 text-right">
                    % tất cả lượt chọn
                  </th>
                  <th className="border px-2 py-1 text-right">
                    % Novice + Weak
                  </th>
                </tr>
              </thead>
              <tbody>
                {shapRows.map((r) => {
                  const isWeak = r.share_pct < 10;
                  return (
                    <tr
                      key={r.label}
                      className={isWeak ? "bg-rose-50" : "bg-white"}
                    >
                      <td className="border px-2 py-1 align-top">
                        <div className="font-semibold">{r.label}</div>
                        <div className="text-gray-700 whitespace-pre-wrap">
                          {r.text}
                        </div>
                      </td>
                      <td className="border px-2 py-1 text-right align-top">
                        {r.shapley.toFixed(3)}
                      </td>
                      <td className="border px-2 py-1 text-right align-top">
                        {r.share_pct.toFixed(1)}%
                      </td>
                      <td className="border px-2 py-1 text-right align-top">
                        {r.wrong_pct.toFixed(1)}%
                      </td>
                      <td className="border px-2 py-1 text-right align-top">
                        {r.novice_pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {shapRows.map((r) => (
            <div
              key={r.label + "-rec"}
              className={`border rounded-lg p-2 text-xs ${
                r.share_pct < 10
                  ? "bg-rose-50 border-rose-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="font-semibold mb-1">
                {r.label} – Khuyến nghị:
              </div>
              <div className="text-gray-800">{r.recommendation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
