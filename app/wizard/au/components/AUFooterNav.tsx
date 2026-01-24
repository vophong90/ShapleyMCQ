"use client";

type Props = {
  onBackStep1: () => void;
  onNextStep3: () => void;
};

export function AUFooterNav({ onBackStep1, onNextStep3 }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackStep1}
          className="
              px-3 py-1.5
              rounded-full
              text-xs font-medium
              border border-slate-300
              bg-white text-slate-700
              hover:border-brand-400 hover:text-brand-700
              transition
            "
        >
          ← Quay lại Bước 1
        </button>

        <button
          type="button"
          onClick={onNextStep3}
          className="
              px-3.5 py-1.5
              rounded-full
              text-xs font-semibold
              border border-slate-900
              bg-slate-900 text-white
              hover:bg-slate-800
              transition
            "
        >
          Tiếp tục → Bước 3
        </button>
      </div>
    </div>
  );
}
