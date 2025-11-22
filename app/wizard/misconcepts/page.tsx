"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AU = {
  id: string;
  text: string;
};

type MisItem = {
  id?: string;
  description: string;
  error_type: string;
  approved: boolean;
};

export default function MisconceptWizard() {
  const [aus, setAus] = useState<AU[]>([]);
  const [selectedAU, setSelectedAU] = useState<AU | null>(null);
  const [miscons, setMiscons] = useState<MisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load AU list for this user
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

  // Load Misconceptions from DB when selecting AU
  async function loadMisconFromDB(au: AU) {
    const { data, error } = await supabase
      .from("misconceptions")
      .select("id, description, error_type")
      .eq("au_id", au.id);

    if (error) return;

    if (data.length === 0) {
      setMiscons([]);
    } else {
      setMiscons(
        data.map((m: any) => ({
          id: m.id,
          description: m.description,
          error_type: m.error_type || "conceptual",
          approved: true,
        }))
      );
    }
  }

  // User clicks AU
  function chooseAU(au: AU) {
    setSelectedAU(au);
    loadMisconFromDB(au);
  }

  // GPT Generate Misconceptions
  async function generateMiscon() {
    if (!selectedAU) return;

    setLoading(true);

    const res = await fetch("/api/miscon-gen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specialty_name: "Y học cổ truyền",
        learner_level: "Sinh viên đại học",
        bloom_level: "Analyze",
        aus: [{ id: selectedAU.id, text: selectedAU.text }],
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (json.error) {
      alert(json.error);
      return;
    }

    const out = json.misconceptions?.[0]?.items || [];

    setMiscons(
      out.map((m: any) => ({
        description: m.description,
        error_type: m.error_type,
        approved: true,
      }))
    );
  }

  // Save selected misconceptions
  async function saveMiscon() {
    if (!selectedAU) return;
    setSaving(true);

    // Delete old → Insert new
    await supabase.from("misconceptions").delete().eq("au_id", selectedAU.id);

    const rows = miscons
      .filter((m) => m.approved)
      .map((m) => ({
        au_id: selectedAU.id,
        owner_id: (supabase as any).auth.getUser()?.id,
        description: m.description,
        error_type: m.error_type,
      }));

    if (rows.length > 0) {
      await supabase.from("misconceptions").insert(rows);
    }

    setSaving(false);
    alert("Đã lưu Misconceptions!");
  }

  // Update fields
  function updateItem(i: number, key: keyof MisItem, value: any) {
    const arr = [...miscons];
    (arr[i] as any)[key] = value;
    setMiscons(arr);
  }

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50">

      {/* LEFT PANEL — AU LIST */}
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
            Chọn một AU bên trái để bắt đầu.
          </div>
        )}

        {selectedAU && (
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{selectedAU.text}</h2>

              <button
                onClick={generateMiscon}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {loading ? "Đang sinh..." : "Sinh Misconceptions (GPT)"}
              </button>
            </div>

            {/* MISCON LIST */}
            <div className="mt-6 space-y-4">
              {miscons.map((m, i) => (
                <div key={i} className="p-4 bg-white rounded-2xl shadow">
                  <textarea
                    className="w-full border rounded-lg p-2"
                    rows={3}
                    value={m.description}
                    onChange={(e) =>
                      updateItem(i, "description", e.target.value)
                    }
                  />

                  <div className="flex mt-3 gap-4 items-center">
                    <select
                      value={m.error_type}
                      onChange={(e) =>
                        updateItem(i, "error_type", e.target.value)
                      }
                      className="border rounded-lg px-3 py-2"
                    >
                      <option value="conceptual">Conceptual</option>
                      <option value="procedural">Procedural</option>
                      <option value="bias">Cognitive Bias</option>
                      <option value="clinical reasoning">Clinical reasoning</option>
                      <option value="terminology">Terminology</option>
                    </select>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={m.approved}
                        onChange={(e) =>
                          updateItem(i, "approved", e.target.checked)
                        }
                      />
                      Duyệt
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      {selectedAU && (
        <div className="w-72 border-l bg-white p-4">
          <div className="text-lg font-semibold mb-4">Tác vụ</div>

          <div className="mb-4">
            Tổng: {miscons.length}  
            <br />
            Đã duyệt: {miscons.filter((m) => m.approved).length}
          </div>

          <button
            onClick={saveMiscon}
            disabled={saving}
            className="bg-green-600 w-full text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            {saving ? "Đang lưu…" : "Lưu Misconceptions"}
          </button>

        </div>
      )}
    </div>
  );
}
