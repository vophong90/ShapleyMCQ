"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import Sparkline from "@/components/charts/Sparkline";
import BarMini from "@/components/charts/BarMini";
import DonutMini from "@/components/charts/DonutMini";

type DashboardStats = {
  courseCount: number;
  lessonCount: number;
  lloCount: number;
  auCount: number;
  misCount: number;
  mcqCount: number;
  bloomLlo?: any;
  bloomMcq?: any;
  sparklineMcq?: any;
  // nếu API còn field khác thì cứ giữ nguyên, ở đây chỉ khai báo tối thiểu
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1) Lấy access_token từ Supabase client
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("Không có session Supabase");
        setLoading(false);
        return;
      }

      const accessToken = session.access_token;

      // 2) Gửi token lên API /auth/session để lấy user_id (qua header Authorization)
      const r = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!r.ok) {
        console.error("Auth session lỗi");
        setLoading(false);
        return;
      }

      // API trả về userId dưới dạng header Authorization: Bearer <user_id>
      const userHeader = r.headers.get("Authorization") ?? "";

      // 3) Lấy STATS
      const res1 = await fetch("/api/dashboard/stats", {
        headers: { Authorization: userHeader },
      });

      const statsJson = await res1.json().catch(() => null);

      // 4) Lấy PROJECTS
      const res2 = await fetch("/api/dashboard/projects?page=1&limit=5", {
        headers: { Authorization: userHeader },
      });

      const projJson = await res2.json().catch(() => null);

      setStats(statsJson || null);
      setProjects(projJson?.items ?? []);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return <p className="p-4 text-slate-500">Đang tải Dashboard…</p>;
  }

  // Fallback an toàn nếu stats null
  const safeStats: DashboardStats = {
    courseCount: stats?.courseCount ?? 0,
    lessonCount: stats?.lessonCount ?? 0,
    lloCount: stats?.lloCount ?? 0,
    auCount: stats?.auCount ?? 0,
    misCount: stats?.misCount ?? 0,
    mcqCount: stats?.mcqCount ?? 0,
    bloomLlo: stats?.bloomLlo,
    bloomMcq: stats?.bloomMcq,
    sparklineMcq: stats?.sparklineMcq,
  };

  const hasBloomLlo =
    Array.isArray(safeStats.bloomLlo) && safeStats.bloomLlo.length > 0;
  const hasBloomMcq =
    Array.isArray(safeStats.bloomMcq) && safeStats.bloomMcq.length > 0;
  const hasSparklineMcq =
    Array.isArray(safeStats.sparklineMcq) &&
    safeStats.sparklineMcq.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* ======= HÀNG KPI ========= */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Học phần" value={safeStats.courseCount} />
        <KpiCard label="Bài học" value={safeStats.lessonCount} />
        <KpiCard
          label="LLO"
          value={safeStats.lloCount}
          chart={hasBloomLlo ? <BarMini data={safeStats.bloomLlo} /> : undefined}
        />
        <KpiCard label="Assessment Units" value={safeStats.auCount} />
        <KpiCard label="Misconceptions" value={safeStats.misCount} />
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

      {/* ======= HÀNG MODULES – 5 BƯỚC WIZARD ========= */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Quy trình 5 bước xây dựng ngân hàng MCQ
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Mỗi bước hoạt động độc lập – bạn có thể vào bất cứ bước nào, bất cứ
          lúc nào.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Bước 1 */}
          <ModuleCard
            title="Bước 1. Context & LLO"
            desc="Thiết lập học phần, bài học và LLO; gắn Bloom, level, bối cảnh."
            href="/wizard/context"
            chart={
              hasBloomLlo ? <BarMini data={safeStats.bloomLlo} /> : undefined
            }
          />

          {/* Bước 2 */}
          <ModuleCard
            title="Bước 2. Assessment Units"
            desc="Sinh và quản lý Assessment Units từ LLO, chuẩn bị nền cho Mis & MCQ."
            href="/wizard/au"
          />

          {/* Bước 3 */}
          <ModuleCard
            title="Bước 3. Misconceptions"
            desc="Sinh Misconceptions từ AU bằng GPT, duyệt và quản lý lỗi nhận thức."
            href="/wizard/misconcepts"
          />

          {/* Bước 4 */}
          <ModuleCard
            title="Bước 4. MCQ Generator"
            desc="Sinh bộ câu hỏi MCQ từ AU + Mis đã duyệt; thiết kế theo blueprint."
            href="/wizard/mcq"
            chart={
              hasBloomMcq ? <DonutMini data={safeStats.bloomMcq} /> : undefined
            }
          />

          {/* Bước 5 */}
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
  chart?: React.ReactNode;
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
  chart?: React.ReactNode;
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
