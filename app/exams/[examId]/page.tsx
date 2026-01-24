"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Exam = {
  id: string;
  title: string;
  created_at?: string;
};

type ExamItem = {
  item_order: number;
  mcq_item_id: string;
  llo_id?: string | null;
  stem: string;
  options: any[];
};

type SimResult = {
  success: boolean;
  sim_id?: string;
  J?: number;
  raw_cut?: number;
  raw_cut_percent?: number;
  overall_misclass?: number;
  worstcase_misclass?: number;
  false_pass?: number;
  false_fail?: number;
  worstcase_bin?: {
    theta_cut: number;
    bin_width: number;
    n_in_bin: number;
  };
  error?: string;
  detail?: string;
};

export default function ExamPreviewPage() {
  const params = useParams();
  const examId = params?.examId as string;

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<Exam | null>(null);
  const [items, setItems] = useState<ExamItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // GPT labeling UI
  const [judgeMode, setJudgeMode] = useState<"strict" | "normal" | "lenient">(
    "normal"
  );
  const [labeling, setLabeling] = useState(false);
  const [labelMsg, setLabelMsg] = useState<string | null>(null);

  // IRT simulate UI
  const [simulating, setSimulating] = useState(false);
  const [sim, setSim] = useState<SimResult | null>(null);

  // Sim params
  const [nStudents, setNStudents] = useState(5000);
  const [rawCutPercent, setRawCutPercent] = useState(0.6);
  const [thetaCut, setThetaCut] = useState(0);
  const [thetaMu, setThetaMu] = useState(0);
  const [thetaSigma, setThetaSigma] = useState(1);
  const [binWidth, setBinWidth] = useState(0.25);

  // Load exam detail
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      setSim(null);
      setLabelMsg(null);

      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!user) {
          setError("Bạn cần đăng nhập để xem đề.");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/exams/detail?exam_id=${examId}`);
        const json = await res.json();

        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Không tải được đề.");
        }

        setExam(json.exam as Exam);
        setItems((json.items || []) as ExamItem[]);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Lỗi tải đề.");
      } finally {
        setLoading(false);
      }
    }

    if (examId) load();
  }, [examId, supabase]);

  async function runGptLabel() {
    setLabeling(true);
    setLabelMsg(null);
    try {
      const res = await fetch("/api/exams/irt-label-by-gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          judge_mode: judgeMode,
          k_choice: 4,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || json?.detail || "GPT labeling failed");
      }

      setLabelMsg(
        `Đã gán độ khó xong cho ${json.saved} câu (judge_mode: ${json.judge_mode}).`
      );
    } catch (e: any) {
      console.error(e);
      setLabelMsg("Lỗi: " + (e?.message || "GPT labeling failed"));
    } finally {
      setLabeling(false);
    }
  }

  async function runSim() {
    setSimulating(true);
    setSim(null);
    try {
      const res = await fetch("/api/exams/irt-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          n_students: nStudents,
          raw_cut_percent: rawCutPercent,
          theta_cut: thetaCut,
          theta_mu: thetaMu,
          theta_sigma: thetaSigma,
          bin_width: binWidth,
          k_choice: 4,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || json?.detail || "IRT simulate failed");
      }

      setSim(json as SimResult);
    } catch (e: any) {
      console.error(e);
      setSim({
        success: false,
        error: e?.message || "IRT simulate failed",
      });
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-10 px-4">
        <p>Đang tải đề thi…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-10 px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Xem đề thi — {exam?.title || examId.slice(0, 8)}
          </h1>
          <div className="text-sm text-slate-600 mt-1">
            Tổng số câu: <span className="font-semibold">{items.length}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* GPT labeling */}
          <div className="flex items-center gap-2">
            <select
              value={judgeMode}
              onChange={(e) => setJudgeMode(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm"
              disabled={labeling}
            >
              <option value="lenient">Giám khảo dễ</option>
              <option value="normal">Giám khảo vừa</option>
              <option value="strict">Giám khảo khó</option>
            </select>

            <button
              onClick={runGptLabel}
              disabled={labeling || items.length === 0}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {labeling ? "Đang gán độ khó…" : "GPT gán độ khó"}
            </button>
          </div>

          {labelMsg && (
            <div className="text-xs text-slate-600 max-w-sm text-right">
              {labelMsg}
            </div>
          )}
        </div>
      </div>

      {/* IRT simulate card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">IRT mô phỏng (3PL)</h2>
          <button
            onClick={runSim}
            disabled={simulating || items.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {simulating ? "Đang chạy mô phỏng…" : "Chạy IRT mô phỏng"}
          </button>
        </div>

        {/* Params */}
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <label className="space-y-1">
            <div className="text-slate-500">Số thí sinh ảo</div>
            <input
              type="number"
              value={nStudents}
              onChange={(e) => setNStudents(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </label>

          <label className="space-y-1">
            <div className="text-slate-500">Ngưỡng đậu (điểm thô %)</div>
            <input
              type="number"
              step="0.01"
              value={rawCutPercent}
              onChange={(e) => setRawCutPercent(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </label>

          <label className="space-y-1">
            <div className="text-slate-500">Chuẩn thật θ_cut</div>
            <input
              type="number"
              step="0.1"
              value={thetaCut}
              onChange={(e) => setThetaCut(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </label>

          <label className="space-y-1">
            <div className="text-slate-500">θ ~ N(μ, σ) — μ</div>
            <input
              type="number"
              step="0.1"
              value={thetaMu}
              onChange={(e) => setThetaMu(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </label>

          <label className="space-y-1">
            <div className="text-slate-500">θ ~ N(μ, σ) — σ</div>
            <input
              type="number"
              step="0.1"
              value={thetaSigma}
              onChange={(e) => setThetaSigma(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </label>

          <label className="space-y-1">
            <div className="text-slate-500">Worst-case bin width</div>
            <input
              type="number"
              step="0.05"
              value={binWidth}
              onChange={(e) => setBinWidth(Number(e.target.value))}
              className="border rounded-lg p-2 w-full"
            />
          </label>
        </div>

        {/* Results */}
        {sim && (
          <div className="border-t pt-4 text-sm space-y-2">
            {sim.success ? (
              <>
                <div className="font-medium">Kết quả mô phỏng:</div>
                <div className="grid md:grid-cols-2 gap-2">
                  <div>
                    • Overall misclass:{" "}
                    <span className="font-semibold">
                      {sim.overall_misclass?.toFixed?.(2)}%
                    </span>
                  </div>
                  <div>
                    • Worst-case misclass (quanh θ_cut):{" "}
                    <span className="font-semibold">
                      {sim.worstcase_misclass?.toFixed?.(2)}%
                    </span>
                  </div>
                  <div>
                    • False pass (đậu sai):{" "}
                    <span className="font-semibold">
                      {sim.false_pass?.toFixed?.(2)}%
                    </span>
                  </div>
                  <div>
                    • False fail (rớt oan):{" "}
                    <span className="font-semibold">
                      {sim.false_fail?.toFixed?.(2)}%
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 mt-2">
                  Raw cut = {sim.raw_cut} / {sim.J} câu đúng (raw_cut_percent ={" "}
                  {sim.raw_cut_percent})
                  {sim.worstcase_bin ? (
                    <>
                      {" "}
                      — Worst-case bin: θ ∈ [{sim.worstcase_bin.theta_cut} ±{" "}
                      {sim.worstcase_bin.bin_width / 2}], n_in_bin ={" "}
                      {sim.worstcase_bin.n_in_bin}
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="text-red-600">
                {sim.error || sim.detail || "Chạy mô phỏng thất bại"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exam items */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Nội dung đề</h2>

        {items.length === 0 ? (
          <p className="text-sm text-slate-600">Đề chưa có câu hỏi.</p>
        ) : (
          items.map((it) => (
            <div
              key={it.mcq_item_id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="text-sm text-slate-500 mb-2">
                Câu {it.item_order}
              </div>

              <div className="text-base font-medium whitespace-pre-wrap">
                {it.stem}
              </div>

              <div className="mt-3 space-y-2">
                {(Array.isArray(it.options) ? it.options : []).map(
                  (op: any, idx: number) => {
                    const label =
                      typeof op?.label === "string"
                        ? op.label
                        : String.fromCharCode(65 + idx);
                    const text =
                      typeof op?.text === "string" ? op.text : String(op ?? "");
                    return (
                      <div
                        key={idx}
                        className="text-sm rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <span className="font-semibold mr-2">{label}.</span>
                        <span className="whitespace-pre-wrap">{text}</span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
