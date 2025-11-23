"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

type MCQItemRow = {
  id: string;
  stem: string;
  correct_answer: string;
  explanation?: string | null;
  bloom_level?: string | null;
  learner_level?: string | null;
  status?: string | null;
  specialty_id?: string | null;
  created_at?: string | null;
  // các field meta tuỳ bạn đã khai báo
  nbme_meta?: any;
  edu_fit_meta?: any;
  shapley_meta?: any;
  [key: string]: any;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  for_review: "For review",
  approved: "Approved",
  retired: "Retired",
};

const BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

export default function AdminItemsPage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [items, setItems] = useState<MCQItemRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bloomFilter, setBloomFilter] = useState<string>("all");

  const [selectedItem, setSelectedItem] = useState<MCQItemRow | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  // 1. Check session + admin role
  useEffect(() => {
    (async () => {
      setLoadingMe(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: me, error } = await supabase
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", session.user.id)
        .single();

      setLoadingMe(false);

      if (error || !me) {
        router.replace("/login");
        return;
      }

      setCurrentProfile(me);

      if (me.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      loadItems("", "all", "all");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadItems(
    q: string,
    status: string,
    bloom: string
  ) {
    setLoadingList(true);
    setSelectedItem(null);

    let query = supabase
      .from("mcq_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (q.trim()) {
      const like = `%${q.trim()}%`;
      // tuỳ schema, có thể thêm search theo explanation sau
      query = query.ilike("stem", like);
    }

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (bloom !== "all") {
      query = query.eq("bloom_level", bloom);
    }

    const { data, error } = await query;

    setLoadingList(false);

    if (error) {
      alert("Lỗi tải MCQ items: " + error.message);
      return;
    }

    setItems((data || []) as MCQItemRow[]);
  }

  function filteredLabelStatus(item: MCQItemRow) {
    const st = item.status || "draft";
    return STATUS_LABEL[st] || st;
  }

  async function updateStatus(item: MCQItemRow, newStatus: string) {
    setSavingStatus(true);

    const { error } = await supabase
      .from("mcq_items")
      .update({ status: newStatus })
      .eq("id", item.id);

    setSavingStatus(false);

    if (error) {
      alert("Đổi trạng thái thất bại: " + error.message);
      return;
    }

    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id ? { ...x, status: newStatus } : x
      )
    );

    if (selectedItem?.id === item.id) {
      setSelectedItem({ ...item, status: newStatus });
    }
  }

  const canShow = currentProfile && currentProfile.role === "admin";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            MCQ Bank – Quản lý câu hỏi
          </h1>
          <p className="text-sm text-slate-500">
            Xem, lọc và duyệt câu hỏi MCQ, kèm thông tin Bloom, trạng thái
            và các chỉ số chất lượng.
          </p>
        </div>

        {currentProfile && (
          <div className="text-xs text-right text-slate-500">
            Đăng nhập:{" "}
            <span className="font-semibold">
              {currentProfile.email || currentProfile.name}
            </span>{" "}
            ({currentProfile.role})
          </div>
        )}
      </div>

      {loadingMe && (
        <div className="text-sm text-slate-500">
          Đang kiểm tra quyền…
        </div>
      )}

      {!loadingMe && !canShow && (
        <div className="text-sm text-red-600">
          Bạn không có quyền truy cập trang Admin.
        </div>
      )}

      {!loadingMe && canShow && (
        <div className="flex gap-4 h-[calc(100vh-140px)]">
          {/* LEFT: list */}
          <div className="w-1/2 flex flex-col">
            {/* Filters */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    loadItems(search, statusFilter, bloomFilter);
                  }
                }}
                placeholder="Tìm trong stem..."
                className="border rounded-lg px-3 py-2 text-sm w-64"
              />

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  loadItems(search, e.target.value, bloomFilter);
                }}
                className="border rounded-lg px-2 py-2 text-sm"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="draft">Draft</option>
                <option value="for_review">For review</option>
                <option value="approved">Approved</option>
                <option value="retired">Retired</option>
              </select>

              <select
                value={bloomFilter}
                onChange={(e) => {
                  setBloomFilter(e.target.value);
                  loadItems(search, statusFilter, e.target.value);
                }}
                className="border rounded-lg px-2 py-2 text-sm"
              >
                <option value="all">Bloom (tất cả)</option>
                {BLOOM_LEVELS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <button
                onClick={() => loadItems(search, statusFilter, bloomFilter)}
                className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
              >
                Làm mới
              </button>
            </div>

            {/* Table */}
            <div className="flex-1 border rounded-xl bg-white overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-2 py-2 border-b text-left w-12">
                      #
                    </th>
                    <th className="px-2 py-2 border-b text-left">
                      Stem
                    </th>
                    <th className="px-2 py-2 border-b text-left w-24">
                      Bloom
                    </th>
                    <th className="px-2 py-2 border-b text-left w-28">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-3 text-slate-500 text-center"
                      >
                        Đang tải danh sách câu hỏi...
                      </td>
                    </tr>
                  )}

                  {!loadingList && items.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-3 text-slate-500 text-center"
                      >
                        Chưa có câu MCQ nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}

                  {!loadingList &&
                    items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`cursor-pointer hover:bg-slate-50 ${
                          selectedItem?.id === item.id
                            ? "bg-blue-50"
                            : ""
                        }`}
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="px-2 py-2 border-t align-top text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2 border-t align-top">
                          <div className="line-clamp-3">
                            {item.stem}
                          </div>
                        </td>
                        <td className="px-2 py-2 border-t align-top text-xs">
                          {item.bloom_level || "-"}
                        </td>
                        <td className="px-2 py-2 border-t align-top text-xs">
                          {filteredLabelStatus(item)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: detail */}
          <div className="w-1/2">
            {!selectedItem && (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Chọn một câu hỏi bên trái để xem chi tiết.
              </div>
            )}

            {selectedItem && (
              <div className="h-full flex flex-col border rounded-xl bg-white p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      ID: {selectedItem.id}
                    </div>
                    <h2 className="font-semibold mb-2">
                      Stem
                    </h2>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">
                      {selectedItem.stem}
                    </p>
                  </div>

                  <div className="min-w-[160px]">
                    <div className="text-xs text-slate-500 mb-1">
                      Trạng thái
                    </div>
                    <select
                      value={selectedItem.status || "draft"}
                      onChange={(e) =>
                        updateStatus(selectedItem, e.target.value)
                      }
                      disabled={savingStatus}
                      className="border rounded-lg px-2 py-1 text-sm w-full"
                    >
                      <option value="draft">Draft</option>
                      <option value="for_review">For review</option>
                      <option value="approved">Approved</option>
                      <option value="retired">Retired</option>
                    </select>

                    <div className="mt-3 text-xs text-slate-500">
                      Bloom:{" "}
                      <span className="font-semibold">
                        {selectedItem.bloom_level || "-"}
                      </span>
                      <br />
                      Bậc học:{" "}
                      <span className="font-semibold">
                        {selectedItem.learner_level || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-1">
                    Đáp án đúng
                  </h3>
                  <p className="text-sm text-emerald-700">
                    {selectedItem.correct_answer}
                  </p>
                </div>

                {selectedItem.explanation && (
                  <div>
                    <h3 className="font-semibold mb-1">
                      Giải thích
                    </h3>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">
                      {selectedItem.explanation}
                    </p>
                  </div>
                )}

                {/* Chỉ số chất lượng nếu bạn đã lưu meta vào JSON */}
                {(selectedItem.nbme_meta ||
                  selectedItem.edu_fit_meta ||
                  selectedItem.shapley_meta) && (
                  <div className="border-t pt-3 space-y-2 text-xs">
                    <h3 className="font-semibold">
                      Chỉ số chất lượng (nếu có)
                    </h3>

                    {selectedItem.nbme_meta && (
                      <div className="border rounded-lg p-2 bg-slate-50">
                        <div className="font-semibold mb-1">
                          NBME / USMLE checks
                        </div>
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(
                            selectedItem.nbme_meta,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}

                    {selectedItem.edu_fit_meta && (
                      <div className="border rounded-lg p-2 bg-slate-50">
                        <div className="font-semibold mb-1">
                          Educational Fit
                        </div>
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(
                            selectedItem.edu_fit_meta,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}

                    {selectedItem.shapley_meta && (
                      <div className="border rounded-lg p-2 bg-slate-50">
                        <div className="font-semibold mb-1">
                          Shapley / Distractor Strength
                        </div>
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(
                            selectedItem.shapley_meta,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-auto text-[11px] text-slate-400">
                  Gợi ý: sau này ta có thể thêm nút “Xem chi tiết Shapley
                  / Monte Carlo” mở sang tab wizard/simulate với MCQ này.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
