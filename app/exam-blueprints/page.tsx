"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

/* ------------------ TYPES ------------------ */
type Course = {
  id: string;
  title: string;
  code: string | null;
};

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

/* ------------------ MAIN PAGE ------------------ */
export default function ExamBlueprintListPage() {
  const [loading, setLoading] = useState(true);
  const [blueprints, setBlueprints] = useState<ExamBlueprintRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Tạo blueprint form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCourseId, setNewCourseId] = useState<string>("");

  // Edit blueprint modal
  const [showEdit, setShowEdit] = useState(false);
  const [editingBp, setEditingBp] = useState<ExamBlueprintRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCourseId, setEditCourseId] = useState<string>("");

  // ✅ Dùng supabase-browser.ts
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  /* ------------------ HELPERS ------------------ */
  const courseById = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.id, c);
    return m;
  }, [courses]);

  function getCourseLabel(courseId: string | null | undefined) {
    if (!courseId) return "Chưa chọn";
    const c = courseById.get(courseId);
    if (!c) return courseId; // fallback nếu courses chưa load kịp
    return `${c.code ? `${c.code} – ` : ""}${c.title}`;
  }

  async function reloadBlueprints(ownerId: string) {
    const { data, error: bpErr } = await supabase
      .from("exam_blueprints")
      .select("id, title, description, created_at, config")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (bpErr) throw bpErr;
    setBlueprints((data || []) as ExamBlueprintRow[]);
  }

  /* ------------------ LOAD ALL ------------------ */
  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          setError("Bạn cần đăng nhập để dùng Khảo thí.");
          return;
        }

        /* ----- Load Blueprint ----- */
        const { data: bpData, error: bpErr } = await supabase
          .from("exam_blueprints")
          .select("id, title, description, created_at, config")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (bpErr) throw bpErr;
        setBlueprints((bpData || []) as ExamBlueprintRow[]);

        /* ----- Load Courses (owner only) ----- */
        const { data: courseData, error: cErr } = await supabase
          .from("courses")
          .select("id, title, code")
          .eq("owner_id", user.id) // chỉ lấy đúng học phần thuộc user
          .order("title", { ascending: true });

        if (cErr) throw cErr;
        setCourses(courseData || []);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Không tải được dữ liệu.");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [supabase]);

  /* ------------------ HANDLE CREATE BLUEPRINT ------------------ */
  async function createBlueprint() {
    try {
      if (!newTitle.trim()) return alert("Tên blueprint không được để trống.");
      if (!newCourseId) return alert("Bạn phải chọn học phần.");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return alert("Bạn chưa đăng nhập.");

      const { error: insertErr } = await supabase
        .from("exam_blueprints")
        .insert([
          {
            owner_id: user.id,
            title: newTitle.trim(),
            description: newDesc.trim() || null,
            config: {
              course_id: newCourseId,
              total_questions: 0,
              llo_distribution: [],
            },
          },
        ]);

      if (insertErr) throw insertErr;

      // Reset form + close modal + reload list
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewCourseId("");

      await reloadBlueprints(user.id);
    } catch (err: any) {
      alert("Không thể tạo blueprint: " + err.message);
    }
  }

  /* ------------------ EDIT / DELETE ------------------ */
  function openEdit(bp: ExamBlueprintRow) {
    setEditingBp(bp);
    setEditTitle(bp.title || "");
    setEditDesc(bp.description || "");
    setEditCourseId(bp.config?.course_id || "");
    setShowEdit(true);
  }

  async function saveEdit() {
    try {
      if (!editingBp) return;
      if (!editTitle.trim()) return alert("Tên blueprint không được để trống.");
      if (!editCourseId) return alert("Bạn phải chọn học phần.");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return alert("Bạn chưa đăng nhập.");

      const currentCfg: BlueprintConfig = editingBp.config || {
        course_id: null,
        total_questions: 0,
        llo_distribution: [],
      };

      const nextCfg: BlueprintConfig = {
        ...currentCfg,
        course_id: editCourseId,
      };

      const { error: upErr } = await supabase
        .from("exam_blueprints")
        .update({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          config: nextCfg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingBp.id)
        .eq("owner_id", user.id);

      if (upErr) throw upErr;

      setShowEdit(false);
      setEditingBp(null);

      await reloadBlueprints(user.id);
    } catch (e: any) {
      alert("Không thể lưu chỉnh sửa: " + (e?.message || "Unknown error"));
    }
  }

  async function deleteBlueprint(bpId: string) {
    try {
      const ok = confirm("Xóa Blueprint này? Hành động không thể hoàn tác.");
      if (!ok) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return alert("Bạn chưa đăng nhập.");

      const { error: delErr } = await supabase
        .from("exam_blueprints")
        .delete()
        .eq("id", bpId)
        .eq("owner_id", user.id);

      if (delErr) throw delErr;

      await reloadBlueprints(user.id);
    } catch (e: any) {
      alert("Không thể xóa: " + (e?.message || "Unknown error"));
    }
  }

  /* ------------------ UI ------------------ */
  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6 px-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Khảo thí</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tạo và sử dụng Blueprint để sinh đề thi từ ngân hàng MCQ.
          </p>
        </div>

        {/* BUTTON TẠO BLUEPRINT */}
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 text-sm"
        >
          + Tạo Blueprint
        </button>
      </div>

      {/* ----------- CREATE MODAL ----------- */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Tạo Blueprint mới</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tên Blueprint</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="VD: Đề thi Cuối kỳ Nội YHCT"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả (tuỳ chọn)</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Chọn học phần</label>
              <select
                value={newCourseId}
                onChange={(e) => setNewCourseId(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              >
                <option value="">-- Chọn học phần --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} – ` : ""}
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border"
                onClick={() => setShowCreate(false)}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                onClick={createBlueprint}
              >
                Lưu blueprint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------- EDIT MODAL ----------- */}
      {showEdit && editingBp && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Sửa Blueprint</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tên Blueprint</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả (tuỳ chọn)</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Chọn học phần</label>
              <select
                value={editCourseId}
                onChange={(e) => setEditCourseId(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
              >
                <option value="">-- Chọn học phần --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} – ` : ""}
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border"
                onClick={() => {
                  setShowEdit(false);
                  setEditingBp(null);
                }}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                onClick={saveEdit}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------- BLUEPRINT LIST ----------- */}
      {loading ? (
        <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : blueprints.length === 0 ? (
        <p className="text-sm text-slate-500">
          Chưa có Blueprint nào — hãy tạo Blueprint trước.
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold text-slate-900">
                        {bp.title}
                      </h2>

                      {/* Actions */}
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          className="px-2 py-1 text-[11px] rounded-lg border hover:bg-slate-50"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEdit(bp);
                          }}
                          title="Sửa blueprint"
                        >
                          Sửa
                        </button>
                        <button
                          className="px-2 py-1 text-[11px] rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteBlueprint(bp.id);
                          }}
                          title="Xóa blueprint"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>

                    {bp.description && (
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                        {bp.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        Học phần:{" "}
                        <span className="font-medium text-slate-700">
                          {getCourseLabel(cfg.course_id)}
                        </span>
                      </span>
                      <span>
                        Tổng số câu:{" "}
                        <span className="font-medium text-slate-700">
                          {cfg.total_questions}
                        </span>
                      </span>
                      <span>
                        Số LLO gán:{" "}
                        <span className="font-medium text-slate-700">
                          {lloCount}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 shrink-0">
                    <div>{new Date(bp.created_at).toLocaleString("vi-VN")}</div>
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
