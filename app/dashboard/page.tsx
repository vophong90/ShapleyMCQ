// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

import Sparkline from "@/components/charts/Sparkline";
import BarMini from "@/components/charts/BarMini";
import DonutMini from "@/components/charts/DonutMini";

/* ===============================
   TYPES
================================ */
type DashboardStats = {
  courseCount: number;
  lessonCount: number;
  lloCount: number;
  auCount: number;
  misCount: number;
  mcqCount: number;

  bloomLlo?: any[];
  bloomAu?: any[];
  bloomMcq?: any[];

  sparklineMcq?: any[];
  sparklineCourses?: any[];
  sparklineLessons?: any[];
  sparklineMis?: any[];
};

type ProjectRow = {
  id: string;
  title: string;
  progress?: number | null;
  updated_at?: string | null;
  courses?: { title?: string | null } | null;
  lessons?: { title?: string | null } | null;
};

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function getUserHeaderFromSession(): Promise<string | null> {
      const { data, error } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (error || !userId) return null;
      return `Bearer ${userId}`;
    }

    async function load() {
      try {
        setLoading(true);

        const userHeader = await getUserHeaderFromSession();
        if (!userHeader) {
          if (!alive) return;
          setStats(null);
          setProjects([]);
          return;
        }

        const [resStats, resProjects] = await Promise.all([
          fetch("/api/dashboard/stats", {
            headers: { Authorization: userHeader },
          }),
          fetch("/api/dashboard/projects?page=1&limit=5", {
            headers: { Authorization: userHeader },
          }),
        ]);

        const statsJson = await resStats.json().catch(() => null);
        const projJson = await resProjects.json().catch(() => null);

        if (!alive) return;

        setStats(statsJson || null);
        setProjects((projJson?.items ?? []) as ProjectRow[]);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setStats(null);
        setProjects([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [supabase]);

  if (loading) {
    return <p className="p-4 text-slate-500">Đang tải Dashboard…</p>;
  }

  const safeStats: DashboardStats = {
    courseCount: stats?.courseCount ?? 0,
    lessonCount: stats?.lessonCount ?? 0,
    lloCount: stats?.lloCount ?? 0,
    auCount: stats?.auCount ?? 0,
    misCount: stats?.misCount ?? 0,
    mcqCount: stats?.mcqCount ?? 0,

    bloomLlo: stats?.bloomLlo,
    bloomAu: stats?.bloomAu,
    bloomMcq: stats?.bloomMcq,

    sparklineMcq: stats?.sparklineMcq,
    sparklineCourses: stats?.sparklineCourses,
    sparklineLessons: stats?.sparklineLessons,
    sparklineMis: stats?.sparklineMis,
  };

  const hasBloomLlo =
    Array.isArray(safeStats.bloomLlo) && safeStats.bloomLlo.length > 0;
  const hasBloomAu =
    Array.isArray(safeStats.bloomAu) && safeStats.bloomAu.length > 0;
  const hasBloomMcq =
    Array.isArray(safeStats.bloomMcq) && safeStats.bloomMcq.length > 0;

  const hasSparklineMcq =
    Array.isArray(safeStats.sparklineMcq) &&
    safeStats.sparklineMcq.length > 0;
  const hasSparklineCourses =
    Array.isArray(safeStats.sparklineCourses) &&
    safeStats.sparklineCourses.length > 0;
  const hasSparklineLessons =
    Array.isArray(safeStats.sparklineLessons) &&
    safeStats.sparklineLessons.length > 0;
  const hasSparklineMis =
    Array.isArray(safeStats.sparklineMis) &&
    safeStats.sparklineMis.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* ======= KPI ========= */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          label="Học phần"
          value={safeStats.courseCount}
          chart={
            hasSparklineCourses ? (
              <Sparkline data={safeStats.sparklineCourses} />
            ) : undefined
          }
        />

        <KpiCard
          label="Bài học"
          value={safeStats.lessonCount}
          chart={
            hasSparklineLessons ? (
              <Sparkline data={safeStats.sparklineLessons} />
            ) : undefined
          }
        />

        <KpiCard
          label="LLO"
          value={safeStats.lloCount}
          chart={hasBloomLlo ? <BarMini data={safeStats.bloomLlo} /> : undefined}
        />

        <KpiCard
          label="Assessment Units"
          value={safeStats.auCount}
          chart={hasBloomAu ? <BarMini data={safeStats.bloomAu} /> : undefined}
        />

        <KpiCard
          label="Misconceptions"
          value={safeStats.misCount}
          chart={
            hasSparklineMis ? (
              <Sparkline data={safeStats.sparklineMis} />
            ) : undefined
          }
        />

        <KpiCard
          label="MCQ Items"
          value={safeStats.mcqCount}
          chart={
            hasSparklineMcq ? (
              <Sparkline data={safeStats.sparklineMcq} />
            ) : undefined
          }
        />
      </div>

      {/* ======= MODULES – 5 BƯỚC WIZARD ========= */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Quy trình 5 bước xây dựng ngân hàng MCQ
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Mỗi bước hoạt động độc lập – bạn có thể vào bất cứ bước nào, bất cứ lúc
          nào.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          <ModuleCard
            title="Bước 1. Context & LLO"
            desc="Thiết lập học phần, bài học và LLO; gắn Bloom, level, bối cảnh."
            href="/wizard/context"
            chart={hasBloomLlo ? <BarMini data={safeStats.bloomLlo} /> : undefined}
          />

          <ModuleCard
            title="Bước 2. Assessment Units"
            desc="Sinh và quản lý Assessment Units từ LLO, chuẩn bị nền cho Mis & MCQ."
            href="/wizard/au"
            chart={hasBloomAu ? <BarMini data={safeStats.bloomAu} /> : undefined}
          />

          <ModuleCard
            title="Bước 3. Misconceptions"
            desc="Sinh Misconceptions từ AU bằng GPT, duyệt và quản lý lỗi nhận thức."
            href="/wizard/misconcepts"
            chart={
              hasSparklineMis ? (
                <Sparkline data={safeStats.sparklineMis} />
              ) : undefined
            }
          />

          <ModuleCard
            title="Bước 4. MCQ Generator"
            desc="Sinh bộ câu hỏi MCQ từ AU + Mis đã duyệt; thiết kế theo blueprint."
            href="/wizard/mcq"
            chart={
              hasBloomMcq ? (
                <DonutMini data={safeStats.bloomMcq} />
              ) : undefined
            }
          />

          <ModuleCard
            title="Bước 5. MCQ Analysis"
            desc="Phân tích bộ đề: độ khó, phân biệt, distrator, Shapley... (đang phát triển)."
            href="/wizard/simulate"
            chart={
              hasSparklineMcq ? (
                <Sparkline data={safeStats.sparklineMcq} />
              ) : undefined
            }
          />
        </div>
      </div>

      {/* ======= PROJECTS ========= */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Các dự án MCQ gần đây
        </h2>

        <div className="bg-white border rounded-xl p-4">
          {projects.length === 0 ? (
            <p className="text-slate-500 text-sm">Chưa có dự án nào.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Tên dự án</th>
                  <th className="py-2">Course</th>
                  <th className="py-2">Lesson</th>
                  <th className="py-2">Tiến độ</th>
                  <th className="py-2">Cập nhật</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.title}</td>
                    <td className="py-2">{p.courses?.title ?? "-"}</td>
                    <td className="py-2">{p.lessons?.title ?? "-"}</td>
                    <td className="py-2">{p.progress ?? 0}%</td>
                    <td className="py-2">
                      {p.updated_at
                        ? new Date(p.updated_at).toLocaleDateString("vi-VN")
                        : "-"}
                    </td>
                    <td className="py-2">
                      <a
                        href={`/wizard/project/${p.id}`}
                        className="text-brand-600 hover:underline"
                      >
                        Tiếp tục →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================================
   COMPONENTS
======================================= */

function KpiCard({
  label,
  value,
  chart,
}: {
  label: string;
  value: number;
  chart?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {chart && <div className="mt-2">{chart}</div>}
    </div>
  );
}

function ModuleCard({
  title,
  desc,
  href,
  chart,
}: {
  title: string;
  desc: string;
  href: string;
  chart?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        <p className="text-xs text-slate-600 mb-3">{desc}</p>
        {chart && <div className="mb-3">{chart}</div>}
      </div>

      <a
        href={href}
        className="inline-block mt-1 px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white"
      >
        Mở →
      </a>
    </div>
  );
}
