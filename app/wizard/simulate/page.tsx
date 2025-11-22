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
  label: string;
  text: string;
  is_correct: boolean;
};

type PersonaProb = {
  name: string;
  probs: Record<string, number>;
};

type AccuracyRow = {
  persona: string;
  accuracy: number;
  total: number;
};

type SimResult = {
  options: SimOption[];
  personas: PersonaProb[];
  N_per_persona: number;
  accuracy_summary: AccuracyRow[];
  // response_matrix: any[]; // nếu cần dùng thêm bước sau
};

export default function SimulatePage() {
  const [mcqs, setMcqs] = useState<MCQListItem[]>([]);
  const [selected, setSelected] = useState<MCQDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);

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
  }

  async function runSimulation() {
    if (!selected) return;

    setSimLoading(true);
    setSimResult(null);

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
  }

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50">
      {/* LEFT: Danh sách MCQ */}
      <div className="w-80 border-r bg-white overflow-y-auto">
        <div className="p-4 text-lg font-semibold">
          MCQ Items
        </div>

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
              <div className="text-sm line-clamp-3">
                {q.stem}
              </div>
            </div>
          ))}

        {!loadingList && mcqs.length === 0 && (
          <div className="p-4 text-sm text-gray-500">
            Chưa có câu MCQ nào. Hãy tạo câu hỏi ở tab MCQ trước.
          </div>
        )}
      </div>

      {/* MAIN: Chi tiết MCQ + Simulation */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!selected && (
          <div className="text-gray-500 text-center mt-20">
            Chọn một câu MCQ bên trái để mô phỏng Monte Carlo.
          </div>
        )}

        {selected && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">
                Monte Carlo Persona Simulator
              </h2>
              <button
                onClick={runSimulation}
                disabled={simLoading}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
              >
                {simLoading ? "Đang mô phỏng..." : "Chạy mô phỏng (GPT + Monte Carlo)"}
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
              <div className="bg-white p-4 rounded-xl shadow space-y-4">
                <h3 className="font-semibold">
                  Kết quả mô phỏng (GPT + Monte Carlo)
                </h3>

                {/* Accuracy summary */}
                <div>
                  <div className="font-semibold mb-1">
                    Độ khó theo từng persona
                  </div>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border px-2 py-1 text-left">Persona</th>
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
                          <td className="border px-2 py-1">
                            {r.persona}
                          </td>
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
                    Xác suất chọn từng phương án
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border px-2 py-1 text-left">Persona</th>
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
                            <td className="border px-2 py-1">
                              {p.name}
                            </td>
                            {simResult.options.map((o) => (
                              <td
                                key={o.label}
                                className="border px-2 py-1 text-right"
                              >
                                {((p.probs[o.label] ?? 0) * 100).toFixed(1)}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Các xác suất ở trên được GPT-5.1 ước lượng cho từng persona,
                  sau đó được phóng to bằng Monte Carlo để sinh ma trận đáp án.
                  Bước tiếp theo (Step 7) sẽ dùng ma trận này để tính Shapley
                  Value cho từng distractor.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
