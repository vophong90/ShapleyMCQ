// app/account/page.tsx
"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { TabKey } from "./types";
import { useProfile } from "./hooks/useProfile";
import { MyMcqBankTab } from "./components/MyMcqBankTab";
import { ShareReceiveTab } from "./components/ShareReceiveTab";

export default function AccountPage() {
  // ✅ one supabase instance for whole page
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const { profile, loadingProfile } = useProfile(supabase);

  const [activeTab, setActiveTab] = useState<TabKey>("bank");

  // Shared selection giữa 2 tab
  const [selectedMcqIds, setSelectedMcqIds] = useState<Set<string>>(
    () => new Set()
  );

  function toggleSelectMcq(id: string) {
    setSelectedMcqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedMcqIds(new Set());
  }

  if (loadingProfile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p>Đang tải tài khoản...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold mb-2">Tài khoản</h1>
        <p className="text-sm text-slate-600">
          Bạn cần đăng nhập để sử dụng chức năng Ngân hàng MCQ và Chia sẻ câu hỏi.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tài khoản</h1>
          <p className="text-sm text-slate-600 mt-1">
            Quản lý Ngân hàng MCQ, chia sẻ và nhận câu hỏi từ đồng nghiệp.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div className="font-medium text-slate-700">
            {profile.name || profile.email}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("bank")}
          className={`pb-2 px-1 -mb-px border-b-2 ${
            activeTab === "bank"
              ? "border-brand-600 text-brand-600 font-medium"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Ngân hàng MCQ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("share")}
          className={`pb-2 px-1 -mb-px border-b-2 ${
            activeTab === "share"
              ? "border-brand-600 text-brand-600 font-medium"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Chia sẻ / Nhận MCQ
        </button>
      </div>

      {activeTab === "bank" ? (
        <MyMcqBankTab
          supabase={supabase}
          profileId={profile.id}
          selectedMcqIds={selectedMcqIds}
          setSelectedMcqIds={setSelectedMcqIds}
          onToggleSelect={toggleSelectMcq}
          onClearSelection={clearSelection}
        />
      ) : (
        <ShareReceiveTab
          supabase={supabase}
          profile={profile}
          selectedMcqIds={selectedMcqIds}
          onSharedSuccessfully={clearSelection}
        />
      )}
    </div>
  );
}
