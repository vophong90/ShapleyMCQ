"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type WizardContext = {
  specialty_id?: string;
  specialty_name?: string;
  course_id?: string;
  course_title?: string;
  lesson_id?: string;
  lesson_title?: string;
  learner_level?: string;
  bloom_level?: string;
  llos_text?: string;
};

type GeneratedAU = {
  core_statement: string;
  short_explanation?: string | null;
  bloom_min?: string | null;
  selected: boolean;
};

export default function AUPage() {
  const router = useRouter();

  const [context, setContext] = useState<WizardContext | null>(null);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState<File[]>([]);
  const [aus, setAus] = useState<GeneratedAU[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load context từ localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem("shapleymcq_context");
    if (!saved) {
      router.push("/wizard/context");
      return;
    }

    try {
      const parsed = JSON.parse(saved) as WizardContext;
      setContext(parsed);
    } catch (e) {
      console.error("Lỗi parse shapleymcq_context:", e);
      setError("Không đọc được bối cảnh. Vui lòng thiết lập lại ở Bước 1.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList) return;

    const arr = Array.from(fileList);
    setFiles(arr);
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGenAU() {
    if (!context) {
      setError("Chưa có bối cảnh. Vui lòng quay lại Bước 1.");
      return;
    }
    if (!context.llos_text || !context.llos_text.trim()) {
      setError("Thiếu LLO. Vui lòng quay lại Bước 1 để nhập LLO.");
      return;
    }

    setGenLoading(true);
    setMsg(null);
    setError(null);
    setAus([]);

    try {
      const formData = new FormData();
      formData.append("llos_text", context.llos_text);
      if (context.learner_level)
        formData.append("learner_level", context.learner_level);
      if (context.bloom_level)
        formData.append("bloom_level", context.bloom_level);
      if (context.specialty_name)
        formData.append("specialty_name", context.specialty_name);
      if (context.course_title)
        formData.append("course_title", context.course_title);
      if (context.lesson_title)
        formData.append("lesson_title", context.lesson_title);

      // Gửi kèm toàn bộ files (không lưu, chỉ dùng trong phiên)
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/au-gen", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("AU-gen error:", data);
        setError(data?.error || "Lỗi sinh AU từ GPT. Vui lòng thử lại.");
        setGenLoading(false);
        return;
      }

      const rawAus = Array.isArray(data.aus) ? data.aus : [];

      const mapped: GeneratedAU[] = rawAus
        .map((au: any) => ({
          core_statement: au.core_statement ?? au.text ?? "",
          short_explanation: au.short_explanation ?? null,
          bloom_min: au.bloom_min ?? null,
          selected: true,
        }))
        .filter((au: GeneratedAU) => au.core_statement.trim() !== "");

      if (mapped.length === 0) {
        setError(
          "GPT không sinh được AU nào. Vui lòng kiểm tra lại LLO hoặc tài liệu."
        );
      } else {
        setAus(mapped);
        setMsg(
          `Đã sinh được ${mapped.length} AU. Bạn có thể chọn/bỏ chọn trước khi lưu.`
        );
      }

      setGenLoading(false);
    } catch (e: any) {
      console.error(e);
      setError("Lỗi mạng hoặc server khi gọi GPT.");
      setGenLoading(false);
    }
  }

  function toggleSelectAU(index: number) {
    setAus((prev) =>
      prev.map((au, i) =>
        i === index ? { ...au, selected: !au.selected } : au
      )
    );
  }

  async function handleSaveAU() {
    if (!context) {
      setError("Chưa có bối cảnh. Vui lòng quay lại Bước 1.");
      return;
    }

    const selected = aus.filter((au) => au.selected);
    if (selected.length === 0) {
      setError("Bạn chưa chọn AU nào để lưu.");
      return;
    }

    if (!context.course_id || !context.lesson_id) {
      setError(
        "Thiếu Học phần hoặc Bài học trong bối cảnh. Vui lòng thiết lập lại ở Bước 1."
      );
      return;
    }

    setSaveLoading(true);
    setError(null);
    setMsg(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const rows = selected.map((au) => ({
        owner_id: session.user.id,
        course_id: context.course_id!,
        lesson_id: context.lesson_id!,
        core_statement: au.core_statement,
        short_explanation: au.short_explanation ?? null,
        bloom_min: au.bloom_min ?? null,
        status: "draft",
      }));

      const { error: insertError } = await supabase
        .from("assessment_units")
        .insert(rows);

      if (insertError) {
        console.error("Insert assessment_units error:", insertError);
        setError("Lỗi lưu AU xuống Supabase. Vui lòng thử lại.");
        setSaveLoading(false);
        return;
      }

      setMsg("Đã lưu AU được chọn. Chuyển sang bước Misconceptions…");
      setSaveLoading(false);

      setTimeout(() => {
        router.push("/wizard/misconcepts");
      }, 900);
    } catch (e: any) {
      console.error(e);
      setError("Lỗi server khi lưu AU.");
      setSaveLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm text-slate-600">Đang tải bối cảnh…</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm text-rose-700">
          Không tìm thấy bối cảnh. Vui lòng quay lại Bước 1 để thiết lập.
        </p>
        <button
          onClick={() => router.push("/wizard/context")}
          className="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
        >
          Quay lại Bước 1
        </button>
      </div>
    );
  }

  const hasSelected = aus.some((au) => au.selected);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Bước 2A – Assessment Units (AU)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Từ LLO và tài liệu bài học, GPT sẽ gợi ý các Assessment Unit (AU) cốt
            lõi. Bạn chọn những AU phù hợp để lưu và dùng cho các bước
            Misconceptions &amp; MCQ sau này.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/wizard/context")}
          className="self-start px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 hover:border-brand-400 hover:text-brand-700"
        >
          ← Quay lại Bước 1
        </button>
      </div>

      {/* Card: Thông tin bối cảnh + LLO */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
          {context.course_title && (
            <div>
              <span className="font-semibold text-slate-800">Học phần:</span>{" "}
              {context.course_title}
            </div>
          )}
          {context.lesson_title && (
            <div>
              <span className="font-semibold text-slate-800">Bài học:</span>{" "}
              {context.lesson_title}
            </div>
          )}
          {context.learner_level && (
            <div>
              <span className="font-semibold text-slate-800">Bậc học:</span>{" "}
              {context.learner_level}
            </div>
          )}
          {context.bloom_level && (
            <div>
              <span className="font-semibold text-slate-800">Bloom:</span>{" "}
              {context.bloom_level}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">
            LLO của bài học:
          </div>
          {/* CHỖ NÀY ĐÃ CHỈNH FONT */}
          <pre
            className="font-sans text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 
                       max-h-40 overflow-auto whitespace-pre-wrap leading-relaxed"
          >
            {context.llos_text}
          </pre>
          <p className="mt-1 text-[11px] text-slate-500">
            GPT sẽ dựa vào LLO này + tài liệu bạn upload để sinh AU.
          </p>
        </div>
      </div>

      {/* Card: Upload tài liệu */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div>
          <div className="text-xs font-medium text-slate-700 mb-1">
            Tài liệu bài học (không lưu, chỉ dùng trong phiên)
          </div>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
            onChange={handleFilesChange}
            className="block w-full text-xs text-slate-600
                       file:mr-3 file:py-1.5 file:px-3
                       file:rounded-lg file:border-0
                       file:text-xs file:font-medium
                       file:bg-brand-50 file:text-brand-700
                       hover:file:bg-brand-100"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Chấp nhận: PDF, Word, PowerPoint, hình ảnh. File không được lưu lên
            server mà chỉ dùng để GPT phân tích trong phiên làm việc này.
          </p>
        </div>

        {files.length > 0 && (
          <div className="border border-dashed border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-600 mb-1">
              Các file đã chọn:
            </div>
            <ul className="space-y-1">
              {files.map((file, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-2 text-[11px] text-slate-700"
                >
                  <span className="truncate">
                    {file.name}{" "}
                    <span className="text-slate-400">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100"
                  >
                    Xóa
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            onClick={handleGenAU}
            disabled={genLoading}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {genLoading
              ? "Đang sinh AU từ GPT…"
              : "Sinh AU từ GPT (từ LLO + tài liệu)"}
          </button>
        </div>
      </div>

      {/* Thông báo */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-3">
          {msg}
        </div>
      )}

      {/* Kết quả AU sinh ra */}
      {aus.length > 0 && (
        <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Các AU sinh ra từ GPT
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Bạn có thể bỏ chọn những AU không phù hợp trước khi lưu.
              </p>
            </div>
            <div className="text-[11px] text-slate-500">
              Đang chọn:{" "}
              <span className="font-semibold text-slate-800">
                {aus.filter((a) => a.selected).length}/{aus.length}
              </span>{" "}
              AU
            </div>
          </div>

          <div className="space-y-3">
            {aus.map((au, idx) => (
              <div
                key={idx}
                className={
                  "border rounded-xl px-3.5 py-2.5 text-xs flex flex-col gap-1 " +
                  (au.selected
                    ? "bg-slate-50 border-brand-200"
                    : "bg-white border-slate-200 opacity-80")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {au.core_statement}
                    </div>
                    {au.short_explanation && (
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        {au.short_explanation}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {au.bloom_min && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-50">
                        Bloom tối thiểu: {au.bloom_min}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSelectAU(idx)}
                      className={
                        "mt-1 px-2.5 py-1 rounded-full text-[10px] font-semibold " +
                        (au.selected
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200")
                      }
                    >
                      {au.selected ? "Đang chọn" : "Không chọn"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleSaveAU}
              disabled={saveLoading || !hasSelected}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              {saveLoading
                ? "Đang lưu AU…"
                : "Lưu AU đã chọn & tiếp tục Misconceptions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
