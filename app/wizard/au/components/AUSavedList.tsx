"use client";

type SavedAU = {
  id: string;
  core_statement: string;
  short_explanation?: string | null;
  bloom_min?: string | null;
  status?: string | null;
};

type Props = {
  savedAus: SavedAU[];
  loadingSaved: boolean;
  deletingId: string | null;
  onDeleteSavedAU: (id: string) => void;
};

export function AUSavedList({
  savedAus,
  loadingSaved,
  deletingId,
  onDeleteSavedAU,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            AU đã lưu cho Học phần/Bài học hiện tại
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Đây là các AU đã sinh và lưu trước đó, dùng cho Misconceptions &amp;
            MCQ. Bạn vẫn có thể sinh thêm AU mới ở bên trên.
          </p>
        </div>
        <div className="text-[11px] text-slate-500">
          Tổng:{" "}
          <span className="font-semibold text-slate-800">
            {savedAus.length}
          </span>{" "}
          AU
        </div>
      </div>

      {loadingSaved ? (
        <p className="text-xs text-slate-500">Đang tải AU đã lưu…</p>
      ) : savedAus.length === 0 ? (
        <p className="text-xs text-slate-500">
          Chưa có AU nào được lưu cho Học phần/Bài học này.
        </p>
      ) : (
        <div className="space-y-2">
          {savedAus.map((au) => (
            <div
              key={au.id}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2.5 text-xs"
            >
              <div className="flex justify-between gap-3">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {au.core_statement}
                  </div>
                  {au.short_explanation && (
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {au.short_explanation}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-col items-end gap-1">
                    {au.bloom_min && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-50">
                        Bloom tối thiểu: {au.bloom_min}
                      </span>
                    )}
                    {au.status && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
                        Trạng thái: {au.status}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteSavedAU(au.id)}
                    disabled={deletingId === au.id}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-60"
                  >
                    {deletingId === au.id ? "Đang xóa…" : "Xóa"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
