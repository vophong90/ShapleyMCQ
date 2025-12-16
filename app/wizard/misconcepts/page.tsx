"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  id?: string; // id trong bảng misconceptions (nếu có)
  au_id: string; // FK tới assessment_units.id
  description: string;
  error_type: string;
  approved: boolean;
  source: "db" | "gpt"; // để phân biệt Mis cũ và Mis mới
};

const PAGE = 1000;

// ✅ Routes điều hướng step
const STEP2_PATH = "/wizard/au";
const STEP4_PATH = "/wizard/mcq"; // <-- nếu step 4 của bạn khác, sửa tại đây

export default function MisconceptWizard() {
  const router = useRouter();

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
  async function handleSelectCourse(course: Course | null) {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setSelectedLlo(null);
    setLessons([]);
    setLlos([]);
    setAus([]);
    setSelectedAuIds(new Set());
    setMiscons([]);

    if (!course || !userId) return;

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
  async function handleSelectLesson(lesson: Lesson | null) {
    setSelectedLesson(lesson);
    setSelectedLlo(null);
    setLlos([]);
    setAus([]);
    setSelectedAuIds(new Set());
    setMiscons([]);

    if (!userId || !selectedCourse || !lesson) return;

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
  async function handleSelectLlo(llo: LLO | null) {
    setSelectedLlo(llo);
    setAus([]);
    setSelectedAuIds(new Set());
    setMiscons([]);

    if (!userId || !selectedCourse || !selectedLesson || !llo) return;

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

    // Xóa Mis của AU không còn được chọn khỏi state
    setMiscons((prev) => prev.filter((m) => newSelectedAuIds.has(m.au_id)));

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

    // dự đoán specialty_name / learner_level / bloom_level
    const specialtyName = "Y học cổ truyền"; // tạm thời hard-code
    const learnerLevel =
      selectedLlo.level_suggested || "Sinh viên y khoa (undergrad)";
    const bloomLevel =
      selectedLlo.bloom_suggested || selectedAus[0]?.bloom_min || "analyze";

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
          existing: Object.entries(existingByAu).map(
            ([au_id, descriptions]) => ({
              au_id,
              descriptions,
            })
          ),
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
      if (
        !confirm(
          "Không có Mis nào được duyệt. Bạn vẫn muốn xóa hết Mis cũ của các AU đã chọn?"
        )
      ) {
        return;
      }
    }

    const auIds = Array.from(new Set(approvedMis.map((m) => m.au_id)));

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

  // Tách Mis theo nguồn
  const dbMiscons = useMemo(
    () => miscons.filter((m) => m.source === "db"),
    [miscons]
  );

  const gptMiscons = useMemo(
    () => miscons.filter((m) => m.source === "gpt"),
    [miscons]
  );

  // ✅ Footer actions
  function handleBackStep2() {
    router.push(STEP2_PATH);
  }

  function handleContinueStep4() {
    // giữ logic “an toàn” tối thiểu giống kiểu Step 2: phải có dữ liệu chính
    if (!selectedCourse || !selectedLesson || !selectedLlo) {
      alert("Vui lòng chọn đầy đủ Học phần, Bài học, LLO trước khi tiếp tục.");
      return;
    }
    if (selectedAuIds.size === 0) {
      alert("Vui lòng tick ít nhất 1 AU trước khi tiếp tục.");
      return;
    }
    if (totalApproved === 0) {
      alert("Chưa có Mis nào được duyệt. Vui lòng duyệt (tick) ít nhất 1 Mis hoặc lưu Mis trước khi tiếp tục.");
      return;
    }
    router.push(STEP4_PATH);
  }

  // ====== UI ======
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Bước 3 – Misconceptions
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Chọn Học phần → Bài học → LLO → AU, sau đó dùng GPT để sinh các
            Misconceptions. Bạn có thể chỉnh sửa, duyệt hoặc xoá từng Mis trước
            khi lưu xuống Supabase.
          </p>
        </div>

        {loadingInit && (
          <div className="text-xs text-slate-500">
            Đang tải danh sách Học phần…
          </div>
        )}
      </div>

      {/* Card 1: Chọn Học phần / Bài học */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="text-xs font-semibold text-slate-700 mb-1">
          Chọn Học phần &amp; Bài học
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          {/* Course */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Học phần (Course)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              value={selectedCourse?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const c = courses.find((cc) => cc.id === id) || null;
                handleSelectCourse(c);
              }}
            >
              <option value="">-- Chọn Học phần --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} – ${c.title}` : c.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Danh sách lấy từ các Học phần mà bạn sở hữu.
            </p>
          </div>

          {/* Lesson */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Bài học (Lesson)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:bg-slate-50"
              value={selectedLesson?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const l = lessons.find((ll) => ll.id === id) || null;
                handleSelectLesson(l);
              }}
              disabled={!selectedCourse}
            >
              <option value="">
                {selectedCourse ? "-- Chọn Bài học --" : "Chọn Học phần trước"}
              </option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Sau khi chọn Bài học, danh sách LLO và AU sẽ được tải bên dưới.
            </p>
          </div>
        </div>
      </div>

      {/* Card 2: LLO & AU */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <div className="text-xs font-semibold text-slate-700">
            LLO &amp; Assessment Units
          </div>
          {selectedLlo && (
            <div className="text-[11px] text-slate-500 max-w-[60%]">
              <span className="font-semibold text-slate-700">LLO: </span>
              <span className="line-clamp-1">{selectedLlo.text}</span>
            </div>
          )}
        </div>

        {/* LLO select */}
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Learning Outcomes (LLO)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:bg-slate-50"
              value={selectedLlo?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const llo = llos.find((x) => x.id === id) || null;
                handleSelectLlo(llo);
              }}
              disabled={!selectedLesson}
            >
              <option value="">
                {selectedLesson ? "-- Chọn LLO --" : "Chọn Bài học trước"}
              </option>
              {llos.map((llo) => (
                <option key={llo.id} value={llo.id}>
                  {llo.code ? `${llo.code} – ${llo.text}` : llo.text}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              LLO được lấy từ bước 1. Mỗi LLO có thể gắn với nhiều AU.
            </p>
          </div>

          {/* AU list + ticks */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Assessment Units (tick AU cần sinh Mis)
            </label>
            <div className="border rounded-lg max-h-44 overflow-y-auto text-xs">
              {!selectedLlo && (
                <div className="p-2 text-slate-400">Chọn LLO để hiển thị AU.</div>
              )}
              {selectedLlo && aus.length === 0 && (
                <div className="p-2 text-slate-400">
                  LLO này chưa có Assessment Unit nào.
                </div>
              )}
              {aus.map((a) => (
                <label
                  key={a.id}
                  className="flex items-start gap-2 px-2 py-1 border-b last:border-b-0 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedAuIds.has(a.id)}
                    onChange={() => toggleAu(a)}
                  />
                  <div>
                    <div className="font-medium line-clamp-2 text-slate-800">
                      {a.core_statement}
                    </div>
                    {a.bloom_min && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Bloom tối thiểu: {a.bloom_min}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              GPT sẽ chỉ sinh Misconceptions cho các AU được tick.
            </p>
          </div>
        </div>
      </div>

      {/* Card 3: AU đã chọn + nút GPT */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-700">
              AU đã tick để sinh Misconceptions
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kiểm tra lại danh sách AU cốt lõi, sau đó bấm nút GPT để sinh
              Misconceptions gợi ý.
            </p>
          </div>
          <button
            type="button"
            onClick={generateMiscon}
            disabled={
              loadingGPT ||
              !selectedCourse ||
              !selectedLesson ||
              !selectedLlo ||
              selectedAuIds.size === 0
            }
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingGPT ? "Đang sinh Mis..." : "Sinh Misconceptions (GPT)"}
          </button>
        </div>

        {selectedAusList.length > 0 ? (
          <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-slate-700">
            {selectedAusList.map((a) => (
              <li key={a.id} className="line-clamp-1">
                {a.core_statement}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-slate-400">
            Chưa có AU nào được tick. Vui lòng chọn AU ở card phía trên.
          </p>
        )}
      </div>

      {/* Card 4: Danh sách Misconceptions – tách DB vs GPT */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-5">
        {/* Header chung */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-slate-700">
              Danh sách Misconceptions
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Mis đã lưu (từ Supabase) và Mis mới sinh từ GPT được tách thành
              hai vùng riêng để dễ soát lại. Bạn vẫn có thể chỉnh sửa, duyệt,
              refine hoặc xoá trước khi lưu.
            </p>
          </div>
          <div className="text-[11px] text-slate-500 text-right">
            Tổng:{" "}
            <span className="font-semibold text-slate-800">{miscons.length}</span>{" "}
            Mis (Đã duyệt:{" "}
            <span className="font-semibold text-emerald-700">{totalApproved}</span>)
          </div>
        </div>

        {/* Sub-card 4.1: Mis đã lưu từ Supabase (DB) */}
        <div className="border rounded-2xl p-4 bg-slate-50/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-700">
                Misconceptions đã lưu trong Supabase
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Đây là các Mis đã được lưu trước đó trong bảng{" "}
                <code className="text-[10px] bg-white px-1 rounded">
                  misconceptions
                </code>{" "}
                (source = &quot;db&quot;). Bạn có thể chỉnh sửa lại, đổi loại
                lỗi, tick duyệt hoặc xoá.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 text-right">
              DB Mis:{" "}
              <span className="font-semibold text-slate-800">{dbMiscons.length}</span>
            </div>
          </div>

          {dbMiscons.length === 0 && (
            <div className="text-[11px] text-slate-400">
              Chưa có Mis nào được lưu cho các AU đã chọn.
            </div>
          )}

          <div className="space-y-4">
            {dbMiscons.map((m) => {
              const globalIndex = miscons.indexOf(m);
              if (globalIndex === -1) return null;

              const au = aus.find((a) => a.id === m.au_id);
              return (
                <div
                  key={`${m.au_id}-${m.id ?? "db"}-${globalIndex}`}
                  className="p-4 bg-white rounded-2xl border border-slate-200"
                >
                  {au && (
                    <div className="text-[11px] text-slate-500 mb-1">
                      AU:{" "}
                      <span className="font-medium line-clamp-1 text-slate-800">
                        {au.core_statement}
                      </span>
                    </div>
                  )}

                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    rows={3}
                    value={m.description}
                    onChange={(e) =>
                      updateMisItem(globalIndex, "description", e.target.value)
                    }
                  />

                  <div className="flex flex-wrap justify-between items-center mt-2 gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <select
                        value={m.error_type}
                        onChange={(e) =>
                          updateMisItem(globalIndex, "error_type", e.target.value)
                        }
                        className="border rounded-lg px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                      >
                        <option value="conceptual">Conceptual</option>
                        <option value="procedural">Procedural</option>
                        <option value="bias">Cognitive bias</option>
                        <option value="clinical_reasoning">Clinical reasoning</option>
                        <option value="terminology">Terminology</option>
                      </select>

                      <label className="flex items-center gap-1 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={m.approved}
                          onChange={(e) =>
                            updateMisItem(globalIndex, "approved", e.target.checked)
                          }
                        />
                        Duyệt
                      </label>

                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
                        Đã lưu (DB)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => refineMis(globalIndex)}
                        className="text-brand-700 hover:underline"
                      >
                        Refine bằng GPT
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMisItem(globalIndex)}
                        className="text-rose-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-card 4.2: Mis mới sinh từ GPT (source = "gpt") */}
        <div className="border rounded-2xl p-4 bg-indigo-50/40 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-700">
                Misconceptions mới sinh từ GPT (chưa lưu)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Đây là các Mis GPT vừa sinh (source = &quot;gpt&quot;). Sau khi
                chỉnh sửa, tick “Duyệt” và bấm “Lưu Misconceptions”, các Mis
                được duyệt sẽ được ghi xuống Supabase và lần load lại sau sẽ
                nằm ở card “Misconceptions đã lưu trong Supabase”.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 text-right">
              GPT Mis:{" "}
              <span className="font-semibold text-slate-800">{gptMiscons.length}</span>
            </div>
          </div>

          {gptMiscons.length === 0 && (
            <div className="text-[11px] text-slate-400">
              Chưa có Mis mới từ GPT. Bấm “Sinh Misconceptions (GPT)” ở card
              phía trên để tạo gợi ý mới.
            </div>
          )}

          <div className="space-y-4">
            {gptMiscons.map((m) => {
              const globalIndex = miscons.indexOf(m);
              if (globalIndex === -1) return null;

              const au = aus.find((a) => a.id === m.au_id);
              return (
                <div
                  key={`${m.au_id}-${m.id ?? "gpt"}-${globalIndex}`}
                  className="p-4 bg-white rounded-2xl border border-indigo-200"
                >
                  {au && (
                    <div className="text-[11px] text-slate-500 mb-1">
                      AU:{" "}
                      <span className="font-medium line-clamp-1 text-slate-800">
                        {au.core_statement}
                      </span>
                    </div>
                  )}

                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                    rows={3}
                    value={m.description}
                    onChange={(e) =>
                      updateMisItem(globalIndex, "description", e.target.value)
                    }
                  />

                  <div className="flex flex-wrap justify-between items-center mt-2 gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <select
                        value={m.error_type}
                        onChange={(e) =>
                          updateMisItem(globalIndex, "error_type", e.target.value)
                        }
                        className="border rounded-lg px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
                      >
                        <option value="conceptual">Conceptual</option>
                        <option value="procedural">Procedural</option>
                        <option value="bias">Cognitive bias</option>
                        <option value="clinical_reasoning">Clinical reasoning</option>
                        <option value="terminology">Terminology</option>
                      </select>

                      <label className="flex items-center gap-1 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={m.approved}
                          onChange={(e) =>
                            updateMisItem(globalIndex, "approved", e.target.checked)
                          }
                        />
                        Duyệt
                      </label>

                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                        GPT mới
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => refineMis(globalIndex)}
                        className="text-brand-700 hover:underline"
                      >
                        Refine bằng GPT
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMisItem(globalIndex)}
                        className="text-rose-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card 5: Tóm tắt & Lưu */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="space-y-1 text-slate-700">
          <div>
            <span className="font-semibold">Tổng AU trong LLO:</span> {aus.length}
          </div>
          <div>
            <span className="font-semibold">AU đã tick:</span> {selectedAuIds.size}
          </div>
          <div>
            <span className="font-semibold">Tổng Mis:</span> {miscons.length}
          </div>
          <div>
            <span className="font-semibold">Đã duyệt:</span> {totalApproved}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveMiscon}
            disabled={saving || !userId || selectedAuIds.size === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Đang lưu…" : "Lưu Misconceptions"}
          </button>
        </div>
      </div>

      {/* ✅ Footer nav (Back Step 2 / Continue Step 4) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBackStep2}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700"
          >
            ← Quay lại Bước 2
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleContinueStep4}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              Tiếp tục → Bước 4
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
