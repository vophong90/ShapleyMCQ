"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AU = {
  id: string;
  text: string;
};

type Miscon = {
  description: string;
  error_type: string;
};

type MCQ = {
  stem: string;
  correct_answer: string;
  distractors: string[];
  explanation: string;
};

type NbmeResult = {
  hard_rules: {
    passed: boolean;
    flags: string[];
  };
  rubric: {
    overall_score: number;
    summary: string;
    dimensions: {
      stem_clarity?: { score: number; comment: string };
      one_best_answer?: { score: number; comment: string };
      distractor_quality?: { score: number; comment: string };
      clinical_relevance?: { score: number; comment: string };
      technical_flaws?: { score: number; comment: string };
      [key: string]: any;
    };
    suggestions: string;
    [key: string]: any;
  };
};

type EduFitResult = {
  inferred_bloom: string;
  bloom_match: string;   // "good" | "too_low" | "too_high"
  level_fit: string;     // "good" | "too_easy" | "too_hard"
  summary: string;
  llo_coverage: {
    llo: string;
    coverage: string;    // "direct" | "indirect" | "none"
    comment: string;
  }[];
  recommendations: string[];
};

export default function MCQWizard() {
  const [aus, setAus] = useState<AU[]>([]);
  const [selectedAU, setSelectedAU] = useState<AU | null>(null);
  const [miscons, setMiscons] = useState<Miscon[]>([]);
  const [mcq, setMcq] = useState<MCQ | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nbmeResult, setNbmeResult] = useState<NbmeResult | null>(null);
  const [nbmeLoading, setNbmeLoading] = useState(false);
  const [context, setContext] = useState<any | null>(null);
  const [eduFitResult, setEduFitResult] = useState<EduFitResult | null>(null);
  const [eduLoading, setEduLoading] = useState(false);


  // Load AU list
  useEffect(() => {
    loadAUs();
    // Lấy context từ bước 1 (đã lưu ở localStorage)
    const saved = typeof window !== "undefined"
      ? localStorage.getItem("shapleymcq_context")
      : null;
    if (saved) {
      try {
        setContext(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  async function loadAUs() {
    const { data, error } = await supabase
      .from("assessment_units")
      .select("id, text")
      .order("created_at", { ascending: true });
    if (!error && data) setAus(data);
  }

  // Load misconceptions
  async function loadMiscons(au: AU) {
    const { data, error } = await supabase
      .from("misconceptions")
      .select("description, error_type")
      .eq("au_id", au.id);

    if (!error && data) {
      setMiscons(data);
    } else {
      setMiscons([]);
    }
  }

  function chooseAU(au: AU) {
    setSelectedAU(au);
    setMcq(null);
    setNbmeResult(null);
    loadMiscons(au);
  }

  // Generate MCQ
  async function generateMCQ() {
    if (!selectedAU) return;

    setLoading(true);
    setNbmeResult(null);

    const res = await fetch("/api/mcq-gen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        au_text: selectedAU.text,
        misconceptions: miscons,
        specialty_name: "Y học cổ truyền",
        learner_level: "Sinh viên đại học",
        bloom_level: "Analyze",
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (json.error) {
      alert(json.error);
      return;
    }

    setMcq(json);
  }

  // Update MCQ fields
  function updateMCQ(key: keyof MCQ, value: any) {
    setMcq((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  // Refine Stem
  async function refineStem() {
    if (!mcq) return;

    const res = await fetch("/api/mcqs/refine-stem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: mcq.stem,
      }),
    });

    const json = await res.json();
    if (json.refined) updateMCQ("stem", json.refined);
  }

  // Refine individual distractor
  async function refineDistractor(i: number) {
    if (!mcq) return;

    const res = await fetch("/api/mcqs/refine-distractor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: mcq.distractors[i],
      }),
    });

    const json = await res.json();
    if (json.refined) {
      const arr = [...mcq.distractors];
      arr[i] = json.refined;
      updateMCQ("distractors", arr);
    }
  }

  // NBME/USMLE STYLE CHECK
  async function runNbmeCheck() {
    if (!mcq) return;
    setNbmeLoading(true);

    const res = await fetch("/api/mcqs/nbme-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcq),
    });

    const json = await res.json();
    setNbmeLoading(false);

    if (json.error) {
      alert(json.error);
      return;
    }

    setNbmeResult(json);
  }

    // EDUCATIONAL FIT CHECK
  async function runEduFitCheck() {
    if (!mcq || !context) return;
    setEduLoading(true);
    setEduFitResult(null);

    const res = await fetch("/api/mcqs/edu-fit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: mcq.stem,
        correct_answer: mcq.correct_answer,
        distractors: mcq.distractors,
        explanation: mcq.explanation,
        learner_level: context.learner_level,
        bloom_level: context.bloom_level,
        llos_text: context.llos_text,
        specialty_name: context.specialty_name,
      }),
    });

    const json = await res.json();
    setEduLoading(false);

    if (json.error) {
      alert(json.error);
      return;
    }

    setEduFitResult(json);
  }

  // Save MCQ to DB
  async function saveMCQ() {
    if (!selectedAU || !mcq) return;

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { data, error } = await supabase
      .from("mcq_items")
      .insert({
        au_id: selectedAU.id,
        owner_id: userId,
        stem: mcq.stem,
        correct_answer: mcq.correct_answer,
        explanation: mcq.explanation,
      })
      .select("id")
      .single();

    if (error) {
      alert("Lưu MCQ thất bại");
      setSaving(false);
      return;
    }

    const mcqId = data.id;

    const options = [
      { mcq_id: mcqId, text: mcq.correct_answer, is_correct: true },
      ...mcq.distractors.map((d: string) => ({
        mcq_id: mcqId,
        text: d,
        is_correct: false,
      })),
    ];

    await supabase.from("mcq_options").insert(options);

    setSaving(false);
    alert("MCQ đã được lưu!");
  }

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50">
      {/* LEFT PANEL */}
      <div className="w-80 border-r bg-white overflow-y-auto">
        <div className="p-4 text-lg font-semibold">Assessment Units</div>
        {aus.map((a) => (
          <div
            key={a.id}
            className={`p-3 cursor-pointer border-b hover:bg-gray-100 ${
              selectedAU?.id === a.id ? "bg-blue-50 font-medium" : ""
            }`}
            onClick={() => chooseAU(a)}
          >
            {a.text}
          </div>
        ))}
      </div>

      {/* MAIN PANEL */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!selectedAU && (
          <div className="text-gray-500 text-center mt-20">
            Chọn một AU để bắt đầu tạo câu MCQ.
          </div>
        )}

        {selectedAU && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{selectedAU.text}</h2>

              <button
                onClick={generateMCQ}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {loading ? "Đang sinh..." : "Generate MCQ (GPT)"}
              </button>
            </div>

            {/* MCQ Viewer */}
            {mcq && (
              <div className="mt-6 space-y-6">
                {/* STEM */}
                <div className="bg-white p-4 rounded-xl shadow">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Stem</h3>
                    <button
                      onClick={refineStem}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Refine Stem
                    </button>
                  </div>

                  <textarea
                    className="w-full border p-2 rounded-lg"
                    rows={4}
                    value={mcq.stem}
                    onChange={(e) => updateMCQ("stem", e.target.value)}
                  />
                </div>

                {/* CORRECT ANSWER */}
                <div className="bg-white p-4 rounded-xl shadow">
                  <h3 className="font-semibold mb-2">Correct Answer</h3>
                  <input
                    className="w-full border p-2 rounded-lg"
                    value={mcq.correct_answer}
                    onChange={(e) =>
                      updateMCQ("correct_answer", e.target.value)
                    }
                  />
                </div>

                {/* DISTRACTORS */}
                <div className="bg-white p-4 rounded-xl shadow">
                  <h3 className="font-semibold mb-3">Distractors</h3>

                  {mcq.distractors.map((d, i) => (
                    <div key={i} className="mb-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          Distractor {i + 1}
                        </span>
                        <button
                          onClick={() => refineDistractor(i)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Refine
                        </button>
                      </div>

                      <input
                        className="w-full border p-2 rounded-lg mt-1"
                        value={d}
                        onChange={(e) => {
                          const arr = [...mcq.distractors];
                          arr[i] = e.target.value;
                          updateMCQ("distractors", arr);
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* EXPLANATION */}
                <div className="bg-white p-4 rounded-xl shadow">
                  <h3 className="font-semibold mb-2">Explanation</h3>
                  <textarea
                    className="w-full border p-2 rounded-lg"
                    rows={4}
                    value={mcq.explanation}
                    onChange={(e) =>
                      updateMCQ("explanation", e.target.value)
                    }
                  />
                </div>

                {/* NBME / USMLE STYLE CHECKER */}
                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">
                      USMLE / NBME Style Checker
                    </h3>
                    <button
                      onClick={runNbmeCheck}
                      disabled={nbmeLoading}
                      className="px-3 py-1 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
                    >
                      {nbmeLoading
                        ? "Đang đánh giá…"
                        : "Chạy NBME Style Check"}
                    </button>
                  </div>

                  {!nbmeResult && (
                    <p className="text-sm text-gray-500">
                      Bấm nút để đánh giá câu MCQ theo chuẩn NBME/USMLE (hard
                      rules + GPT rubric).
                    </p>
                  )}

                  {nbmeResult && (
                    <div className="space-y-3 text-sm">
                      {/* HARD RULES */}
                      <div>
                        <div className="font-semibold">
                          Hard rules:{" "}
                          {nbmeResult.hard_rules.passed ? (
                            <span className="text-emerald-600">PASSED</span>
                          ) : (
                            <span className="text-red-600">FAILED</span>
                          )}
                        </div>
                        {nbmeResult.hard_rules.flags.length > 0 && (
                          <ul className="list-disc list-inside text-red-700 mt-1">
                            {nbmeResult.hard_rules.flags.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* RUBRIC */}
                      <div>
                        <div className="font-semibold">
                          Overall score:{" "}
                          <span className="text-blue-700">
                            {nbmeResult.rubric.overall_score}/5
                          </span>
                        </div>
                        <p className="mt-1 text-gray-700">
                          {nbmeResult.rubric.summary}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(nbmeResult.rubric.dimensions || {}).map(
                          ([key, value]: any) => (
                            <div
                              key={key}
                              className="border rounded-lg p-2 bg-slate-50"
                            >
                              <div className="font-semibold">
                                {key}{" "}
                                <span className="text-sm text-blue-700">
                                  ({value.score}/5)
                                </span>
                              </div>
                              <div className="text-xs text-gray-700 mt-1">
                                {value.comment}
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      <div>
                        <div className="font-semibold">Gợi ý chỉnh sửa:</div>
                        <pre className="mt-1 text-xs whitespace-pre-wrap text-gray-700">
                          {nbmeResult.rubric.suggestions}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

                      {/* EDUCATIONAL FIT CHECKER */}
                <div className="bg-white p-4 rounded-xl shadow space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">
                      Educational Fit Checker
                    </h3>
                    <button
                      onClick={runEduFitCheck}
                      disabled={eduLoading || !context}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {eduLoading
                        ? "Đang đánh giá…"
                        : "Check Bloom ↔ Bậc học ↔ LLO"}
                    </button>
                  </div>

                  {!eduFitResult && (
                    <p className="text-sm text-gray-500">
                      Dùng để kiểm tra xem câu MCQ này có phù hợp với mức Bloom,
                      bậc đào tạo và LLOs của bài hay không.
                    </p>
                  )}

                  {eduFitResult && (
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="font-semibold">
                          Mức Bloom suy luận:{" "}
                          <span className="text-blue-700">
                            {eduFitResult.inferred_bloom}
                          </span>
                        </div>
                        <div className="mt-1">
                          So với Bloom mục tiêu:{" "}
                          <span className="font-semibold">
                            {eduFitResult.bloom_match === "good"
                              ? "Phù hợp"
                              : eduFitResult.bloom_match === "too_low"
                              ? "Thấp hơn mục tiêu"
                              : eduFitResult.bloom_match === "too_high"
                              ? "Cao hơn mục tiêu"
                              : eduFitResult.bloom_match}
                          </span>
                        </div>
                        <div>
                          Phù hợp với bậc học:{" "}
                          <span className="font-semibold">
                            {eduFitResult.level_fit === "good"
                              ? "Phù hợp"
                              : eduFitResult.level_fit === "too_easy"
                              ? "Quá dễ"
                              : eduFitResult.level_fit === "too_hard"
                              ? "Quá khó"
                              : eduFitResult.level_fit}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="font-semibold mb-1">
                          Tóm tắt:
                        </div>
                        <p className="text-gray-700">
                          {eduFitResult.summary}
                        </p>
                      </div>

                      <div>
                        <div className="font-semibold mb-1">
                          LLO coverage:
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2 bg-slate-50">
                          {eduFitResult.llo_coverage.map((c, i) => (
                            <div key={i} className="text-xs">
                              <div className="font-semibold">
                                • {c.llo}
                              </div>
                              <div>
                                Coverage:{" "}
                                <span className="italic">
                                  {c.coverage}
                                </span>
                                {" – "}
                                {c.comment}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="font-semibold mb-1">
                          Gợi ý chỉnh sửa:
                        </div>
                        <ul className="list-disc list-inside text-xs text-gray-700">
                          {eduFitResult.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

      {/* RIGHT PANEL */}
      {selectedAU && (
        <div className="w-72 border-l bg-white p-4">
          <div className="text-lg font-semibold mb-4">Actions</div>

          <button
            onClick={saveMCQ}
            disabled={saving}
            className="bg-green-600 w-full text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            {saving ? "Đang lưu…" : "Lưu câu MCQ"}
          </button>
        </div>
      )}
    </div>
  );
}
