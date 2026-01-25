// app/account/components/MyMcqBankTab.tsx
"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { Course, Lesson, Llo, McqItem, McqOption } from "../types";
import { escapeHtml } from "../utils";
import { useMcqBankData } from "../hooks/useMcqBankData";

type Props = {
  supabase: ReturnType<typeof getSupabaseBrowser>;
  profileId: string;
  selectedMcqIds: Set<string>;
  setSelectedMcqIds: Dispatch<SetStateAction<Set<string>>>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
};

export function MyMcqBankTab({
  supabase,
  profileId,
  selectedMcqIds,
  setSelectedMcqIds,
  onToggleSelect,
  onClearSelection,
}: Props) {
  const { loading, error, courses, lessons, llos, mcqs, setMcqs } =
    useMcqBankData(supabase, profileId);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // bulk status
  const [bulkStatus, setBulkStatus] = useState<"draft" | "approved">("approved");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [selectedLloId, setSelectedLloId] = useState<string>("");
  const [searchStem, setSearchStem] = useState("");

  const filteredLessons = useMemo(() => {
    if (!selectedCourseId) return lessons;
    return lessons.filter((l) => l.course_id === selectedCourseId);
  }, [lessons, selectedCourseId]);

  const filteredLlos = useMemo(() => {
    let list = llos;
    if (selectedCourseId) list = list.filter((l) => l.course_id === selectedCourseId);
    if (selectedLessonId) list = list.filter((l) => l.lesson_id === selectedLessonId);
    return list;
  }, [llos, selectedCourseId, selectedLessonId]);

  const llosById = useMemo(() => {
    const map = new Map<string, Llo>();
    llos.forEach((l) => map.set(l.id, l));
    return map;
  }, [llos]);

  const coursesById = useMemo(() => {
    const map = new Map<string, Course>();
    courses.forEach((c) => map.set(c.id, c));
    return map;
  }, [courses]);

  const filteredMcqs = useMemo(() => {
    let list = mcqs as McqItem[];

    if (selectedCourseId) {
      list = list.filter((m) => m.course_id === selectedCourseId);
    }

    if (selectedLessonId) {
      const lessonLloIds = new Set(
        llos
          .filter(
            (l) =>
              l.course_id === selectedCourseId &&
              l.lesson_id === selectedLessonId
          )
          .map((l) => l.id)
      );

      list = list.filter((m) => {
        const ids = m.llo_ids || [];
        return ids.some((id) => lessonLloIds.has(id));
      });
    }

    if (selectedLloId) {
      list = list.filter((m) => (m.llo_ids || []).includes(selectedLloId));
    }

    if (searchStem.trim()) {
      const q = searchStem.toLowerCase();
      list = list.filter((m) => (m.stem || "").toLowerCase().includes(q));
    }

    return list;
  }, [mcqs, selectedCourseId, selectedLessonId, selectedLloId, searchStem, llos]);

  // select all visible
  const visibleIds = useMemo(() => filteredMcqs.map((m) => m.id), [filteredMcqs]);

  const allVisibleSelected = useMemo(() => {
    if (!visibleIds.length) return false;
    return visibleIds.every((id) => selectedMcqIds.has(id));
  }, [visibleIds, selectedMcqIds]);

  function toggleSelectAllVisible() {
    setSelectedMcqIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleBulkUpdateStatus() {
    setBulkMsg(null);
    setBulkErr(null);

    if (selectedMcqIds.size === 0) {
      setBulkErr("Bạn chưa chọn câu MCQ nào để đổi trạng thái.");
      return;
    }

    setBulkUpdating(true);
    try {
      const mcqArray = Array.from(selectedMcqIds);

      const res = await fetch("/api/mcq/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mcq_item_ids: mcqArray,
          status: bulkStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Lỗi khi cập nhật trạng thái.");

      // update UI local
      setMcqs((prev) =>
        prev.map((m) =>
          selectedMcqIds.has(m.id) ? { ...m, status: bulkStatus } : m
        )
      );

      setBulkMsg(data?.message || `Đã cập nhật trạng thái ${bulkStatus}.`);
      onClearSelection();
    } catch (e: any) {
      console.error(e);
      setBulkErr(e?.message ?? "Lỗi khi cập nhật trạng thái MCQ.");
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleExportWord() {
    setExportError(null);

    if (selectedMcqIds.size === 0) {
      setExportError("Bạn chưa chọn câu MCQ nào để xuất.");
      return;
    }

    setExporting(true);
    try {
      const selectedMcqs = mcqs.filter((m) => selectedMcqIds.has(m.id));
      const mcqIds = selectedMcqs.map((m) => m.id);

      const { data: optionRows, error: optErr } = await supabase
        .from("mcq_options")
        .select("id, item_id, label, text, is_correct, created_at")
        .in("item_id", mcqIds)
        .order("item_id", { ascending: true })
        .order("created_at", { ascending: true });

      if (optErr) throw optErr;

      const optionsByMcq = new Map<string, McqOption[]>();
      (optionRows || []).forEach((o: any) => {
        const row = o as McqOption;
        if (!optionsByMcq.has(row.item_id)) optionsByMcq.set(row.item_id, []);
        optionsByMcq.get(row.item_id)!.push(row);
      });

      let html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Ngân hàng MCQ</title></head>
<body>
`;

      selectedMcqs.forEach((m, idx) => {
        html += `<p><strong>Câu ${idx + 1}.</strong> ${escapeHtml(m.stem)}</p>\n`;
        const opts = optionsByMcq.get(m.id) || [];
        opts.forEach((opt) => {
          const text = `${opt.label}. ${escapeHtml(opt.text)}`;
          html += opt.is_correct
            ? `<p><strong>${text}</strong></p>\n`
            : `<p>${text}</p>\n`;
        });
        html += `<p>&nbsp;</p>\n`;
      });

      html += `</body></html>`;

      const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ngan_hang_mcq.doc";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      setExportError(e?.message ?? "Lỗi khi xuất file Word.");
    } finally {
      setExporting(false);
    }
  }

  const selectedCount = selectedMcqIds.size;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-3">
          Ngân hàng MCQ của tôi ({mcqs.length})
        </h2>

        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-3 mb-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Học phần</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value || "");
                setSelectedLessonId("");
                setSelectedLloId("");
              }}
            >
              <option value="">Tất cả</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} – ${c.title}` : c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Bài học</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={selectedLessonId}
              onChange={(e) => {
                setSelectedLessonId(e.target.value || "");
                setSelectedLloId("");
              }}
            >
              <option value="">Tất cả</option>
              {filteredLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">LLO</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={selectedLloId}
              onChange={(e) => setSelectedLloId(e.target.value || "")}
            >
              <option value="">Tất cả</option>
              {filteredLlos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code ? `${l.code} – ${l.text}` : l.text}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Tìm theo stem</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Nhập từ khoá trong stem..."
              value={searchStem}
              onChange={(e) => setSearchStem(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs mb-2">
          <div className="text-slate-500">
            Đang hiển thị{" "}
            <span className="font-semibold text-slate-700">
              {filteredMcqs.length}
            </span>{" "}
            câu hỏi.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">
                Đã chọn{" "}
                <span className="font-semibold text-slate-700">{selectedCount}</span>{" "}
                câu.
              </span>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-[11px] text-slate-500 hover:text-red-500"
                >
                  Bỏ chọn
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as any)}
                disabled={bulkUpdating}
                aria-label="Chọn trạng thái"
              >
                <option value="approved">approved</option>
                <option value="draft">draft</option>
              </select>

              <button
                type="button"
                onClick={handleBulkUpdateStatus}
                disabled={bulkUpdating || selectedMcqIds.size === 0}
                className="inline-flex items-center rounded-lg bg-brand-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {bulkUpdating ? "Đang cập nhật..." : "Cập nhật trạng thái"}
              </button>

              <button
                type="button"
                onClick={handleExportWord}
                disabled={exporting || selectedMcqIds.size === 0}
                className="inline-flex items-center rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {exporting ? "Đang xuất..." : "Xuất Word"}
              </button>
            </div>
          </div>
        </div>

        {exportError && <div className="mb-2 text-[11px] text-red-600">{exportError}</div>}
        {bulkErr && <div className="mb-2 text-[11px] text-red-600">{bulkErr}</div>}
        {bulkMsg && <div className="mb-2 text-[11px] text-emerald-600">{bulkMsg}</div>}

        {loading ? (
          <p className="text-sm text-slate-500">Đang tải MCQ...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredMcqs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Không có câu hỏi nào phù hợp bộ lọc hiện tại.
          </p>
        ) : (
          <div className="border border-slate-100 rounded-xl max-h-[480px] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left text-slate-500">
                  <th className="py-2 pl-3 pr-2 w-8">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label={allVisibleSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    />
                  </th>
                  <th className="py-2 pr-3">Stem</th>
                  <th className="py-2 pr-3 w-32">Học phần</th>
                  <th className="py-2 pr-3 w-28">LLO</th>
                  <th className="py-2 pr-3 w-20">Trạng thái</th>
                </tr>
              </thead>

              <tbody>
                {filteredMcqs.map((m) => {
                  const isSelected = selectedMcqIds.has(m.id);
                  const course = m.course_id ? coursesById.get(m.course_id) : null;
                  const firstLlo =
                    (m.llo_ids && m.llo_ids.length > 0 && llosById.get(m.llo_ids[0])) || null;

                  return (
                    <tr
                      key={m.id}
                      className={`border-t border-slate-100 ${isSelected ? "bg-emerald-50/40" : "bg-white"}`}
                    >
                      <td className="py-2 pl-3 pr-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          checked={isSelected}
                          onChange={() => onToggleSelect(m.id)}
                        />
                      </td>

                      <td className="py-2 pr-3 align-top">
                        <div className="line-clamp-2 text-[11px] text-slate-800">
                          {m.stem}
                        </div>
                      </td>

                      <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                        {course ? (course.code ? `${course.code}` : course.title) : "—"}
                      </td>

                      <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                        {firstLlo ? (firstLlo.code || firstLlo.text.slice(0, 14) + "…") : "—"}
                      </td>

                      <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                        {m.status || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Gợi ý: Chọn các MCQ cần gửi hoặc cần xuất Word, sau đó chuyển sang tab{" "}
        <span className="font-semibold">“Chia sẻ / Nhận MCQ”</span> để nhập email đồng nghiệp và gửi.
      </p>
    </div>
  );
}
