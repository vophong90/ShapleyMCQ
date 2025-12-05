"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Course = {
  id: string;
  title: string;
  code: string | null;
};

type Lesson = {
  id: string;
  title: string;
};

type LLO = {
  id: string;
  code: string | null;
  text: string;
  bloom_suggested: string | null;
  level_suggested: string | null;
};

type AU = {
  id: string;
  core_statement: string;
  bloom_min: string | null;
};

type MisItem = {
  id?: string;            // id trong bảng misconceptions (nếu có)
  au_id: string;          // FK tới assessment_units.id
  description: string;
  error_type: string;
  approved: boolean;
  source: "db" | "gpt";   // để phân biệt Mis cũ từ DB và Mis mới từ GPT
};

const PAGE = 1000;

export default function MisconceptWizard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const [llos, setLlos] = useState<LLO[]>([]);
  const [selectedLlo, setSelectedLlo] = useState<LLO | null>(null);

  const [aus, setAus] = useState<AU[]>([]);
  const [selectedAuIds, setSelectedAuIds] = useState<Set<string>>(new Set());

  const [miscons, setMiscons] = useState<MisItem[]>([]);

  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingGPT, setLoadingGPT] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  // ==== helper: normalize text để chống trùng ====
  function normalizeText(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
  }

  // ==== 1. load user + courses (có phân trang) ====
  useEffect(() => {
    async function init() {
      setLoadingInit(true);
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setCourses([]);
        setLoadingInit(false);
        return;
      }

      let allCourses: Course[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("courses")
          .select("id, title, code")
          .eq("owner_id", uid)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) {
          console.error("Error loading courses:", error.message);
          break;
        }
        if (!data || data.length === 0) break;

        allCourses = allCourses.concat(data as Course[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      setCourses(allCourses);
      setLoadingInit(false);
    }

    init();
  }, []);

  // ==== 2. chọn course → load lessons ====
  async function handleSelectCourse(course: Course) {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setSelectedLlo(null);
    setLessons([]);
    setLlos([]);
    setAus([]);
    setSelectedAuIds(new Set());
    setMiscons([]);

    if (!userId) return;

    let allLessons: Lesson[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title")
        .eq("owner_id", userId)
        .eq("course_id", course.id)
        .order("order_in_course", { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        console.error("Error loading lessons:", error.message);
        break;
      }
      if (!data || data.length === 0) break;

      allLessons = allLessons.concat(data as Lesson[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    setLessons(allLessons);
  }

  // ==== 3. chọn lesson → load LLOs ====
  async function handleSelectLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setSelectedLlo(null);
    setLlos([]);
    setAus([]);
    setSelectedAuIds(new Set());
    setMiscons([]);

    if (!userId || !selectedCourse) return;

    let allLlos: LLO[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("llos")
        .select("id, code, text, bloom_suggested, level_suggested")
        .eq("owner_id", userId)
        .eq("course_id", selectedCourse.id)
        .eq("lesson_id", lesson.id)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        console.error("Error loading LLOs:", error.message);
        break;
      }
      if (!data || data.length === 0) break;

      allLlos = allLlos.concat(data as LLO[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    setLlos(allLlos);
  }

  // ==== 4. chọn LLO → load AUs ====
  async function handleSelectLlo(llo: LLO) {
    setSelectedLlo(llo);
    setAus([]);
    setSelectedAuIds(new Set());
    setMiscons([]);

    if (!userId || !selectedCourse || !selectedLesson) return;

    let allAus: AU[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("assessment_units")
        .select("id, core_statement, bloom_min")
        .eq("owner_id", userId)
        .eq("course_id", selectedCourse.id)
        .eq("lesson_id", selectedLesson.id)
        .eq("llo_id", llo.id)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        console.error("Error loading AUs:", error.message);
        break;
      }
      if (!data || data.length === 0) break;

      allAus = allAus.concat(data as AU[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    setAus(allAus);
  }

  // ==== 5. sync Mis từ DB cho các AU đang chọn ====
  async function syncMisForSelectedAus(newSelectedAuIds: Set<string>) {
    if (!userId) return;

    // Xóa các Mis tương ứng với AU không còn được chọn
    setMiscons((prev) =>
      prev.filter((m) => newSelectedAuIds.has(m.au_id))
    );

    const auIds = Array.from(newSelectedAuIds);
    if (auIds.length === 0) return;

    let allMis: MisItem[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("misconceptions")
        .select("id, au_id, description, error_type")
        .eq("owner_id", userId)
        .in("au_id", auIds)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        console.error("Error loading misconceptions:", error.message);
        break;
      }
      if (!data || data.length === 0) break;

      const batch = (data as any[]).map((m) => ({
        id: m.id as string,
        au_id: m.au_id as string,
        description: m.description as string,
        error_type: (m.error_type as string) || "conceptual",
        approved: true,
        source: "db" as const,
      }));
      allMis = allMis.concat(batch);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // giữ lại GPT Mis hiện có (thuộc AU đang chọn), + Mis DB mới
    setMiscons((prev) => {
      const gptMis = prev.filter(
        (m) => m.source === "gpt" && newSelectedAuIds.has(m.au_id)
      );
      return [...allMis, ...gptMis];
    });
  }

  // ==== 6. toggle chọn AU ====
  async function toggleAu(au: AU) {
    const newSet = new Set(selectedAuIds);
    if (newSet.has(au.id)) {
      newSet.delete(au.id);
    } else {
      newSet.add(au.id);
    }
    setSelectedAuIds(newSet);
    await syncMisForSelectedAus(newSet);
  }

  // ==== 7. Gọi GPT sinh Mis ====
  async function generateMiscon() {
    if (!selectedCourse || !selectedLesson || !selectedLlo) {
      alert("Vui lòng chọn đầy đủ Học phần, Bài học, LLO trước.");
      return;
    }
    const auIds = Array.from(selectedAuIds);
    if (auIds.length === 0) {
      alert("Vui lòng chọn ít nhất một AU để sinh Misconceptions.");
      return;
    }

    const selectedAus = aus.filter((a) => selectedAuIds.has(a.id));

    // nhóm Mis cũ theo AU (chỉ Mis từ DB)
    const existingByAu: Record<string, string[]> = {};
    miscons
      .filter((m) => m.source === "db")
      .forEach((m) => {
        const key = m.au_id;
        if (!existingByAu[key]) existingByAu[key] = [];
        existingByAu[key].push(m.description);
      });

    // dự đoán specialty_name / learner_level / bloom_level từ dữ liệu hiện có
    const specialtyName = "Y học cổ truyền"; // tạm thời hard-code, sau này có specialty table
    const learnerLevel =
      selectedLlo.level_suggested || "Sinh viên y khoa (undergrad)";
    const bloomLevel =
      selectedLlo.bloom_suggested ||
      selectedAus[0]?.bloom_min ||
      "analyze";

    setLoadingGPT(true);

    try {
      const res = await fetch("/api/miscon-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialty_name: specialtyName,
          learner_level: learnerLevel,
          bloom_level: bloomLevel,
          aus: selectedAus.map((a) => ({
            id: a.id,
            text: a.core_statement,
          })),
          existing: Object.entries(existingByAu).map(([au_id, descriptions]) => ({
            au_id,
            descriptions,
          })),
        }),
      });

      const json = await res.json();
      setLoadingGPT(false);

      if (!res.ok) {
        console.error("miscon-gen error:", json);
        alert(json.error || "Lỗi khi gọi GPT sinh Misconceptions.");
        return;
      }

      const misconceptions = json.misconceptions || [];
      if (!Array.isArray(misconceptions) || misconceptions.length === 0) {
        alert("GPT không trả về danh sách Misconceptions.");
        return;
      }

      // tạo set chống trùng từ tất cả Mis đang có (DB + GPT)
      const existingSet = new Set(
        miscons.map((m) => `${m.au_id}::${normalizeText(m.description)}`)
      );

      const newMis: MisItem[] = [];

      misconceptions.forEach((block: any) => {
        const au_id = block.au_id as string | undefined;
        const items = Array.isArray(block.items) ? block.items : [];
        if (!au_id) return;

        items.forEach((it: any) => {
          const desc = String(it.description || "").trim();
          if (!desc) return;
          const key = `${au_id}::${normalizeText(desc)}`;
          if (existingSet.has(key)) return; // bỏ trùng
          existingSet.add(key);

          newMis.push({
            au_id,
            description: desc,
            error_type: (it.error_type as string) || "conceptual",
            approved: true,
            source: "gpt",
          });
        });
      });

      if (newMis.length === 0) {
        alert("Không có Misconception mới (có thể GPT sinh trùng với Mis cũ).");
        return;
      }

      setMiscons((prev) => [...prev, ...newMis]);
    } catch (e: any) {
      console.error("Error calling /api/miscon-gen:", e);
      setLoadingGPT(false);
      alert("Lỗi kết nối khi gọi GPT sinh Misconceptions.");
    }
  }

  // ==== 8. Refine 1 Mis bằng GPT ====
  async function refineMis(index: number) {
    const item = miscons[index];
    if (!item) return;

    try {
      const res = await fetch("/api/miscon-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: item.description,
          error_type: item.error_type,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("miscon-refine error:", json);
        alert(json.error || "GPT không refine được.");
        return;
      }

      if (json.refined_description) {
        const newDesc = String(json.refined_description).trim();
        setMiscons((prev) => {
          const arr = [...prev];
          arr[index] = { ...arr[index], description: newDesc };
          return arr;
        });
      } else {
        alert("GPT không trả về refined_description.");
      }
    } catch (e: any) {
      console.error("Error calling /api/miscon-refine:", e);
      alert("Lỗi kết nối khi gọi GPT refine.");
    }
  }

  // ==== 9. Save Misconceptions về DB ====
  async function saveMiscon() {
    if (!userId) {
      alert("Chưa xác định được user. Vui lòng đăng nhập lại.");
      return;
    }

    const approvedMis = miscons.filter((m) => m.approved);
    if (approvedMis.length === 0) {
      if (!confirm("Không có Mis nào được duyệt. Bạn vẫn muốn xóa hết Mis cũ?")) {
        return;
      }
    }

    const auIds = Array.from(
      new Set(approvedMis.map((m) => m.au_id))
    );

    if (auIds.length === 0 && selectedAuIds.size === 0) {
      alert("Không có AU nào để lưu Mis.");
      return;
    }

    const targetAuIds = auIds.length > 0 ? auIds : Array.from(selectedAuIds);
    if (targetAuIds.length === 0) {
      alert("Không có AU nào được chọn để lưu.");
      return;
    }

    setSaving(true);

    try {
      // 1) delete tất cả Mis của các AU này thuộc user hiện tại
      const { error: delError } = await supabase
        .from("misconceptions")
        .delete()
        .eq("owner_id", userId)
        .in("au_id", targetAuIds);

      if (delError) {
        console.error("Error deleting misconceptions:", delError.message);
        alert("Lỗi khi xóa Misconceptions cũ.");
        setSaving(false);
        return;
      }

      // 2) insert Mis mới (approved)
      if (approvedMis.length > 0) {
        const rows = approvedMis.map((m) => ({
          au_id: m.au_id,
          owner_id: userId,
          description: m.description,
          error_type: m.error_type,
        }));

        const { error: insError } = await supabase
          .from("misconceptions")
          .insert(rows);

        if (insError) {
          console.error("Error inserting misconceptions:", insError.message);
          alert("Lỗi khi lưu Misconceptions mới.");
          setSaving(false);
          return;
        }
      }

      // Reload từ DB để bỏ sạch flag source='gpt' và sync lại
      await syncMisForSelectedAus(selectedAuIds);

      alert("Đã lưu Misconceptions!");
    } catch (e: any) {
      console.error("Save misconceptions error:", e);
      alert("Lỗi server khi lưu Misconceptions.");
    } finally {
      setSaving(false);
    }
  }

  // ==== 10. update trường trong Mis ====
  function updateMisItem(i: number, key: keyof MisItem, value: any) {
    setMiscons((prev) => {
      const arr = [...prev];
      (arr[i] as any)[key] = value;
      return arr;
    });
  }

  function removeMisItem(i: number) {
    setMiscons((prev) => prev.filter((_, idx) => idx !== i));
  }

  const selectedAusList = useMemo(
    () => aus.filter((a) => selectedAuIds.has(a.id)),
    [aus, selectedAuIds]
  );

  const totalApproved = useMemo(
    () => miscons.filter((m) => m.approved).length,
    [miscons]
  );

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50">
      {/* LEFT PANEL – Course / Lesson / LLO / AU */}
      <div className="w-96 border-r bg-white flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <div className="text-lg font-semibold">Misconcept Wizard</div>
          {loadingInit && (
            <div className="text-xs text-gray-500 mt-1">Đang tải dữ liệu…</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {/* Courses */}
          <div>
            <div className="font-semibold mb-1">Học phần (Course)</div>
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {courses.length === 0 && (
                <div className="p-2 text-gray-400 text-xs">
                  Chưa có học phần.
                </div>
              )}
              {courses.map((c) => (
                <div
                  key={c.id}
                  className={`px-2 py-1 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${
                    selectedCourse?.id === c.id
                      ? "bg-blue-50 font-medium"
                      : ""
                  }`}
                  onClick={() => handleSelectCourse(c)}
                >
                  <div className="text-sm">
                    {c.code ? `${c.code} – ${c.title}` : c.title}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lessons */}
          <div>
            <div className="font-semibold mb-1">Bài học (Lesson)</div>
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {selectedCourse == null && (
                <div className="p-2 text-gray-400 text-xs">
                  Chọn Học phần trước.
                </div>
              )}
              {selectedCourse != null && lessons.length === 0 && (
                <div className="p-2 text-gray-400 text-xs">
                  Học phần chưa có bài học nào.
                </div>
              )}
              {lessons.map((l) => (
                <div
                  key={l.id}
                  className={`px-2 py-1 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${
                    selectedLesson?.id === l.id
                      ? "bg-blue-50 font-medium"
                      : ""
                  }`}
                  onClick={() => handleSelectLesson(l)}
                >
                  {l.title}
                </div>
              ))}
            </div>
          </div>

          {/* LLOs */}
          <div>
            <div className="font-semibold mb-1">LLOs</div>
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {selectedLesson == null && (
                <div className="p-2 text-gray-400 text-xs">
                  Chọn Bài học trước.
                </div>
              )}
              {selectedLesson != null && llos.length === 0 && (
                <div className="p-2 text-gray-400 text-xs">
                  Bài học chưa có LLO nào.
                </div>
              )}
              {llos.map((llo) => (
                <div
                  key={llo.id}
                  className={`px-2 py-1 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${
                    selectedLlo?.id === llo.id
                      ? "bg-blue-50 font-medium"
                      : ""
                  }`}
                  onClick={() => handleSelectLlo(llo)}
                >
                  <div className="text-xs text-gray-500">
                    {llo.code || "LLO"}
                  </div>
                  <div className="text-sm line-clamp-2">{llo.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AUs */}
          <div>
            <div className="font-semibold mb-1">
              Assessment Units (AU) – tick để sinh Mis
            </div>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {selectedLlo == null && (
                <div className="p-2 text-gray-400 text-xs">
                  Chọn LLO trước.
                </div>
              )}
              {selectedLlo != null && aus.length === 0 && (
                <div className="p-2 text-gray-400 text-xs">
                  LLO chưa có Assessment Unit nào.
                </div>
              )}
              {aus.map((a) => (
                <label
                  key={a.id}
                  className="flex items-start gap-2 px-2 py-1 border-b last:border-b-0 text-sm cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedAuIds.has(a.id)}
                    onChange={() => toggleAu(a)}
                  />
                  <div>
                    <div className="font-medium line-clamp-3">
                      {a.core_statement}
                    </div>
                    {a.bloom_min && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Bloom: {a.bloom_min}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN PANEL – Mis list */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {!selectedCourse && (
          <div className="text-gray-500 text-center mt-20">
            Chọn một Học phần ở panel trái để bắt đầu.
          </div>
        )}

        {selectedCourse && (
          <>
            <div className="flex flex-wrap gap-2 items-center mb-4 text-sm text-gray-600">
              <div>
                <span className="font-semibold">Course:</span>{" "}
                {selectedCourse.code
                  ? `${selectedCourse.code} – ${selectedCourse.title}`
                  : selectedCourse.title}
              </div>
              {selectedLesson && (
                <div>
                  <span className="font-semibold">Lesson:</span>{" "}
                  {selectedLesson.title}
                </div>
              )}
              {selectedLlo && (
                <div className="max-w-[50%]">
                  <span className="font-semibold">LLO:</span>{" "}
                  <span className="line-clamp-1">{selectedLlo.text}</span>
                </div>
              )}
            </div>

            {/* Header + nút GPT */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-lg font-bold">
                Misconceptions cho AU đã chọn
              </div>

              <button
                onClick={generateMiscon}
                disabled={
                  loadingGPT ||
                  !selectedCourse ||
                  !selectedLesson ||
                  !selectedLlo ||
                  selectedAuIds.size === 0
                }
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingGPT ? "Đang sinh Mis..." : "Sinh Misconceptions (GPT)"}
              </button>
            </div>

            {/* List AU đang chọn + Mis đã có */}
            {selectedAusList.length > 0 && (
              <div className="mb-4 text-xs text-gray-600">
                <div className="font-semibold mb-1">
                  AU đã tick ({selectedAusList.length}):
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {selectedAusList.map((a) => (
                    <li key={a.id} className="line-clamp-1">
                      {a.core_statement}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* MISCON LIST */}
            <div className="mt-2 space-y-4">
              {miscons.length === 0 && (
                <div className="text-gray-400 text-sm mt-6">
                  Chưa có Misconception nào cho các AU đã chọn.
                  <br />
                  • Nếu đã lưu trước đây, hãy đảm bảo bạn đã tick đúng AU.
                  <br />
                  • Hoặc bấm nút “Sinh Misconceptions (GPT)” để tạo mới.
                </div>
              )}

              {miscons.map((m, i) => {
                const au = aus.find((a) => a.id === m.au_id);
                return (
                  <div
                    key={`${m.au_id}-${m.id ?? "tmp"}-${i}`}
                    className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
                  >
                    {/* AU label */}
                    {au && (
                      <div className="text-xs text-gray-500 mb-1">
                        AU:{" "}
                        <span className="font-medium line-clamp-1">
                          {au.core_statement}
                        </span>
                      </div>
                    )}

                    <textarea
                      className="w-full border rounded-lg p-2 text-sm"
                      rows={3}
                      value={m.description}
                      onChange={(e) =>
                        updateMisItem(i, "description", e.target.value)
                      }
                    />

                    <div className="flex justify-between items-center mt-2">
                      <div className="flex gap-3 items-center">
                        <select
                          value={m.error_type}
                          onChange={(e) =>
                            updateMisItem(i, "error_type", e.target.value)
                          }
                          className="border rounded-lg px-3 py-1 text-xs"
                        >
                          <option value="conceptual">Conceptual</option>
                          <option value="procedural">Procedural</option>
                          <option value="bias">Cognitive Bias</option>
                          <option value="clinical_reasoning">
                            Clinical reasoning
                          </option>
                          <option value="terminology">Terminology</option>
                        </select>

                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={m.approved}
                            onChange={(e) =>
                              updateMisItem(i, "approved", e.target.checked)
                            }
                          />
                          Duyệt
                        </label>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            m.source === "db"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          }`}
                        >
                          {m.source === "db" ? "Đã lưu" : "GPT mới"}
                        </span>
                      </div>

                      <div className="flex gap-3 items-center text-xs">
                        <button
                          onClick={() => refineMis(i)}
                          className="text-blue-600 hover:underline"
                        >
                          Refine by GPT
                        </button>
                        <button
                          onClick={() => removeMisItem(i)}
                          className="text-red-500 hover:underline"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* RIGHT PANEL – Stats + Save */}
      <div className="w-72 border-l bg-white p-4 flex flex-col">
        <div className="text-lg font-semibold mb-4">Tác vụ</div>

        <div className="mb-4 text-sm text-gray-700 space-y-1">
          <div>Tổng AU trong LLO: {aus.length}</div>
          <div>AU đã tick: {selectedAuIds.size}</div>
          <div>Tổng Mis: {miscons.length}</div>
          <div>Đã duyệt: {totalApproved}</div>
        </div>

        <button
          onClick={saveMiscon}
          disabled={saving || !userId || selectedAuIds.size === 0}
          className="bg-green-600 w-full text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Đang lưu…" : "Lưu Misconceptions"}
        </button>

        <div className="mt-4 text-[11px] text-gray-500">
          • Mis đã lưu trước đó sẽ tự động hiển thị khi bạn chọn đúng Course →
          Lesson → LLO → AU.
          <br />
          • GPT sẽ được yêu cầu **không sinh trùng** với các Mis đã lưu, và
          client cũng lọc trùng lần nữa.
        </div>
      </div>
    </div>
  );
}
