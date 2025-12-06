// app/exam-blueprints/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type BlueprintConfig = {
  course_id: string | null;
  total_questions: number;
  llo_distribution?: {
    llo_id: string;
    code?: string | null;
    weight_percent: number;
  }[];
};

type ExamBlueprintRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  config: BlueprintConfig;
};

export default function ExamBlueprintListPage() {
  const [loading, setLoading] = useState(true);
  const [blueprints, setBlueprints] = useState<ExamBlueprintRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
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
          .select("id, title, description, created_at, config")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (bpErr) throw bpErr;

        setBlueprints((data || []) as ExamBlueprintRow[]);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Không tải được danh sách blueprint.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6 px-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Khảo thí</h1>
          <p className="text-sm text-slate-600 mt-1">
            Xem và sử dụng các Blueprint để tạo đề thi từ ngân hàng MCQ (cả câu của bạn và câu được chia sẻ).
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải blueprint...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : blueprints.length === 0 ? (
        <p className="text-sm text-slate-500">
          Chưa có Blueprint nào. Sau khi bạn tạo Blueprint (ví dụ qua trang cấu hình riêng),
          chúng sẽ xuất hiện ở đây.
        </p>
      ) : (
        <div className="space-y-3">
          {blueprints.map((bp) => {
            const cfg = bp.config || { course_id: null, total_questions: 0 };
            const lloCount = cfg.llo_distribution?.length ?? 0;

            return (
              <Link
                key={bp.id}
                href={`/exam-blueprints/${bp.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {bp.title}
                    </h2>
                    {bp.description && (
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                        {bp.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        Học phần:{" "}
                        <span className="font-medium text-slate-700">
                          {cfg.course_id ?? "Chưa cấu hình"}
                        </span>
                      </span>
                      <span>
                        Tổng số câu:{" "}
                        <span className="font-medium text-slate-700">
                          {cfg.total_questions}
                        </span>
                      </span>
                      <span>
                        Số LLO trong blueprint:{" "}
                        <span className="font-medium text-slate-700">
                          {lloCount}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div>
                      {new Date(bp.created_at).toLocaleString("vi-VN")}
                    </div>
                    <div className="mt-1 inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                      Click để mở Khảo thí
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
