"use client";

type GeneratedAU = {
  core_statement: string;
  short_explanation?: string | null;
  bloom_min?: string | null;
  selected: boolean;
};

type Props = {
  aus: GeneratedAU[];
  onToggleSelect: (index: number) => void;
  onUpdateAUField: (
    index: number,
    field: "core_statement" | "short_explanation" | "bloom_min",
    value: string
  ) => void;
  onRemoveAU: (index: number) => void;
  onSaveSelected: () => void;
  saveLoading: boolean;
};

export function AUNewList({
  aus,
  onToggleSelect,
  onUpdateAUField,
  onRemoveAU,
  onSaveSelected,
  saveLoading,
}: Props) {
  const selectedCount = aus.filter((a) => a.selected).length;

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Các AU sinh mới từ GPT
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Bạn có thể chỉnh sửa nội dung, cập nhật Bloom tối thiểu, bỏ chọn hoặc
            xóa hẳn từng AU trước khi lưu xuống Supabase.
          </p>
        </div>
        <div className="text-[11px] text-slate-500">
          Đang chọn:{" "}
          <span className="font-semibold text-slate-800">
            {selectedCount}/{aus.length}
          </span>{" "}
          AU
        </div>
      </div>

      <div className="space-y-3">
        {aus.map((au, idx) => (
          <div
            key={idx}
            className={
              "border rounded-xl px-3.5 py-3 text-xs flex flex-col gap-2 " +
              (au.selected
                ? "bg-slate-50 border-brand-200"
                : "bg-white border-slate-200 opacity-80")
            }
          >
            <div className="flex flex-col gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800">
                    AU {idx + 1}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleSelect(idx)}
                      className={
                        "px-2.5 py-1 rounded-full text-[10px] font-semibold " +
                        (au.selected
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200")
                      }
                    >
                      {au.selected ? "Đang chọn" : "Không chọn"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveAU(idx)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                    >
                      Xóa AU này
                    </button>
                  </div>
                </div>
                <textarea
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                  value={au.core_statement}
                  onChange={(e) =>
                    onUpdateAUField(idx, "core_statement", e.target.value)
                  }
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-600 mb-1">
                  Giải thích ngắn (tùy chọn)
                </label>
                <textarea
                  className="w-full border rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                  value={au.short_explanation ?? ""}
                  onChange={(e) =>
                    onUpdateAUField(
                      idx,
                      "short_explanation",
                      e.target.value
                    )
                  }
                  rows={2}
                  placeholder="Có thể ghi rõ nội dung, ví dụ minh họa, giới hạn phạm vi của AU này…"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-slate-600">
                    Bloom tối thiểu:
                  </span>
                  <input
                    type="text"
                    className="border rounded-lg px-2 py-1 text-[11px] w-32 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                    value={au.bloom_min ?? ""}
                    onChange={(e) =>
                      onUpdateAUField(idx, "bloom_min", e.target.value)
                    }
                    placeholder="VD: apply"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onSaveSelected}
          disabled={saveLoading || !selectedCount}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
        >
          {saveLoading ? "Đang lưu AU…" : "Lưu AU đã chọn"}
        </button>
      </div>
    </div>
  );
}
