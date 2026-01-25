// app/account/components/ShareReceiveTab.tsx
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { Profile, SearchProfile, ReceivedShare } from "../types";

type Props = {
  supabase: ReturnType<typeof getSupabaseBrowser>;
  profile: Profile;
  selectedMcqIds: Set<string>;
  onSharedSuccessfully: () => void;
};

export function ShareReceiveTab({
  supabase,
  profile,
  selectedMcqIds,
  onSharedSuccessfully,
}: Props) {
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchProfile | null>(null);

  const [shareLoading, setShareLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [receivedLoading, setReceivedLoading] = useState(false);
  const [received, setReceived] = useState<ReceivedShare[]>([]);

  const selectedCount = selectedMcqIds.size;

  useEffect(() => {
    let alive = true;

    async function loadReceived() {
      setReceivedLoading(true);
      setError(null);

      try {
        const { data: shareRows, error: shareErr } = await supabase
          .from("mcq_item_shares")
          .select("id, created_at, mcq_item_id, from_user_id")
          .eq("to_user_id", profile.id)
          .order("created_at", { ascending: false });

        if (shareErr) throw shareErr;

        const rows = shareRows || [];
        if (!rows.length) {
          if (alive) setReceived([]);
          return;
        }

        const mcqIds = Array.from(new Set(rows.map((r: any) => r.mcq_item_id)));
        const fromUserIds = Array.from(new Set(rows.map((r: any) => r.from_user_id)));

        const [
          { data: mcqRows, error: mcqErr },
          { data: userRows, error: userErr },
        ] = await Promise.all([
          supabase.from("mcq_items").select("id, stem").in("id", mcqIds),
          supabase.from("profiles").select("id, name, email").in("id", fromUserIds),
        ]);

        if (mcqErr) throw mcqErr;
        if (userErr) throw userErr;

        const mcqMap = new Map<string, { id: string; stem: string }>();
        (mcqRows || []).forEach((m: any) => mcqMap.set(m.id, { id: m.id, stem: m.stem }));

        const userMap = new Map<string, { id: string; name: string | null; email: string | null }>();
        (userRows || []).forEach((u: any) =>
          userMap.set(u.id, { id: u.id, name: u.name, email: u.email })
        );

        const receivedList: ReceivedShare[] = rows.map((r: any) => {
          const mcq = mcqMap.get(r.mcq_item_id);
          const u = userMap.get(r.from_user_id);
          return {
            id: r.id,
            created_at: r.created_at,
            mcq_item_id: r.mcq_item_id,
            mcq_stem: mcq?.stem || "(Không tìm thấy stem)",
            from_user_name: u?.name ?? null,
            from_user_email: u?.email ?? null,
          };
        });

        if (alive) setReceived(receivedList);
      } catch (e: any) {
        console.error(e);
        if (alive) setError(e?.message ?? "Không tải được danh sách MCQ nhận được.");
      } finally {
        if (alive) setReceivedLoading(false);
      }
    }

    loadReceived();

    return () => {
      alive = false;
    };
  }, [supabase, profile.id]);

  async function handleSearchEmail() {
    setSearching(true);
    setError(null);
    setMessage(null);
    setSelectedUser(null);
    setSearchResults([]);

    try {
      const q = searchEmail.trim();
      if (!q) return;

      const { data, error: searchErr } = await supabase
        .from("profiles")
        .select("id, email, name")
        .ilike("email", `%${q}%`)
        .neq("id", profile.id)
        .limit(10);

      if (searchErr) throw searchErr;

      setSearchResults((data || []) as SearchProfile[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Lỗi khi tìm user theo email.");
    } finally {
      setSearching(false);
    }
  }

  async function handleShare() {
    setShareLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!selectedUser) throw new Error("Bạn chưa chọn người nhận.");
      if (!selectedCount) throw new Error("Bạn chưa chọn câu hỏi nào trong Ngân hàng MCQ.");

      const mcqArray = Array.from(selectedMcqIds);

      const res = await fetch("/api/mcq/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_profile_id: selectedUser.id,
          mcq_item_ids: mcqArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Lỗi khi chia sẻ MCQ (API).");

      setMessage(
        data?.message ||
          `Đã gửi ${mcqArray.length} câu hỏi tới ${selectedUser.email || selectedUser.name}.`
      );
      onSharedSuccessfully();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Lỗi khi chia sẻ MCQ.");
    } finally {
      setShareLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Send */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold">Gửi MCQ cho đồng nghiệp</h2>

        <div className="text-xs text-slate-600 mb-1">
          Bạn đang chọn{" "}
          <span className="font-semibold text-slate-800">{selectedCount}</span>{" "}
          câu trong Ngân hàng MCQ. Chọn người nhận bằng email và nhấn{" "}
          <span className="font-semibold">Gửi MCQ</span>.
        </div>

        <div className="flex flex-col sm:flex-row gap-2 text-sm">
          <input
            type="email"
            placeholder="Nhập email đồng nghiệp..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSearchEmail}
            disabled={searching}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            {searching ? "Đang tìm..." : "Tìm user"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="border border-slate-100 rounded-xl max-h-40 overflow-auto text-xs">
            {searchResults.map((u) => {
              const isActive = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser((prev) => (prev?.id === u.id ? null : u))}
                  className={`w-full text-left px-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 ${
                    isActive ? "bg-emerald-50/60" : ""
                  }`}
                >
                  <div className="font-medium text-slate-800">{u.name || u.email}</div>
                  <div className="text-[11px] text-slate-500">{u.email}</div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-2">
          <div className="text-slate-500">
            Người nhận:{" "}
            {selectedUser ? (
              <span className="font-semibold text-slate-800">
                {selectedUser.name || selectedUser.email}
              </span>
            ) : (
              <span className="italic text-slate-400">chưa chọn người nhận</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleShare}
            disabled={shareLoading || !selectedCount || !selectedUser}
            className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {shareLoading ? "Đang gửi..." : "Gửi MCQ"}
          </button>
        </div>

        {message && <div className="text-xs text-emerald-600 mt-1">{message}</div>}
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </div>

      {/* Received */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-2">MCQ đồng nghiệp đã chia sẻ cho bạn</h2>

        {receivedLoading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : received.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có câu hỏi nào được chia sẻ cho bạn.</p>
        ) : (
          <div className="border border-slate-100 rounded-xl max-h-[360px] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left text-slate-500">
                  <th className="py-2 pl-3 pr-2">Stem</th>
                  <th className="py-2 pr-2 w-40">Từ</th>
                  <th className="py-2 pr-3 w-36">Ngày nhận</th>
                </tr>
              </thead>
              <tbody>
                {received.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 bg-white">
                    <td className="py-2 pl-3 pr-2 align-top">
                      <div className="line-clamp-2 text-[11px] text-slate-800">{r.mcq_stem}</div>
                    </td>
                    <td className="py-2 pr-2 align-top text-[11px] text-slate-600">
                      <div>{r.from_user_name || r.from_user_email || "—"}</div>
                      {r.from_user_email && r.from_user_name && (
                        <div className="text-[10px] text-slate-400">{r.from_user_email}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                      {new Date(r.created_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-500">
          Các câu hỏi được chia sẻ cho bạn sẽ có thể dùng làm nguồn tạo đề thi trong mục{" "}
          <span className="font-semibold">Khảo thí</span>.
        </p>
      </div>
    </div>
  );
}
