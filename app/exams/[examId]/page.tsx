// app/exams/[examId]/page.tsx
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

type IrtStatus = {
  success: boolean;
  exam_id?: string;
  has_params?: boolean;
  params_count?: number;
  error?: string;
  detail?: string;
};

type SimHistoryRow = {
  id: string;
  created_at: string;
  model: string;
  n_students: number;
  k_choice: number | null;

  theta_mu: number | null;
  theta_sigma: number | null;

  theta_cut: number | null;
  raw_cut_percent: number | null;
  bin_width: number | null;

  overall_misclass: number | null;
  worstcase_misclass: number | null;
  false_pass: number | null;
  false_fail: number | null;
};

type SimHistoryResp = {
  success: boolean;
  rows?: SimHistoryRow[];
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

  // IRT status
  const [irtStatusLoading, setIrtStatusLoading] = useState(false);
  const [irtStatus, setIrtStatus] = useState<IrtStatus | null>(null);

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

  // Sim history
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<SimHistoryRow[]>([]);

  function fmtDate(s: string) {
    try {
      return new Date(s).toLocaleString("vi-VN");
    } catch {
      return s;
    }
  }

  async function fetchIrtStatus() {
    if (!examId) return;
    setIrtStatusLoading(true);
    try {
      const res = await fetch(`/api/exams/irt-status?exam_id=${examId}`);
      const json = (await res.json().catch(() => null)) as IrtStatus | null;

      if (!res.ok || !json?.success) {
        setIrtStatus({
          success: false,
          error: json?.error || "Không kiểm tra được IRT status",
          detail: json?.detail,
        });
        return;
      }

      setIrtStatus(json);
    } catch (e: any) {
      setIrtStatus({
        success: false,
        error: e?.message || "Không kiểm tra được IRT status",
      });
    } finally {
      setIrtStatusLoading(false);
    }
  }

  async function fetchSimHistory() {
    if (!examId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/exams/irt-simulations?exam_id=${examId}`);
      const json = (await res.json().catch(() => null)) as SimHistoryResp | null;

      if (!res.ok || !json?.success) {
        setHistoryError(json?.error || "Không tải được lịch sử mô phỏng");
        setHistoryRows([]);
        return;
      }

      setHistoryRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (e: any) {
      setHistoryError(e?.message || "Không tải được lịch sử mô phỏng");
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Load exam detail
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      setSim(null);
      setLabelMsg(null);
      setIrtStatus(null);
      setHistoryRows([]);
      setHistoryError(null);

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

        // ✅ check IRT params status + load history
        await fetchIrtStatus();
        await fetchSimHistory();
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Lỗi tải đề.");
      } finally {
        setLoading(false);
      }
    }

    if (examId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // ✅ refresh IRT status to enable simulate button
      await fetchIrtStatus();
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

      // ✅ refresh history list after success
      await fetchSimHistory();
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

  const hasIrtParams = !!irtStatus?.success && !!irtStatus?.has_params;

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

          {/* IRT status small line */}
          <div className="text-[11px] text-slate-500 text-right">
            {irtStatusLoading
              ? "Đang kiểm tra IRT params…"
              : irtStatus?.success
              ? hasIrtParams
                ? `IRT params: OK (${irtStatus.params_count} câu)`
                : "IRT params: CHƯA CÓ (hãy chạy GPT gán độ khó)"
              : irtStatus?.error
              ? `IRT params: lỗi (${irtStatus.error})`
              : null}
          </div>
        </div>
      </div>

      {/* IRT simulate card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">IRT mô phỏng (3PL)</h2>
          <button
            onClick={runSim}
            disabled={
              simulating ||
              items.length === 0 ||
              irtStatusLoading ||
              !hasIrtParams
            }
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {simulating ? "Đang chạy mô phỏng…" : "Chạy IRT mô phỏng"}
          </button>
        </div>

        {!hasIrtParams && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Bạn chưa có IRT params cho đề này. Hãy bấm <b>“GPT gán độ khó”</b>{" "}
            trước, rồi mới chạy mô phỏng.
          </div>
        )}

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

      {/* ✅ History card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Lịch sử mô phỏng</h2>
          <button
            onClick={fetchSimHistory}
            disabled={historyLoading}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {historyLoading ? "Đang tải…" : "Tải lại"}
          </button>
        </div>

        {historyError && (
          <div className="text-sm text-red-600">{historyError}</div>
        )}

        {historyLoading ? (
          <div className="text-sm text-slate-500">Đang tải lịch sử…</div>
        ) : historyRows.length === 0 ? (
          <div className="text-sm text-slate-600">
            Chưa có lần mô phỏng nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-t border-slate-200">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Thời điểm</th>
                  <th className="py-2 pr-4">N</th>
                  <th className="py-2 pr-4">Cut%</th>
                  <th className="py-2 pr-4">θ_cut</th>
                  <th className="py-2 pr-4">Overall%</th>
                  <th className="py-2 pr-4">Worst%</th>
                  <th className="py-2 pr-4">FP%</th>
                  <th className="py-2 pr-4">FF%</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4">{fmtDate(r.created_at)}</td>
                    <td className="py-2 pr-4">{r.n_students}</td>
                    <td className="py-2 pr-4">
                      {typeof r.raw_cut_percent === "number"
                        ? `${r.raw_cut_percent.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {typeof r.theta_cut === "number"
                        ? r.theta_cut.toFixed(2)
                        : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {typeof r.overall_misclass === "number"
                        ? `${r.overall_misclass.toFixed(2)}%`
                        : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {typeof r.worstcase_misclass === "number"
                        ? `${r.worstcase_misclass.toFixed(2)}%`
                        : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {typeof r.false_pass === "number"
                        ? `${r.false_pass.toFixed(2)}%`
                        : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {typeof r.false_fail === "number"
                        ? `${r.false_fail.toFixed(2)}%`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
