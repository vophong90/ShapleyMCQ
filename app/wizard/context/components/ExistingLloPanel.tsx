// app/wizard/context/components/ExistingLloPanel.tsx
"use client";

import type { ContextWizardContext } from "../hooks/useContextWizard";
import { BLOOM_LEVELS } from "../types";

type Props = {
  ctx: ContextWizardContext;
};

export function ExistingLloPanel({ ctx }: Props) {
  const {
    existingLlos,
    loadingExistingLlos,
    editingLloId,
    editLloText,
    editLloBloom,
    handleSaveEditLlo,
    handleCancelEditLlo,
    handleDeleteExistingLlo,
    setEditingLloId,
    setEditLloText,
    setEditLloBloom,
  } = ctx;

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            LLO đã có của Bài học này
          </div>
          <p className="text-[11px] text-slate-500">
            Các LLO đã lưu trong DB kèm số AU / Mis / MCQ liên quan. Bạn có thể
            chỉnh sửa text, chỉnh Bloom hoặc xóa LLO (xóa sẽ kéo theo xóa AU /
            Mis / MCQ qua ON DELETE CASCADE).
          </p>
        </div>
        {loadingExistingLlos && (
          <span className="text-[11px] text-slate-500">Đang tải…</span>
        )}
      </div>

      {existingLlos.length === 0 && !loadingExistingLlos && (
        <p className="text-[11px] text-slate-500">
          Chưa có LLO nào được lưu cho bài học này.
        </p>
      )}

      {existingLlos.length > 0 && (
        <div className="space-y-3">
          {existingLlos.map((row) => {
            const isEditing = editingLloId === row.llo_id;
            return (
              <div
                key={row.llo_id}
                className="border border-slate-100 rounded-xl px-3 py-2.5 bg-slate-50/60 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {!isEditing ? (
                      <p className="text-xs text-slate-800">{row.text}</p>
                    ) : (
                      <textarea
                        className="w-full border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                        rows={2}
                        value={editLloText}
                        onChange={(e) => setEditLloText(e.target.value)}
                      />
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {!isEditing ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-300 text-slate-700 bg-white">
                          Bloom: {row.bloom_suggested || "—"}
                        </span>
                      ) : (
                        <select
                          className="text-[11px] border rounded-full px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                          value={editLloBloom}
                          onChange={(e) => setEditLloBloom(e.target.value)}
                        >
                          <option value="">
                            = Không đặt (dùng Bloom mục tiêu) =
                          </option>
                          {BLOOM_LEVELS.map((b) => (
                            <option key={b.value} value={b.value}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      )}

                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-white">
                          AU {row.au_count}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                          Mis {row.mis_count}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                          MCQ {row.mcq_count}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    {!isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLloId(row.llo_id);
                            setEditLloText(row.text);
                            setEditLloBloom(row.bloom_suggested || "");
                          }}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-300 text-[11px] text-slate-700 hover:border-brand-400 hover:text-brand-700"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteExistingLlo(row.llo_id, row.text)
                          }
                          className="px-2 py-1 rounded-lg bg-rose-50 text-[11px] text-rose-700 hover:bg-rose-100"
                        >
                          Xóa
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveEditLlo(row.llo_id)}
                          className="px-2 py-1 rounded-lg bg-brand-600 text-[11px] text-white hover:bg-brand-700"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditLlo}
                          className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] text-slate-600 hover:bg-slate-200"
                        >
                          Hủy
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
