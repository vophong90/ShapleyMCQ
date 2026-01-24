// app/wizard/mcq/components/MCQList.tsx
"use client";

import type { MCQ, NbmeResult, EduFitResult } from "../types";

type Props = {
  mcqs: MCQ[];
  nbmeResults: (NbmeResult | null)[];
  eduFitResults: (EduFitResult | null)[];
  nbmeLoadingIndex: number | null;
  eduLoadingIndex: number | null;
  savingIndex: number | null;

  onUpdateMCQ: (index: number, key: keyof MCQ, value: any) => void;
  onRefineStem: (index: number) => void;
  onRefineDistractor: (index: number, distractorIndex: number) => void;
  onRunNbmeCheck: (index: number) => void;
  onRunEduFitCheck: (index: number) => void;
  onSaveOneMCQ: (index: number) => void;
};

export function MCQList({
  mcqs,
  nbmeResults,
  eduFitResults,
  nbmeLoadingIndex,
  eduLoadingIndex,
  savingIndex,
  onUpdateMCQ,
  onRefineStem,
  onRefineDistractor,
  onRunNbmeCheck,
  onRunEduFitCheck,
  onSaveOneMCQ,
}: Props) {
  return (
    <div className="bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden h-full min-h-[320px]">
      <div className="px-4 py-2 border-b text-sm font-semibold flex justify-between items-center">
        <span>Các câu MCQ sinh ra</span>
        {mcqs.length > 0 && (
          <span className="text-xs text-gray-500">
            Đã sinh {mcqs.length} câu – chỉnh sửa từng câu, chạy phân tích và
            bấm Lưu ở từng card.
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mcqs.length === 0 && (
          <div className="text-sm text-gray-500">
            • Chọn đầy đủ học phần – bài học – LLO – AU – Mis. <br />
            • Chọn số câu muốn sinh (3–5 gợi ý). <br />
            • Chọn độ dài stem và mức độ khó. <br />
            • Tick “Tình huống lâm sàng” nếu muốn dạng clinical vignette.
            <br />
            • Bấm <b>Generate MCQ (GPT)</b> để xem kết quả ở đây.
          </div>
        )}

        {mcqs.map((mcq, idx) => {
          const nbme = nbmeResults[idx];
          const edu = eduFitResults[idx];
          const nbmeLoading = nbmeLoadingIndex === idx;
          const eduLoading = eduLoadingIndex === idx;
          const saving = savingIndex === idx;

          return (
            <div
              key={idx}
              className="border rounded-xl p-4 bg-slate-50 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">MCQ #{idx + 1}</div>
                <button
                  onClick={() => onSaveOneMCQ(idx)}
                  disabled={saving}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu…" : "Lưu MCQ này"}
                </button>
              </div>

              {/* STEM */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-semibold text-xs">Stem</h3>
                  <button
                    onClick={() => onRefineStem(idx)}
                    className="text-blue-600 hover:underline text-[11px]"
                  >
                    Refine Stem
                  </button>
                </div>
                <textarea
                  className="w-full border rounded-lg px-2 py-1 text-xs"
                  rows={4}
                  value={mcq.stem}
                  onChange={(e) =>
                    onUpdateMCQ(idx, "stem", e.target.value)
                  }
                />
              </div>

              {/* CORRECT ANSWER */}
              <div>
                <h3 className="font-semibold text-xs mb-1">Correct Answer</h3>
                <input
                  className="w-full border rounded-lg px-2 py-1 text-xs"
                  value={mcq.correct_answer}
                  onChange={(e) =>
                    onUpdateMCQ(idx, "correct_answer", e.target.value)
                  }
                />
              </div>

              {/* DISTRACTORS */}
              <div>
                <h3 className="font-semibold text-xs mb-2">Distractors</h3>
                {mcq.distractors.map((d, di) => (
                  <div key={di} className="mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium">
                        Distractor {di + 1}
                      </span>
                      <button
                        onClick={() => onRefineDistractor(idx, di)}
                        className="text-blue-600 hover:underline text-[11px]"
                      >
                        Refine
                      </button>
                    </div>
                    <input
                      className="w-full border rounded-lg px-2 py-1 mt-1 text-xs"
                      value={d}
                      onChange={(e) => {
                        const arr = [...mcq.distractors];
                        arr[di] = e.target.value;
                        onUpdateMCQ(idx, "distractors", arr);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* EXPLANATION */}
              <div>
                <h3 className="font-semibold text-xs mb-1">Explanation</h3>
                <textarea
                  className="w-full border rounded-lg px-2 py-1 text-xs"
                  rows={3}
                  value={mcq.explanation}
                  onChange={(e) =>
                    onUpdateMCQ(idx, "explanation", e.target.value)
                  }
                />
              </div>

              {/* NÚT PHÂN TÍCH */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => onRunNbmeCheck(idx)}
                  disabled={nbmeLoading}
                  className="px-3 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {nbmeLoading
                    ? "Đang NBME check…"
                    : "NBME / USMLE Style Check"}
                </button>

                <button
                  onClick={() => onRunEduFitCheck(idx)}
                  disabled={eduLoading}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {eduLoading
                    ? "Đang edu-fit…"
                    : "Educational Fit (Bloom–bậc–LLO)"}
                </button>
              </div>

              {/* KẾT QUẢ NBME */}
              <div className="bg-white border rounded-lg p-3 space-y-2 text-[11px]">
                {!nbme && (
                  <div className="text-gray-500">
                    Chưa chạy NBME / USMLE Style Check cho câu này.
                  </div>
                )}
                {nbme && (
                  <>
                    <div>
                      <span className="font-semibold">Hard rules: </span>
                      {nbme.hard_rules.passed ? (
                        <span className="text-emerald-600">PASSED</span>
                      ) : (
                        <span className="text-red-600">FAILED</span>
                      )}
                    </div>
                    {nbme.hard_rules.flags.length > 0 && (
                      <ul className="list-disc list-inside text-red-700">
                        {nbme.hard_rules.flags.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}
                    <div>
                      <span className="font-semibold">Overall score: </span>
                      <span className="text-blue-700">
                        {nbme.rubric.overall_score}/5
                      </span>
                    </div>
                    <div>{nbme.rubric.summary}</div>
                    <div className="grid grid-cols-1 gap-1">
                      {Object.entries(nbme.rubric.dimensions || {})
                        .filter(([k]) => k !== "overall_score")
                        .map(([k, v]: any) => (
                          <div
                            key={k}
                            className="border rounded-md px-2 py-1 bg-slate-50"
                          >
                            <div className="font-semibold">
                              {k}{" "}
                              <span className="text-blue-700">
                                ({v.score}/5)
                              </span>
                            </div>
                            <div>{v.comment}</div>
                          </div>
                        ))}
                    </div>
                    <div>
                      <div className="font-semibold">Gợi ý chỉnh sửa:</div>
                      <pre className="whitespace-pre-wrap">
                        {nbme.rubric.suggestions}
                      </pre>
                    </div>
                  </>
                )}
              </div>

              {/* KẾT QUẢ EDU-FIT */}
              <div className="bg-white border rounded-lg p-3 space-y-2 text-[11px]">
                {!edu && (
                  <div className="text-gray-500">
                    Chưa chạy Educational Fit cho câu này.
                  </div>
                )}
                {edu && (
                  <>
                    <div>
                      <span className="font-semibold">Bloom suy luận: </span>
                      <span className="text-blue-700">
                        {edu.inferred_bloom}
                      </span>
                    </div>
                    <div>
                      So với Bloom mục tiêu:{" "}
                      <span className="font-semibold">
                        {edu.bloom_match === "good"
                          ? "Phù hợp"
                          : edu.bloom_match === "too_low"
                          ? "Thấp hơn mục tiêu"
                          : edu.bloom_match === "too_high"
                          ? "Cao hơn mục tiêu"
                          : edu.bloom_match}
                      </span>
                    </div>
                    <div>
                      Phù hợp với bậc học:{" "}
                      <span className="font-semibold">
                        {edu.level_fit === "good"
                          ? "Phù hợp"
                          : edu.level_fit === "too_easy"
                          ? "Quá dễ"
                          : edu.level_fit === "too_hard"
                          ? "Quá khó"
                          : edu.level_fit}
                      </span>
                    </div>

                    <div>
                      <div className="font-semibold">Tóm tắt:</div>
                      <div>{edu.summary}</div>
                    </div>

                    <div>
                      <div className="font-semibold">LLO coverage:</div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {edu.llo_coverage.map((c, i) => (
                          <div
                            key={i}
                            className="border rounded-md px-2 py-1 bg-slate-50"
                          >
                            <div className="font-semibold">• {c.llo}</div>
                            <div>
                              Coverage:{" "}
                              <span className="italic">{c.coverage}</span> –{" "}
                              {c.comment}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold">Gợi ý chỉnh sửa:</div>
                      <ul className="list-disc list-inside">
                        {edu.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
