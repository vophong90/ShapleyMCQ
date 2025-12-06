// app/exam-blueprints/[blueprintId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  group_id: string;
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

type LloRow = {
  id: string;
  code: string | null;
  bloom_suggested: string | null;
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

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
            formatter={(value: any) => `${value.toFixed?.(1) ?? value}%`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ExamBlueprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const blueprintId = params?.blueprintId as string;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<ExamBlueprint | null>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [examItems, setExamItems] = useState<ExamItem[]>([]);
  const [bloomStats, setBloomStats] = useState<BloomStat[]>([]);

  // 1. Load blueprint & user
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
          .select("*")
          .eq("id", blueprintId)
          .single();

        if (bpErr) throw bpErr;

        const config: BlueprintConfig = data.config;
        const bp: ExamBlueprint = {
          id: data.id,
          title: data.title,
          description: data.description,
          group_id: data.group_id,
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

  const normalizedConfig = useMemo(() => {
    if (!blueprint) return null;
    const cfg = blueprint.config;
    const llos = cfg.llo_distribution || [];
    const totalWeight = llos.reduce(
      (sum, l) => sum + (l.weight_percent || 0),
      0
    );
    if (!totalWeight || !cfg.total_questions) return cfg;

    const normalized = llos.map((l, idx) => ({
      ...l,
      _raw_weight: l.weight_percent,
      weight_norm: l.weight_percent / totalWeight,
      // sẽ tính số lượng câu sau
    }));

    return { ...cfg, llo_distribution: normalized as any };
  }, [blueprint]);

  async function handleGenerateExam() {
    if (!blueprint || !normalizedConfig) return;
    setGenerating(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Chưa đăng nhập.");

      const cfg = normalizedConfig as BlueprintConfig & {
        llo_distribution: (LloDistributionConfig & {
          weight_norm: number;
        })[];
      };

      if (!cfg.course_id) {
        throw new Error("Blueprint chưa có course_id trong config.");
      }

      if (!cfg.llo_distribution?.length) {
        throw new Error("Blueprint chưa có phân bố LLO.");
      }

      const totalQuestions = cfg.total_questions;
      if (!totalQuestions || totalQuestions <= 0) {
        throw new Error("Tổng số câu trong đề (total_questions) không hợp lệ.");
      }

      const statusFilter =
        cfg.status_filter && cfg.status_filter.length
          ? cfg.status_filter
          : ["approved"];

      const includeOwn = cfg.include_sources?.own_mcq ?? true;
      const includeShared = cfg.include_sources?.shared_mcq ?? true;

      // 1. Tạo map LLO cần dùng
      const targetLloIds = cfg.llo_distribution.map((l) => l.llo_id);
      const targetLloSet = new Set(targetLloIds);

      // 2. Lấy MCQ của chính user
      const poolMap: Record<string, string[]> = {}; // llo_id -> mcq_ids

      function addToPool(mcqId: string, lloIds: string[] | null) {
        if (!lloIds) return;
        for (const llo of lloIds) {
          if (!targetLloSet.has(llo)) continue;
          if (!poolMap[llo]) poolMap[llo] = [];
          if (!poolMap[llo].includes(mcqId)) {
            poolMap[llo].push(mcqId);
          }
        }
      }

      if (includeOwn) {
        const { data: ownMcq, error: ownErr } = await supabase
          .from("mcq_items")
          .select("id, llo_ids, course_id, status")
          .eq("owner_id", user.id)
          .eq("course_id", cfg.course_id)
          .in("status", statusFilter);

        if (ownErr) throw ownErr;

        ownMcq?.forEach((row: any) => {
          addToPool(row.id, row.llo_ids ?? null);
        });
      }

      // 3. Lấy MCQ được share cho user
      if (includeShared) {
        const { data: sharedRows, error: sharedErr } = await supabase
          .from("mcq_item_shares")
          .select("mcq_items(id, llo_ids, course_id, status)")
          .eq("to_user_id", user.id)
          .eq("mcq_items.course_id", cfg.course_id)
          .in("mcq_items.status", statusFilter);

        if (sharedErr) throw sharedErr;

        sharedRows?.forEach((row: any) => {
          const mcq = row.mcq_items;
          if (!mcq) return;
          addToPool(mcq.id, mcq.llo_ids ?? null);
        });
      }

      // 4. Tính số câu cần cho từng LLO
      const countsByLlo: Record<string, number> = {};
      let assignedTotal = 0;

      cfg.llo_distribution.forEach((l, idx) => {
        if (idx === cfg.llo_distribution.length - 1) {
          // LLO cuối cùng lấy phần còn lại để tránh lệch do làm tròn
          countsByLlo[l.llo_id] = totalQuestions - assignedTotal;
        } else {
          const n = Math.floor(totalQuestions * l.weight_norm);
          countsByLlo[l.llo_id] = n;
          assignedTotal += n;
        }
      });

      // 5. Chọn câu hỏi (tránh trùng MCQ)
      const usedMcq = new Set<string>();
      const chosenItems: ExamItem[] = [];

      for (const l of cfg.llo_distribution) {
        const lloId = l.llo_id;
        const needed = countsByLlo[lloId] ?? 0;
        if (!needed) continue;

        const available = shuffleArray(poolMap[lloId] ?? []);
        let picked = 0;

        for (const mcqId of available) {
          if (picked >= needed) break;
          if (usedMcq.has(mcqId)) continue;

          usedMcq.add(mcqId);
          chosenItems.push({ mcq_item_id: mcqId, llo_id: lloId });
          picked++;
        }

        // nếu thiếu, chấp nhận thiếu – có thể log warning ở UI sau
      }

      if (!chosenItems.length) {
        throw new Error("Không tìm được câu hỏi nào phù hợp để tạo đề.");
      }

      // 6. Insert exam
      const { data: examRow, error: examErr } = await supabase
        .from("exams")
        .insert({
          blueprint_id: blueprint.id,
          owner_id: user.id,
          title: `${blueprint.title} - đề ngày ${new Date().toLocaleDateString()}`,
          course_id: cfg.course_id,
          config_snapshot: cfg,
        })
        .select("id")
        .single();

      if (examErr) throw examErr;

      const newExamId = examRow.id as string;

      // 7. Insert exam_mcq_items với order
      const examItemsPayload = chosenItems.map((item, index) => ({
        exam_id: newExamId,
        mcq_item_id: item.mcq_item_id,
        llo_id: item.llo_id,
        item_order: index + 1,
      }));

      const { error: itemsErr } = await supabase
        .from("exam_mcq_items")
        .insert(examItemsPayload);

      if (itemsErr) throw itemsErr;

      // 8. Tính Bloom stats từ LLO
      const uniqueLloIds = Array.from(
        new Set(chosenItems.map((i) => i.llo_id).filter(Boolean)) as Set<
          string
        >
      );

      const { data: lloRows, error: lloErr } = await supabase
        .from("llos")
        .select("id, code, bloom_suggested")
        .in("id", uniqueLloIds);

      if (lloErr) throw lloErr;

      const bloomByLlo = new Map<string, LloRow>();
      lloRows?.forEach((row: any) => {
        bloomByLlo.set(row.id, row);
      });

      const bloomCounts: Record<string, number> = {};
      const total = chosenItems.length;

      chosenItems.forEach((item) => {
        const llo = item.llo_id ? bloomByLlo.get(item.llo_id) : null;
        const bloom =
          llo?.bloom_suggested?.trim() ||
          (llo?.code ? `Unknown (${llo.code})` : "Unknown");
        bloomCounts[bloom] = (bloomCounts[bloom] ?? 0) + 1;
      });

      const stats: BloomStat[] = Object.entries(bloomCounts).map(
        ([bloom, count]) => ({
          bloom,
          count,
          percent: (count / total) * 100,
        })
      );

      setExamId(newExamId);
      setExamItems(chosenItems);
      setBloomStats(stats);
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

  if (error || !blueprint || !normalizedConfig) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        {error ? <p className="text-red-600">{error}</p> : null}
        {!blueprint && !error ? <p>Không tìm thấy blueprint.</p> : null}
      </div>
    );
  }

  const cfg = normalizedConfig as BlueprintConfig & {
    llo_distribution: (LloDistributionConfig & { weight_norm?: number })[];
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
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
        <button
          onClick={handleGenerateExam}
          disabled={generating}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {generating ? "Đang tạo đề..." : "Tạo đề từ Blueprint"}
        </button>
      </div>

      {/* Tóm tắt config */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Tóm tắt Blueprint</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Học phần (course_id)</div>
            <div className="font-medium">{cfg.course_id ?? "Chưa cấu hình"}</div>
          </div>
          <div>
            <div className="text-slate-500">Tổng số câu</div>
            <div className="font-medium">{cfg.total_questions}</div>
          </div>
          <div>
            <div className="text-slate-500">Nguồn MCQ sử dụng</div>
            <div className="font-medium">
              {cfg.include_sources?.own_mcq !== false
                ? "Câu của tôi"
                : null}
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
              {cfg.llo_distribution.map((l) => (
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
              ))}
            </tbody>
          </table>
        </div>
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
