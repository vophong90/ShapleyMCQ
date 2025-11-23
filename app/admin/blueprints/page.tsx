"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

type MCQItem = {
  id: string;
  stem: string;
  bloom_level?: string | null;
  learner_level?: string | null;
  status?: string | null;
  specialty_id?: string | null;
};

type Specialty = {
  id: string;
  code: string;
  name: string;
};

const BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

export default function AdminBlueprintsPage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [items, setItems] = useState<MCQItem[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("approved");
  const [bloomFilter, setBloomFilter] = useState<string>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");

  // 1. Check admin + load data
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

      await loadSpecialties();
      await loadItems("approved", "all", "all");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSpecialties() {
    const { data, error } = await supabase
      .from("specialties")
      .select("id, code, name")
      .order("name", { ascending: true });

    if (!error && data) {
      setSpecialties(data);
    }
  }

  async function loadItems(
    status: string,
    bloom: string,
    specId: string
  ) {
    setLoadingData(true);

    let query = supabase
      .from("mcq_items")
      .select("id, stem, bloom_level, learner_level, status, specialty_id");

    if (status !== "all") {
      query = query.eq("status", status);
    }
    if (bloom !== "all") {
      query = query.eq("bloom_level", bloom);
    }
    if (specId !== "all") {
      query = query.eq("specialty_id", specId);
    }

    const { data, error } = await query;
    setLoadingData(false);

    if (error) {
      alert("Lỗi tải MCQ cho blueprint: " + error.message);
      return;
    }

    setItems((data || []) as MCQItem[]);
  }

  const canShow = currentProfile && currentProfile.role === "admin";

  // BLUEPRINT SUMMARY
  const totalItems = items.length;
  const totalApproved = items.filter((i) => i.status === "approved").length;

  const bloomCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of BLOOM_LEVELS) m[b] = 0;
    for (const it of items) {
      const b = it.bloom_level || "none";
      m[b] = (m[b] || 0) + 1;
    }
    return m;
  }, [items]);

  const learnerCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) {
      const lv = it.learner_level || "none";
      m[lv] = (m[lv] || 0) + 1;
    }
    return m;
  }, [items]);

  const specMap = useMemo(() => {
    const m: Record<string, Specialty> = {};
    for (const s of specialties) m[s.id] = s;
    return m;
  }, [specialties]);

  const blueprintBySpec = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) {
      const id = it.specialty_id || "none";
      m[id] = (m[id] || 0) + 1;
    }
    return m;
  }, [items]);

  function handleFilterChange(
    newStatus: string,
    newBloom: string,
    newSpec: string
  ) {
    setStatusFilter(newStatus);
    setBloomFilter(newBloom);
    setSpecialtyFilter(newSpec);
    loadItems(newStatus, newBloom, newSpec);
  }

  function triggerExport() {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (bloomFilter !== "all") params.set("bloom", bloomFilter);
    if (specialtyFilter !== "all") params.set("specialty_id", specialtyFilter);

    const url = "/api/admin/items/export?" + params.toString();
    window.location.href = url;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Blueprint & Export
          </h1>
          <p className="text-sm text-slate-500">
            Xem cấu trúc ngân hàng MCQ theo Bloom / bậc học / chuyên ngành và
            xuất danh sách câu hỏi ra CSV theo blueprint.
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
        <>
          {/* Filters + Export */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) =>
                handleFilterChange(e.target.value, bloomFilter, specialtyFilter)
              }
              className="border rounded-lg px-2 py-2 text-sm"
            >
              <option value="approved">Chỉ approved</option>
              <option value="draft">Chỉ draft</option>
              <option value="for_review">Chỉ for_review</option>
              <option value="retired">Chỉ retired</option>
              <option value="all">Tất cả trạng thái</option>
            </select>

            <select
              value={bloomFilter}
              onChange={(e) =>
                handleFilterChange(statusFilter, e.target.value, specialtyFilter)
              }
              className="border rounded-lg px-2 py-2 text-sm"
            >
              <option value="all">Bloom (tất cả)</option>
              {BLOOM_LEVELS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="none">(Không ghi Bloom)</option>
            </select>

            <select
              value={specialtyFilter}
              onChange={(e) =>
                handleFilterChange(statusFilter, bloomFilter, e.target.value)
              }
              className="border rounded-lg px-2 py-2 text-sm"
            >
              <option value="all">Tất cả chuyên ngành</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} – {s.name}
                </option>
              ))}
              <option value="none">(Chưa gán chuyên ngành)</option>
            </select>

            <div className="flex-1" />

            <button
              onClick={triggerExport}
              disabled={loadingData || !items.length}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Xuất CSV ({items.length} câu)
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="border rounded-xl bg-white p-4">
              <div className="text-xs text-slate-500 mb-1">
                Tổng số MCQ theo bộ lọc
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {totalItems}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Approved:{" "}
                <span className="font-semibold">
                  {totalApproved}
                </span>
              </div>
            </div>

            <div className="border rounded-xl bg-white p-4">
              <div className="text-xs text-slate-500 mb-1">
                Phân bố theo Bloom
              </div>
              <ul className="text-xs space-y-1">
                {BLOOM_LEVELS.map((b) => (
                  <li key={b}>
                    <span className="font-semibold">{b}:</span>{" "}
                    {bloomCount[b] || 0}
                  </li>
                ))}
                <li>
                  <span className="font-semibold">
                    (Không ghi Bloom):
                  </span>{" "}
                  {bloomCount["none"] || 0}
                </li>
              </ul>
            </div>

            <div className="border rounded-xl bg-white p-4">
              <div className="text-xs text-slate-500 mb-1">
                Phân bố theo bậc học
              </div>
              <ul className="text-xs space-y-1">
                {Object.entries(learnerCount).map(([lv, n]) => (
                  <li key={lv}>
                    <span className="font-semibold">
                      {lv === "none" ? "(Không ghi)" : lv}:
                    </span>{" "}
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Blueprint by Specialty */}
          <div className="border rounded-xl bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">
                Blueprint theo chuyên ngành (số câu)
              </h2>
            </div>
            {loadingData && (
              <div className="text-sm text-slate-500">
                Đang tải dữ liệu...
              </div>
            )}
            {!loadingData && (
              <table className="w-full text-xs border">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border px-2 py-1 text-left">
                      Chuyên ngành
                    </th>
                    <th className="border px-2 py-1 text-right">
                      Số câu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(blueprintBySpec).map(
                    ([specId, count]) => {
                      const spec = specMap[specId];
                      const label =
                        specId === "none"
                          ? "(Chưa gán chuyên ngành)"
                          : spec
                          ? `${spec.code} – ${spec.name}`
                          : `(ID: ${specId})`;
                      return (
                        <tr key={specId}>
                          <td className="border px-2 py-1">
                            {label}
                          </td>
                          <td className="border px-2 py-1 text-right">
                            {count}
                          </td>
                        </tr>
                      );
                    }
                  )}
                  {Object.keys(blueprintBySpec).length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="border px-2 py-2 text-center text-slate-500"
                      >
                        Không có dữ liệu với bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
