"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/* ================= TYPES ================= */

type LloDistributionConfig = {
  llo_id: string;
  code?: string | null;
  weight_percent: number;
};

type BlueprintConfig = {
  course_id: string | null;
  total_questions: number;
  include_sources?: {
    own_mcq?: boolean;
    shared_mcq?: boolean;
  };
  status_filter?: string[];
  llo_distribution: LloDistributionConfig[];
};

type ExamBlueprint = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  config: BlueprintConfig;
};

type ExamVersion = {
  id: string;
  version_no: number;
  created_at: string;
  title?: string | null;
};

type BloomStat = {
  bloom: string;
  count: number;
  percent: number;
};

/* ================= CONSTANTS ================= */

const BLOOM_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#6366f1",
  "#f97316",
  "#e11d48",
  "#a855f7",
  "#64748b",
];

/* ================= CHART ================= */

function BloomDonutChart({ data }: { data: BloomStat[] }) {
  if (!data?.length) return null;

  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="percent"
            nameKey="bloom"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={3}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={BLOOM_COLORS[i % BLOOM_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================= MAIN PAGE ================= */

export default function ExamBlueprintDetailPage() {
  const params = useParams();
  const blueprintId = params?.blueprintId as string;
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [blueprint, setBlueprint] = useState<ExamBlueprint | null>(null);
  const [examVersions, setExamVersions] = useState<ExamVersion[]>([]);

  // UI: card nào đang bung thống kê
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  // cache stats theo examId để khỏi fetch lại
  const [bloomByExam, setBloomByExam] = useState<Record<string, BloomStat[]>>(
    {}
  );
  const [warningsByExam, setWarningsByExam] = useState<Record<string, string[]>>(
    {}
  );
  const [statsLoadingExamId, setStatsLoadingExamId] = useState<string | null>(
    null
  );

  /* ================= LOAD BLUEPRINT ================= */

  useEffect(() => {
    async function loadBlueprint() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Chưa đăng nhập");

        const { data: bp, error } = await supabase
          .from("exam_blueprints")
          .select("id, title, description, owner_id, config")
          .eq("id", blueprintId)
          .single();

        if (error || !bp) throw error;
        setBlueprint(bp as ExamBlueprint);
      } catch (e: any) {
        setError(e?.message || "Không tải được blueprint");
      } finally {
        setLoading(false);
      }
    }

    if (blueprintId) loadBlueprint();
  }, [blueprintId, supabase]);

  /* ================= LOAD EXAM VERSIONS ================= */

  const loadExamVersions = useCallback(async () => {
    const { data, error } = await supabase
      .from("exams")
      .select("id, version_no, created_at, title")
      .eq("blueprint_id", blueprintId)
      .order("version_no", { ascending: false });

    if (error) return;
    setExamVersions((data || []) as ExamVersion[]);
  }, [blueprintId, supabase]);

  useEffect(() => {
    if (blueprintId) loadExamVersions();
  }, [blueprintId, loadExamVersions]);

  /* ================= BLOOM STATS (per exam) ================= */

  const loadBloomStats = useCallback(
    async (examId: string) => {
      // đã có cache rồi -> khỏi tải
      if (bloomByExam[examId]) return;

      setStatsLoadingExamId(examId);
      try {
        const res = await fetch(`/api/exams/${examId}/bloom-stats`);
        const json = await res.json();

        if (json?.success) {
          setBloomByExam((prev) => ({
            ...prev,
            [examId]: (json.bloom_stats || []) as BloomStat[],
          }));
          setWarningsByExam((prev) => ({
            ...prev,
            [examId]: (json.warnings || []) as string[],
          }));
        } else {
          setBloomByExam((prev) => ({ ...prev, [examId]: [] }));
          setWarningsByExam((prev) => ({ ...prev, [examId]: [] }));
        }
      } finally {
        setStatsLoadingExamId((cur) => (cur === examId ? null : cur));
      }
    },
    [bloomByExam]
  );

  /* ================= GENERATE EXAM ================= */

  async function handleGenerateExam() {
    if (!blueprint) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/exams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint_id: blueprint.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generate thất bại");

      await loadExamVersions();
      // optional: auto bung thống kê version mới nhất (data.exam_id nếu API trả về)
    } catch (e: any) {
      setError(e?.message || "Lỗi khi tạo đề");
    } finally {
      setGenerating(false);
    }
  }

  /* ================= DELETE VERSION ================= */

  async function handleDeleteVersion(examId: string) {
    if (!confirm("Bạn chắc chắn muốn xoá version đề này?")) return;

    const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
    const json = await res.json();

    if (!json?.success) {
      alert(json?.error || "Xoá thất bại");
      return;
    }

    // nếu đang bung thống kê đúng card này thì đóng lại
    setExpandedExamId((cur) => (cur === examId ? null : cur));

    // xoá cache stats cho gọn (optional)
    setBloomByExam((prev) => {
      const next = { ...prev };
      delete next[examId];
      return next;
    });
    setWarningsByExam((prev) => {
      const next = { ...prev };
      delete next[examId];
      return next;
    });

    await loadExamVersions();
  }

  /* ================= RENDER ================= */

  if (loading) return <p className="p-8">Đang tải…</p>;
  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (!blueprint) return <p className="p-8">Không tìm thấy blueprint</p>;

  const cfg = blueprint.config;
  const canGenerate =
    cfg.total_questions > 0 && cfg.llo_distribution.length > 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Khảo thí – {blueprint.title}</h1>
          {blueprint.description && (
            <p className="text-sm text-slate-600 mt-1">{blueprint.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Link
            href={`/exam-blueprints/${blueprint.id}/config`}
            className="px-3 py-2 rounded border text-sm"
          >
            Cấu hình Blueprint
          </Link>

          <button
            onClick={handleGenerateExam}
            disabled={!canGenerate || generating}
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-60"
          >
            {generating ? "Đang tạo…" : "Tạo version mới"}
          </button>
        </div>
      </div>

      {/* Versions */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <div className="font-semibold">Danh sách Version</div>
          <div className="text-xs text-slate-500 mt-1">
            Mỗi version là một đề. Bạn có thể xuất Word hoặc vào “Phân tích đề”.
          </div>
        </div>

        <div className="divide-y">
          {examVersions.length === 0 ? (
            <div className="p-4 text-slate-500">Chưa có version nào.</div>
          ) : (
            examVersions.map((v) => {
              const expanded = expandedExamId === v.id;
              const bloomStats = bloomByExam[v.id] || [];
              const warnings = warningsByExam[v.id] || [];
              const statsLoading = statsLoadingExamId === v.id;

              return (
                <div key={v.id} className="p-4">
                  {/* Row */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        Version {v.version_no}
                        {v.title ? (
                          <span className="text-slate-500 font-normal">
                            {" "}
                            – {v.title}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(v.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Link
                        href={`/exams/${v.id}`}
                        className="px-3 py-1 rounded text-sm bg-slate-900 text-white"
                      >
                        Phân tích đề
                      </Link>

                      <a
                        href={`/api/exams/${v.id}/export/question-paper`}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        Xuất đề
                      </a>

                      <a
                        href={`/api/exams/${v.id}/export/answer-key`}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        Xuất đáp án
                      </a>

                      <button
                        onClick={() => handleDeleteVersion(v.id)}
                        className="px-3 py-1 border rounded text-sm text-red-600"
                      >
                        Xoá
                      </button>

                      <button
                        onClick={async () => {
                          if (expanded) {
                            setExpandedExamId(null);
                          } else {
                            setExpandedExamId(v.id);
                            await loadBloomStats(v.id);
                          }
                        }}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        {expanded ? "Ẩn thống kê" : "Xem thống kê"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded stats */}
                  {expanded && (
                    <div className="mt-4 rounded-lg border bg-slate-50 p-4">
                      {statsLoading ? (
                        <div className="text-sm text-slate-500">
                          Đang tải thống kê Bloom…
                        </div>
                      ) : (
                        <>
                          {warnings.length > 0 && (
                            <div className="text-xs text-amber-700 mb-3 space-y-1">
                              {warnings.map((w, i) => (
                                <div key={i}>• {w}</div>
                              ))}
                            </div>
                          )}

                          {bloomStats.length > 0 ? (
                            <BloomDonutChart data={bloomStats} />
                          ) : (
                            <div className="text-sm text-slate-500">
                              Chưa có dữ liệu Bloom cho version này.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
