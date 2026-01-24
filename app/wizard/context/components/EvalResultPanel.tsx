// app/wizard/context/components/EvalResultPanel.tsx
"use client";

import type { ContextWizardContext } from "../hooks/useContextWizard";

type Props = {
  ctx: ContextWizardContext;
};

function renderBadgeBloomMatch(m: string) {
  switch (m) {
    case "good":
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Bloom phù hợp
        </span>
      );
    case "too_low":
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Bloom mục tiêu cao hơn LLO
        </span>
      );
    case "too_high":
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Bloom mục tiêu thấp hơn LLO
        </span>
      );
    default:
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
          Bloom: {m}
        </span>
      );
  }
}

function renderBadgeLevelFit(m: string) {
  switch (m) {
    case "good":
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Phù hợp bậc học
        </span>
      );
    case "too_easy":
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Quá dễ so với bậc học
        </span>
      );
    case "too_hard":
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Quá khó so với bậc học
        </span>
      );
    default:
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
          Level: {m}
        </span>
      );
  }
}

export function EvalResultPanel({ ctx }: Props) {
  const { evalError, evalResult } = ctx;

  if (!evalError && !evalResult) return null;

  return (
    <>
      {evalError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl px-4 py-3">
          {evalError}
        </div>
      )}

      {evalResult && (
        <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Kết quả đánh giá LLO
            </div>
            <p className="text-sm text-slate-700">
              {evalResult.overall_comment}
            </p>
          </div>

          <div className="space-y-3">
            {evalResult.items?.map((item, idx) => (
              <div
                key={idx}
                className="border border-slate-100 rounded-xl px-3 py-2.5 bg-slate-50/60"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-xs font-medium text-slate-800">
                    {item.llo}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-50">
                      Bloom thực tế: {item.inferred_bloom}
                    </span>
                    {renderBadgeBloomMatch(item.bloom_match)}
                    {renderBadgeLevelFit(item.level_fit)}
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">{item.comments}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
