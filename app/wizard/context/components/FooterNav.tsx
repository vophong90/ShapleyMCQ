// app/wizard/context/components/FooterNav.tsx
"use client";

type Props = {
  onBack: () => void;
  onNext: () => void;
};

export function FooterNav({ onBack, onNext }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className={
            "px-3 py-1.5 rounded-full border transition text-xs font-medium " +
            "border-slate-300 bg-white text-slate-700 " +
            "hover:border-brand-400 hover:text-brand-700"
          }
        >
          ← Quay lại Dashboard
        </button>

        <button
          type="button"
          onClick={onNext}
          className={
            "px-3.5 py-1.5 rounded-full border transition text-xs font-semibold " +
            "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
          }
        >
          Tiếp tục Bước 2 →
        </button>
      </div>
    </div>
  );
}
