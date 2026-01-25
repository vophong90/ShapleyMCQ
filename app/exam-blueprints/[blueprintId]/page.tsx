"use client";

import { useEffect, useMemo, useState } from "react";
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
  if (!data.length) return null;

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
              <Cell
                key={i}
                fill={BLOOM_COLORS[i % BLOOM_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => `${v.toFixed(1)}%`} />
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

  // Danh sách versions
  const [examVersions, setExamVersions] = useState<ExamVersion[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamVersion | null>(null);

  // Stats theo version đang chọn
  const [bloomStats, setBloomStats] = useState<BloomStat[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  /* ================= LOAD BLUEPRINT ================= */

  useEffect(() => {
    async function loadBlueprint() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Chưa đăng nhập");

        const { data, error } = await supabase
          .from("exam_blueprints")
          .select("id, title, description, owner_id, config")
          .eq("id", blueprintId)
          .single();

        if (error || !data) throw error;

        setBlueprint(data as ExamBlueprint);
      } catch (e: any) {
        setError(e.message || "Không tải được blueprint");
      } finally {
        setLoading(false);
      }
    }

    if (blueprintId) loadBlueprint();
  }, [blueprintId, supabase]);

  /* ================= LOAD EXAM VERSIONS ================= */

  async function loadExamVersions(autoSelectNewest = false) {
    const { data, error } = await supabase
      .from("exams")
      .select("id, version_no, created_at")
      .eq("blueprint_id", blueprintId)
      .order("version_no", { ascending: false });

    if (!error) {
      setExamVersions(data || []);
      if (autoSelectNewest && data?.length) {
        setSelectedExam(data[0]);
        loadBloomStats(data[0].id);
      }
    }
  }

  useEffect(() => {
    if (blueprintId) loadExamVersions();
  }, [blueprintId]);

  /* ================= LOAD BLOOM STATS ================= */

  async function loadBloomStats(examId: string) {
    const res = await fetch(`/api/exams/${examId}/bloom-stats`);
    const json = await res.json();
    if (json.success) {
      setBloomStats(json.bloom_stats || []);
      setWarnings(json.warnings || []);
    }
  }

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
      if (!res.ok) throw new Error(data.error || "Generate thất bại");

      // Reload list và auto select version mới nhất
      await loadExamVersions(true);
    } catch (e: any) {
      setError(e.message || "Lỗi khi tạo đề");
    } finally {
      setGenerating(false);
    }
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
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">
            Khảo thí – {blueprint.title}
          </h1>
          {blueprint.description && (
            <p className="text-sm text-slate-600">
              {blueprint.description}
            </p>
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
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm"
          >
            {generating ? "Đang tạo…" : "Tạo version mới"}
          </button>
        </div>
      </div>

      {/* VERSION LIST */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Danh sách Version</h2>
          <div className="space-y-2">
            {examVersions.map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  setSelectedExam(v);
                  loadBloomStats(v.id);
                }}
                className={`p-2 rounded border cursor-pointer ${
                  selectedExam?.id === v.id
                    ? "border-brand-600 bg-brand-50"
                    : ""
                }`}
              >
                <div className="font-medium">
                  Version {v.version_no}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(v.created_at).toLocaleString("vi-VN")}
                </div>
              </div>
            ))}
            {!examVersions.length && (
              <p className="text-xs text-slate-500">
                Chưa có version nào.
              </p>
            )}
          </div>
        </div>

        {/* VERSION DETAIL */}
        <div className="md:col-span-2 border rounded-lg p-4">
          {!selectedExam ? (
            <p className="text-slate-500">
              Chọn một version để xem chi tiết.
            </p>
          ) : (
            <>
              <div className="flex justify-between mb-3">
                <h2 className="font-semibold">
                  Version {selectedExam.version_no}
                </h2>
                <div className="flex gap-2">
                  <a
                    href={`/api/exams/${selectedExam.id}/export/question-paper`}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    Xuất đề Word
                  </a>
                  <a
                    href={`/api/exams/${selectedExam.id}/export/answer-key`}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    Xuất đáp án Word
                  </a>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="text-xs text-amber-600 mb-3">
                  {warnings.map((w, i) => (
                    <div key={i}>• {w}</div>
                  ))}
                </div>
              )}

              <BloomDonutChart data={bloomStats} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
