"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import Sparkline from "@/components/charts/Sparkline";
import BarMini from "@/components/charts/BarMini";
import DonutMini from "@/components/charts/DonutMini";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1) Lấy access_token từ Supabase client
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("Không có session Supabase");
        setLoading(false);
        return;
      }

      const accessToken = session.access_token;

      // 2) Gửi token lên API /auth/session để lấy user_id
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

      const statsJson = await res1.json();

      // 4) Lấy PROJECTS
      const res2 = await fetch("/api/dashboard/projects?page=1&limit=5", {
        headers: { Authorization: userHeader },
      });

      const projJson = await res2.json();

      setStats(statsJson);
      setProjects(projJson.items ?? []);   // items mới đúng!
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return <p className="p-4 text-slate-500">Đang tải Dashboard…</p>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* ======= HÀNG KPI ========= */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Học phần" value={stats.courseCount} />
        <KpiCard label="Bài học" value={stats.lessonCount} />
        <KpiCard
          label="LLO"
          value={stats.lloCount}
          chart={<BarMini data={stats.bloomLlo} />}
        />
        <KpiCard label="Assessment Units" value={stats.auCount} />
        <KpiCard label="Misconceptions" value={stats.misCount} />
        <KpiCard
          label="MCQ Items"
          value={stats.mcqCount}
          chart={<Sparkline data={stats.sparklineMcq} />}
        />
      </div>

      {/* ======= HÀNG MODULES ========= */}
      <div className="grid md:grid-cols-3 gap-4">
        <ModuleCard
          title="1. LLO & Context"
          desc="Quản lý LLO, Bloom, lesson mapping"
          href="/wizard/context"
          chart={<BarMini data={stats.bloomLlo} />}
        />

        <ModuleCard
          title="2. AU & Misconceptions"
          desc="Quản lý Assessment Units và Misconceptions"
          href="/wizard/au"
        />

        <ModuleCard
          title="3. MCQ Bank"
          desc="Sinh MCQ, đánh giá NBME/USMLE, Shapley"
          href="/wizard/mcq"
          chart={<DonutMini data={stats.bloomMcq} />}
        />
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
                      {new Date(p.updated_at).toLocaleDateString("vi-VN")}
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
    <div className="bg-white rounded-xl p-4 border shadow-sm">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-slate-600 mb-2">{desc}</p>

      {chart && <div className="mb-3">{chart}</div>}

      <a
        href={href}
        className="inline-block px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white"
      >
        Mở →
      </a>
    </div>
  );
}
