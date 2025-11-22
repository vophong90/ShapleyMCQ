"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MCQListItem = {
  id: string;
  stem: string;
  correct_answer: string;
};

type MCQDetail = {
  id: string;
  stem: string;
  correct_answer: string;
  explanation: string | null;
  distractors: string[];
};

type SimOption = {
  label: string;   // A, B, C, D
  text: string;
  is_correct: boolean;
};

type PersonaProb = {
  name: string;
  probs: Record<string, number>; // { A: 0.9, B: ... }
};

type AccuracyRow = {
  persona: string;
  accuracy: number;
  total: number;
};

type ResponseRow = {
  persona: string;
  chosen_option: string; // A, B, C, D
  chosen_text: string;
  is_correct: boolean;
};

type SimResult = {
  options: SimOption[];
  personas: PersonaProb[];
  N_per_persona: number;
  accuracy_summary: AccuracyRow[];
  response_matrix: ResponseRow[];
};

type ShapleyRow = {
  label: string;
  text: string;
  shapley: number;       // tổng = 1
  share_pct: number;     // %
  wrong_pct: number;     // % tất cả responses
  novice_pct: number;    // % chọn distractor này trong nhóm Novice+Weak
  recommendation: string;
};

export default function SimulatePage() {
  const [mcqs, setMcqs] = useState<MCQListItem[]>([]);
  const [selected, setSelected] = useState<MCQDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [shapleyRows, setShapleyRows] = useState<ShapleyRow[] | null>(null);

  useEffect(() => {
    loadMCQs();
  }, []);

  async function loadMCQs() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("mcq_items")
      .select("id, stem, correct_answer")
      .order("created_at", { ascending: false });

    setLoadingList(false);

    if (!error && data) {
      setMcqs(data);
    }
  }

  async function chooseMCQ(item: MCQListItem) {
    // load chi tiết + options
    const { data: itemData } = await supabase
      .from("mcq_items")
      .select("id, stem, correct_answer, explanation")
      .eq("id", item.id)
      .single();

    const { data: optData } = await supabase
      .from("mcq_options")
      .select("text, is_correct")
      .eq("mcq_id", item.id);

    const distractors =
      optData?.filter((o: any) => !o.is_correct).map((o: any) => o.text) || [];

    setSelected({
      id: item.id,
      stem: itemData?.stem || "",
      correct_answer: itemData?.correct_answer || "",
      explanation: itemData?.explanation || "",
      distractors
    });

    setSimResult(null);
    setShapleyRows(null);
  }

  async function runSimulation() {
    if (!selected) return;

    setSimLoading(true);
    setSimResult(null);
    setShapleyRows(null);

    const res = await fetch("/api/mcqs/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: selected.stem,
        correct_answer: selected.correct_answer,
        distractors: selected.distractors,
        explanation: selected.explanation,
        N: 1200
      })
    });

    const json = await res.json();
    setSimLoading(false);

    if (json.error) {
      alert(json.error);
      return;
    }

    setSimResult(json);
    const shap = computeShapleyFromSim(json);
    setShapleyRows(shap);
  }

  // ------------------------
  // STEP 7: SHAPLEY ANALYSIS
  // ------------------------

  function computeShapleyFromSim(sim: SimResult): ShapleyRow[] {
    const distractorLabels = sim.options
      .filter((o) => !o.is_correct)
      .map((o) => o.label);

    // Đảm bảo thứ tự B, C, D
    const orderedLabels = ["B", "C", "D"].filter((l) =>
      distractorLabels.includes(l)
    );

    // Đếm số câu sai theo từng distractor
    const wrongCounts: Record<string, number> = {};
    const wrongCountsNovice: Record<string, number> = {};

    const lowAbility = new Set(["Novice", "Weak"]);

    let totalWrongAll = 0;
    let totalWrongLow = 0;

    for (const row of sim.response_matrix) {
      if (!row.is_correct) {
        totalWrongAll++;
        if (!wrongCounts[row.chosen_option]) wrongCounts[row.chosen_option] = 0;
        wrongCounts[row.chosen_option]++;

        if (lowAbility.has(row.persona)) {
          totalWrongLow++;
          if (!wrongCountsNovice[row.chosen_option])
            wrongCountsNovice[row.chosen_option] = 0;
          wrongCountsNovice[row.chosen_option]++;
        }
      }
    }

    if (totalWrongAll === 0) {
      // item quá dễ, không có dữ liệu để đánh giá distractor
      return orderedLabels.map((label) => {
        const opt = sim.options.find((o) => o.label === label)!;
        return {
          label,
          text: opt.text,
          shapley: 0,
          share_pct: 0,
          wrong_pct: 0,
          novice_pct: 0,
          recommendation:
            "Item quá dễ, hầu hết người học trả lời đúng – khó đánh giá distractor."
        };
      });
    }

    const n = orderedLabels.length; // 3
    const countsArr = orderedLabels.map((l) => wrongCounts[l] || 0);

    // value function v(S): tỉ lệ câu sai do distractors trong S / tổng sai
    function v(subset: Set<number>): number {
      let sum = 0;
      subset.forEach((idx) => {
        sum += countsArr[idx];
      });
      return sum / totalWrongAll;
    }

    // tạo tất cả hoán vị của [0..n-1]
    function permutations(arr: number[]): number[][] {
      if (arr.length <= 1) return [arr];
      const result: number[][] = [];
      const [first, ...rest] = arr;
      const perms = permutations(rest);
      for (const p of perms) {
        for (let i = 0; i <= p.length; i++) {
          const copy = [...p];
          copy.splice(i, 0, first);
          result.push(copy);
        }
      }
      return result;
    }

    const perms = permutations([...Array(n).keys()]);
    const shapleyArr = new Array(n).fill(0);

    for (const perm of perms) {
      const S = new Set<number>();
      for (const j of perm) {
        const before = v(S);
        S.add(j);
        const after = v(S);
        const delta = after - before;
        shapleyArr[j] += delta;
      }
    }

    // trung bình theo n! hoán vị
    const factor = 1 / perms.length;
    for (let i = 0; i < n; i++) {
      shapleyArr[i] *= factor;
    }

    // vì v(N)=1, tổng shapley = 1 (share trực tiếp)
    const rows: ShapleyRow[] = [];

    for (let i = 0; i < n; i++) {
      const label = orderedLabels[i];
      const opt = sim.options.find((o) => o.label === label)!;
      const shap = shapleyArr[i]; // 0–1
      const share_pct = shap * 100;

      const wrong_pct =
        (wrongCounts[label] ? wrongCounts[label] : 0) /
        sim.response_matrix.length *
        100;

      const novice_pct =
        totalWrongLow > 0
          ? ((wrongCountsNovice[label] || 0) / totalWrongLow) * 100
          : 0;

      // Heuristic khuyến nghị
      let recommendation: string;
      if (share_pct >= 40) {
        recommendation =
          "Distractor rất mạnh – nên giữ, có vai trò lớn trong việc phân tán câu trả lời sai.";
      } else if (share_pct >= 25) {
        recommendation =
          "Distractor khá mạnh – nên giữ, có thể tinh chỉnh wording để rõ ràng hơn.";
      } else if (share_pct >= 10) {
        recommendation =
          "Distractor trung bình – có thể giữ nếu cần đủ 4 lựa chọn, cân nhắc cải thiện để hấp dẫn hơn.";
      } else {
        recommendation =
          "Distractor yếu – ít đóng góp vào câu sai, cân nhắc thay bằng distractor khác hoặc bỏ.";
      }

      rows.push({
        label,
        text: opt.text,
        shapley: shap,
        share_pct,
        wrong_pct,
        novice_pct,
        recommendation
      });
    }

    return rows;
  }

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50">
      {/* LEFT: Danh sách MCQ */}
      <div className="w-80 border-r bg-white overflow-y-auto">
        <div className="p-4 text-lg font-semibold">MCQ Items</div>

        {loadingList && (
          <div className="p-4 text-sm text-gray-500">
            Đang tải danh sách câu hỏi...
          </div>
        )}

        {!loadingList &&
          mcqs.map((q) => (
            <div
              key={q.id}
              onClick={() => chooseMCQ(q)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-100 ${
                selected?.id === q.id ? "bg-blue-50 font-medium" : ""
              }`}
            >
              <div className="text-sm line-clamp-3">{q.stem}</div>
            </div>
          ))}

        {!loadingList && mcqs.length === 0 && (
          <div className="p-4 text-sm text-gray-500">
            Chưa có câu MCQ nào. Hãy tạo câu hỏi ở tab MCQ trước.
          </div>
        )}
      </div>

      {/* MAIN: Chi tiết MCQ + Simulation + Shapley */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!selected && (
          <div className="text-gray-500 text-center mt-20">
            Chọn một câu MCQ bên trái để mô phỏng Monte Carlo & Shapley.
          </div>
        )}

        {selected && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">
                Step 6 & 7 – Persona Simulator + Shapley Evaluator
              </h2>
              <button
                onClick={runSimulation}
                disabled={simLoading}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
              >
                {simLoading
                  ? "Đang mô phỏng..."
                  : "Chạy mô phỏng (GPT + Monte Carlo)"}
              </button>
            </div>

            {/* MCQ VIEW */}
            <div className="bg-white p-4 rounded-xl shadow space-y-3">
              <div>
                <div className="font-semibold mb-1">Stem</div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {selected.stem}
                </p>
              </div>

              <div>
                <div className="font-semibold mb-1">Correct answer</div>
                <p className="text-sm text-emerald-700">
                  {selected.correct_answer}
                </p>
              </div>

              <div>
                <div className="font-semibold mb-1">Distractors</div>
                <ul className="list-disc list-inside text-sm text-gray-800">
                  {selected.distractors.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SIM RESULT */}
            {simResult && (
              <>
                <div className="bg-white p-4 rounded-xl shadow space-y-4">
                  <h3 className="font-semibold">
                    Kết quả mô phỏng (GPT → persona probs → Monte Carlo)
                  </h3>

                  {/* Accuracy summary */}
                  <div>
                    <div className="font-semibold mb-1">
                      Độ khó theo từng persona
                    </div>
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border px-2 py-1 text-left">
                            Persona
                          </th>
                          <th className="border px-2 py-1 text-right">
                            Tỷ lệ trả lời đúng
                          </th>
                          <th className="border px-2 py-1 text-right">
                            Số lượt mô phỏng
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.accuracy_summary.map((r) => (
                          <tr key={r.persona}>
                            <td className="border px-2 py-1">{r.persona}</td>
                            <td className="border px-2 py-1 text-right">
                              {(r.accuracy * 100).toFixed(1)}%
                            </td>
                            <td className="border px-2 py-1 text-right">
                              {r.total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Probabilities per persona */}
                  <div>
                    <div className="font-semibold mb-1">
                      Xác suất chọn từng phương án (ước lượng bởi GPT-5.1)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border px-2 py-1 text-left">
                              Persona
                            </th>
                            {simResult.options.map((o) => (
                              <th
                                key={o.label}
                                className="border px-2 py-1 text-right"
                              >
                                {o.label}
                                {o.is_correct && (
                                  <span className="text-emerald-700 ml-1">
                                    (✔)
                                  </span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {simResult.personas.map((p) => (
                            <tr key={p.name}>
                              <td className="border px-2 py-1">{p.name}</td>
                              {simResult.options.map((o) => (
                                <td
                                  key={o.label}
                                  className="border px-2 py-1 text-right"
                                >
                                  {(
                                    (p.probs[o.label] ?? 0) * 100
                                  ).toFixed(1)}
                                  %
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    GPT-5.1 ước lượng xác suất mỗi persona chọn A/B/C/D; Monte
                    Carlo dùng các phân bố này để sinh ma trận đáp án (response
                    matrix) giống như có hàng trăm sinh viên ở mỗi mức năng lực.
                  </p>
                </div>

                {/* SHAPLEY EVALUATOR */}
                {shapleyRows && (
                  <div className="bg-white p-4 rounded-xl shadow space-y-4">
                    <h3 className="font-semibold">
                      Step 7 – Shapley Distractor Evaluator
                    </h3>

                    <p className="text-sm text-gray-700">
                      Shapley Value được tính trên không gian tất cả các tập
                      hợp distrator (v(S) = tỉ lệ câu sai gây ra bởi các
                      distractor trong S, chuẩn hóa trên toàn bộ câu sai).
                      Tổng Shapley = 1, mỗi distractor có một “Distractor
                      Strength Score” thể hiện tỉ lệ đóng góp vào tổng câu sai.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border px-2 py-1 text-left">
                              Distractor
                            </th>
                            <th className="border px-2 py-1 text-right">
                              Shapley
                            </th>
                            <th className="border px-2 py-1 text-right">
                              Strength (% Shapley)
                            </th>
                            <th className="border px-2 py-1 text-right">
                              % tất cả lượt chọn
                            </th>
                            <th className="border px-2 py-1 text-right">
                              % Novice+Weak chọn
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {shapleyRows.map((r) => (
                            <tr key={r.label}>
                              <td className="border px-2 py-1 align-top">
                                <div className="font-semibold">
                                  {r.label}
                                </div>
                                <div className="text-gray-700 whitespace-pre-wrap">
                                  {r.text}
                                </div>
                              </td>
                              <td className="border px-2 py-1 text-right align-top">
                                {r.shapley.toFixed(3)}
                              </td>
                              <td className="border px-2 py-1 text-right align-top">
                                {r.share_pct.toFixed(1)}%
                              </td>
                              <td className="border px-2 py-1 text-right align-top">
                                {r.wrong_pct.toFixed(1)}%
                              </td>
                              <td className="border px-2 py-1 text-right align-top">
                                {r.novice_pct.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3">
                      {shapleyRows.map((r) => (
                        <div
                          key={r.label + "-rec"}
                          className="border rounded-lg p-2 bg-slate-50 text-xs"
                        >
                          <div className="font-semibold mb-1">
                            {r.label} – Khuyến nghị:
                          </div>
                          <div className="text-gray-800">
                            {r.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
