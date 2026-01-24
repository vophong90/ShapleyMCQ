// app/wizard/context/page.tsx
"use client";

import { useContextWizard } from "./hooks/useContextWizard";
import { ContextHeader } from "./components/ContextHeader";
import { ContextForm } from "./components/ContextForm";
import { ExistingLloPanel } from "./components/ExistingLloPanel";
import { EvalResultPanel } from "./components/EvalResultPanel";
import { FooterNav } from "./components/FooterNav";

export default function ContextWizardPage() {
  const ctx = useContextWizard();

  if (ctx.loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-sm text-slate-600">Đang tải dữ liệu…</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 pb-24 space-y-6">
      <ContextHeader />

      <ContextForm ctx={ctx} />

      {ctx.state.course_id && ctx.state.lesson_id && (
        <ExistingLloPanel ctx={ctx} />
      )}

      <EvalResultPanel ctx={ctx} />

      <FooterNav onBack={ctx.goDashboard} onNext={ctx.goStep2} />
    </div>
  );
}
