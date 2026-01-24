"use client";

type WizardContext = {
  course_title?: string;
  lesson_title?: string;
  learner_level?: string;
  bloom_level?: string;
};

type LLO = {
  id: string;
  text: string;
};

type Props = {
  context: WizardContext;
  llos: LLO[];
  selectedLloId: string | null;
  onChangeSelectedLloId: (id: string | null) => void;
  loadingLLOs: boolean;
  currentLloLines: string[];
};

export function AULloPanel({
  context,
  llos,
  selectedLloId,
  onChangeSelectedLloId,
  loadingLLOs,
  currentLloLines,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
        {context.course_title && (
          <div>
            <span className="font-semibold text-slate-800">Học phần:</span>{" "}
            {context.course_title}
          </div>
        )}
        {context.lesson_title && (
          <div>
            <span className="font-semibold text-slate-800">Bài học:</span>{" "}
            {context.lesson_title}
          </div>
        )}
        {context.learner_level && (
          <div>
            <span className="font-semibold text-slate-800">Bậc học:</span>{" "}
            {context.learner_level}
          </div>
        )}
        {context.bloom_level && (
          <div>
            <span className="font-semibold text-slate-800">Bloom:</span>{" "}
            {context.bloom_level}
          </div>
        )}
      </div>

      {/* Chọn LLO mục tiêu */}
      {llos.length > 0 && (
        <div className="mb-3">
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            LLO mục tiêu (AU sinh ra sẽ gắn với LLO này)
          </label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            value={selectedLloId ?? ""}
            onChange={(e) =>
              onChangeSelectedLloId(e.target.value || null)
            }
          >
            <option value="">-- Chọn LLO mục tiêu --</option>
            {llos.map((l) => (
              <option key={l.id} value={l.id}>
                {l.text}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Bước 2 giả định rằng mỗi lần sinh AU là cho một LLO cụ thể. Bạn sẽ
            chạy lại bước này nếu cần AU cho LLO khác.
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-slate-700">
            LLO của bài học:
          </div>
          <div className="text-[11px] text-slate-500">
            {loadingLLOs ? (
              <span>Đang tải LLO…</span>
            ) : (
              <>
                Tổng:{" "}
                <span className="font-semibold text-slate-800">
                  {currentLloLines.length}
                </span>{" "}
                LLO
              </>
            )}
          </div>
        </div>

        {loadingLLOs ? (
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Đang đọc LLO từ cơ sở dữ liệu…
          </div>
        ) : currentLloLines.length === 0 ? (
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            Chưa có LLO cho bài học này. Vui lòng quay lại Bước 1 để nhập và lưu LLO.
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-auto">
            <ul className="space-y-1.5 text-xs text-slate-700">
              {currentLloLines.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-[2px] text-[10px] font-semibold text-slate-500">
                    {idx + 1}.
                  </span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-1 text-[11px] text-slate-500">
          GPT sẽ dựa vào danh sách LLO này + nguồn anh chọn ở dưới (tài liệu upload,
          sách trong DB hoặc kiến thức nền) để sinh AU.
        </p>
      </div>
    </div>
  );
}
