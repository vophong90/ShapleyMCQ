"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AUPage() {
  const router = useRouter();
  const [context, setContext] = useState<any>(null);
  const [aus, setAus] = useState<{ text: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("shapleymcq_context");
    if (!saved) {
      router.push("/wizard/context");
      return;
    }
    setContext(JSON.parse(saved));
    setLoading(false);
  }, [router]);

  async function handleGenAU() {
    setGenLoading(true);
    setMsg("");

    const res = await fetch("/api/au-gen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specialty_name: context.specialty_name,
        learner_level: context.learner_level,
        bloom_level: context.bloom_level,
        llos_text: context.llos_text
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Lỗi sinh AU");
    } else {
      setAus(data.aus || []);
    }

    setGenLoading(false);
  }

  async function handleSaveAU() {
    setMsg("");

    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    for (const au of aus) {
      await supabase.from("assessment_units").insert({
        owner_id: session.user.id,
        specialty_id: context.specialty_id,
        learner_level: context.learner_level,
        bloom_level: context.bloom_level,
        text: au.text
      });
    }

    setMsg("Đã lưu AU. Chuyển sang bước Misconceptions…");

    setTimeout(() => {
      router.push("/wizard/misconcepts");
    }, 800);
  }

  if (loading) return <p>Đang tải…</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Bước 2A — Assessment Units (AU)</h1>

      <div className="bg-white shadow border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">LLO bạn đã chọn:</h3>
        <pre className="text-xs bg-slate-50 p-3 rounded">{context.llos_text}</pre>
      </div>

      <button
        onClick={handleGenAU}
        disabled={genLoading}
        className="px-4 py-2 rounded-xl bg-brand-600 text-white"
      >
        {genLoading ? "Đang sinh AU…" : "Sinh AU từ GPT"}
      </button>

      {aus.length > 0 && (
        <div className="bg-white shadow border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Các AU sinh ra:</h2>

          {aus.map((au, i) => (
            <div key={i} className="p-2 border-b text-sm">
              {au.text}
            </div>
          ))}

          <button
            onClick={handleSaveAU}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white"
          >
            Lưu AU & Tiếp tục Misconceptions
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-blue-700">{msg}</p>}
    </div>
  );
}
