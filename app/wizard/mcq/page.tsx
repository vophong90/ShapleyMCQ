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

export default function MCQWizard() {
  const [aus, setAus] = useState<AU[]>([]);
  const [selectedAU, setSelectedAU] = useState<AU | null>(null);
  const [miscons, setMiscons] = useState<Miscon[]>([]);
  const [mcq, setMcq] = useState<MCQ | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load AU list
  useEffect(() => {
    loadAUs();
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
    }
  }

  function chooseAU(au: AU) {
    setSelectedAU(au);
    setMcq(null);
    loadMiscons(au);
  }

  // Generate MCQ
  async function generateMCQ() {
    if (!selectedAU) return;

    setLoading(true);

    const res = await fetch("/api/mcq-gen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        au_text: selectedAU.text,
        misconceptions: miscons,
        specialty_name: "Y học cổ truyền",
        learner_level: "Sinh viên đại học",
        bloom_level: "Analyze"
      })
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
      [key]: value
    }));
  }

  // Refine Stem
  async function refineStem() {
    if (!mcq) return;

    const res = await fetch("/api/mcqs/refine-stem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: mcq.stem
      })
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
        text: mcq.distractors[i]
      })
    });

    const json = await res.json();
    if (json.refined) {
      const arr = [...mcq.distractors];
      arr[i] = json.refined;
      updateMCQ("distractors", arr);
    }
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
        explanation: mcq.explanation
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
        is_correct: false
      }))
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
                  <div className="flex justify-between">
                    <h3 className="font-semibold mb-2">Stem</h3>
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
                      <div className="flex justify-between">
                        <span className="font-medium">Distractor {i + 1}</span>
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
                    onChange={(e) => updateMCQ("explanation", e.target.value)}
                  />
                </div>
              </div>
            )}
          </>
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
