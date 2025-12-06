// app/exam-blueprints/[blueprintId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

type BloomStat = {
  bloom: string;
  count: number;
  percent: number;
};

type ExamItem = {
  mcq_item_id: string;
  llo_id: string | null;
};

const BLOOM_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#6366f1",
  "#f97316",
  "#e11d48",
  "#a855f7",
  "#64748b",
];

function BloomDonutChart({ data }: { data: BloomStat[] }) {
  if (!data.length) return null;

  return (
    <div className="w-full h-80">
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
            {data.map((entry, index) => (
              <Cell
                key={`cell-${entry.bloom}-${index}`}
                fill={BLOOM_COLORS[index % BLOOM_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any) => `${value?.toFixed?.(1) ?? value}%`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ExamBlueprintDetailPage() {
  const params = useParams();
  const blueprintId = params?.blueprintId as string;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<ExamBlueprint | null>(null);

  const [examId, setExamId] = useState<string | null>(null);
  const [examItems, setExamItems] = useState<ExamItem[]>([]);
  const [bloomStats, setBloomStats] = useState<BloomStat[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // 1. Load blueprint
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          setError("Bạn cần đăng nhập để sử dụng Khảo thí.");
          setLoading(false);
          return;
        }

        const { data, error: bpErr } = await supabase
          .from("exam_blueprints")
          .select("id, title, description, owner_id, config")
          .eq("id", blueprintId)
          .single();

        if (bpErr || !data) {
          throw bpErr || new Error("Không tìm thấy blueprint.");
        }

        const config = (data.config || {
          course_id: null,
          total_questions: 0,
          llo_distribution: [],
        }) as BlueprintConfig;

        const bp: ExamBlueprint = {
          id: data.id,
          title: data.title,
          description: data.description,
          owner_id: data.owner_id,
          config,
        };
        setBlueprint(bp);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Không tải được blueprint.");
      } finally {
        setLoading(false);
      }
    }

    if (blueprintId) {
      loadData();
    }
  }, [blueprintId]);

  async function handleGenerateExam() {
    if (!blueprint) return;
    setGenerating(true);
    setError(null);
    setWarnings([]);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Chưa đăng nhập.");

      const res = await fetch("/api/exams/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.id}`,
        },
        body: JSON.stringify({ blueprint_id: blueprint.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi khi tạo đề thi (API).");
      }

      setExamId(data.exam_id || null);
      setExamItems((data.items || []) as ExamItem[]);
      setBloomStats((data.bloom_stats || []) as BloomStat[]);
      setWarnings((data.warnings || []) as string[]);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Lỗi khi tạo đề thi.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <p>Đang tải blueprint...</p>
      </div>
    );
  }

  if (error && !blueprint) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <p>Không tìm thấy blueprint.</p>
      </div>
    );
  }

  const cfg = blueprint.config;
  const hasLlo = (cfg.llo_distribution || []).length > 0;
  const hasTotalQuestions = (cfg.total_questions || 0) > 0;
  const canGenerate = hasLlo && hasTotalQuestions;

  const configNotice: string | null = !hasTotalQuestions
    ? "Blueprint chưa cấu hình tổng số câu. Hãy vào 'Cấu hình Blueprint' để thiết lập."
    : !hasLlo
    ? "Blueprint chưa gán LLO và % phân bổ. Hãy vào 'Cấu hình Blueprint' để thiết lập."
    : null;

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8 px-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Khảo thí – {blueprint.title}
          </h1>
          {blueprint.description && (
            <p className="text-sm text-slate-600 mt-1">
              {blueprint.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            {/* Nút mở trang cấu hình */}
            <Link
              href={`/exam-blueprints/${blueprint.id}/config`}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cấu hình Blueprint
            </Link>

            {/* Nút tạo đề */}
            <button
              onClick={handleGenerateExam}
              disabled={!canGenerate || generating}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {generating ? "Đang tạo đề..." : "Tạo đề từ Blueprint"}
            </button>
          </div>

          {/* Thông báo nếu chưa config đủ để generate */}
          {configNotice && (
            <p className="text-[11px] text-amber-600 text-right">
              {configNotice}
            </p>
          )}
        </div>
      </div>

      {/* Tóm tắt config */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Tóm tắt Blueprint</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Học phần (course_id)</div>
            <div className="font-medium">
              {cfg.course_id ?? "Chưa cấu hình"}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Tổng số câu</div>
            <div className="font-medium">{cfg.total_questions}</div>
          </div>
          <div>
            <div className="text-slate-500">Nguồn MCQ sử dụng</div>
            <div className="font-medium">
              {cfg.include_sources?.own_mcq !== false ? "Câu của tôi" : null}
              {cfg.include_sources?.shared_mcq !== false
                ? (cfg.include_sources?.own_mcq !== false ? " + " : "") +
                  "Câu được share"
                : cfg.include_sources?.own_mcq === false
                ? "Không có"
                : ""}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm border-t border-slate-200">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-4">LLO</th>
                <th className="py-2 pr-4">% đóng góp</th>
              </tr>
            </thead>
            <tbody>
              {(cfg.llo_distribution || []).length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="py-3 text-xs text-slate-500 italic"
                  >
                    Chưa có LLO nào được chọn trong blueprint.
                  </td>
                </tr>
              ) : (
                cfg.llo_distribution.map((l) => (
                  <tr key={l.llo_id} className="border-t border-slate-100">
                    <td className="py-2 pr-4">
                      <span className="font-medium">
                        {l.code || l.llo_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {l.weight_percent.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {warnings.length > 0 && (
          <div className="mt-3 text-xs text-amber-600 space-y-1">
            {warnings.map((w, i) => (
              <div key={i}>• {w}</div>
            ))}
          </div>
        )}
      </div>

      {/* Kết quả đề & Bloom stats */}
      {examId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Đề thi đã tạo (Exam ID: {examId.slice(0, 8)}…)
            </h2>
            <div className="text-sm text-slate-600">
              Tổng số câu:{" "}
              <span className="font-semibold">{examItems.length}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Bảng Bloom */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Phân bố mức Bloom (theo LLO)
              </h3>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Mức Bloom</th>
                    <th className="py-2 pr-4">Số câu</th>
                    <th className="py-2 pr-4">% trong đề</th>
                  </tr>
                </thead>
                <tbody>
                  {bloomStats.map((row) => (
                    <tr
                      key={row.bloom}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4">{row.bloom}</td>
                      <td className="py-2 pr-4">{row.count}</td>
                      <td className="py-2 pr-4">
                        {row.percent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Donut chart */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Biểu đồ donut Bloom
              </h3>
              <BloomDonutChart data={bloomStats} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
