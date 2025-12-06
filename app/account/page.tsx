"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
};

type Course = {
  id: string;
  title: string;
  code: string | null;
};

type Lesson = {
  id: string;
  course_id: string;
  title: string;
};

type Llo = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  code: string | null;
  text: string;
  bloom_suggested: string | null;
};

type McqItem = {
  id: string;
  stem: string;
  course_id: string | null;
  llo_ids: string[] | null;
  status: string | null;
  created_at: string;
};

type SearchProfile = {
  id: string;
  email: string | null;
  name: string | null;
};

type ReceivedShare = {
  id: string;
  created_at: string;
  mcq_item_id: string;
  mcq_stem: string;
  from_user_name: string | null;
  from_user_email: string | null;
};

type TabKey = "bank" | "share";

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [activeTab, setActiveTab] = useState<TabKey>("bank");

  // Shared selection state giữa 2 tab
  const [selectedMcqIds, setSelectedMcqIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    async function loadProfile() {
      setLoadingProfile(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      } else {
        setProfile(null);
      }

      setLoadingProfile(false);
    }

    loadProfile();
  }, []);

  function toggleSelectMcq(id: string) {
    setSelectedMcqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedMcqIds(new Set());
  }

  if (loadingProfile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p>Đang tải tài khoản...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold mb-2">Tài khoản</h1>
        <p className="text-sm text-slate-600">
          Bạn cần đăng nhập để sử dụng chức năng Ngân hàng MCQ và Chia sẻ câu hỏi.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tài khoản</h1>
          <p className="text-sm text-slate-600 mt-1">
            Quản lý Ngân hàng MCQ, chia sẻ và nhận câu hỏi từ đồng nghiệp.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div className="font-medium text-slate-700">
            {profile.name || profile.email}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("bank")}
          className={`pb-2 px-1 -mb-px border-b-2 ${
            activeTab === "bank"
              ? "border-brand-600 text-brand-600 font-medium"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Ngân hàng MCQ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("share")}
          className={`pb-2 px-1 -mb-px border-b-2 ${
            activeTab === "share"
              ? "border-brand-600 text-brand-600 font-medium"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Chia sẻ / Nhận MCQ
        </button>
      </div>

      {/* Nội dung tab */}
      {activeTab === "bank" ? (
        <MyMcqBankTab
          profileId={profile.id}
          selectedMcqIds={selectedMcqIds}
          onToggleSelect={toggleSelectMcq}
          onClearSelection={clearSelection}
        />
      ) : (
        <ShareReceiveTab
          profile={profile}
          selectedMcqIds={selectedMcqIds}
          onSharedSuccessfully={clearSelection}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 1 – NGÂN HÀNG MCQ                                              */
/* ------------------------------------------------------------------ */

type MyMcqBankTabProps = {
  profileId: string;
  selectedMcqIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
};

function MyMcqBankTab({
  profileId,
  selectedMcqIds,
  onToggleSelect,
  onClearSelection,
}: MyMcqBankTabProps) {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [llos, setLlos] = useState<Llo[]>([]);
  const [mcqs, setMcqs] = useState<McqItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string | "">("");
  const [selectedLessonId, setSelectedLessonId] = useState<string | "">("");
  const [selectedLloId, setSelectedLloId] = useState<string | "">("");
  const [searchStem, setSearchStem] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const { data: courseRows, error: courseErr } = await supabase
          .from("courses")
          .select("id, title, code")
          .order("title", { ascending: true });

        if (courseErr) throw courseErr;

        const { data: lessonRows, error: lessonErr } = await supabase
          .from("lessons")
          .select("id, course_id, title")
          .eq("owner_id", profileId)
          .order("order_in_course", { ascending: true });

        if (lessonErr) throw lessonErr;

        const { data: lloRows, error: lloErr } = await supabase
          .from("llos")
          .select(
            "id, course_id, lesson_id, code, text, bloom_suggested"
          )
          .eq("owner_id", profileId)
          .order("code", { ascending: true });

        if (lloErr) throw lloErr;

        const { data: mcqRows, error: mcqErr } = await supabase
          .from("mcq_items")
          .select("id, stem, course_id, llo_ids, status, created_at")
          .eq("owner_id", profileId)
          .order("created_at", { ascending: false });

        if (mcqErr) throw mcqErr;

        setCourses((courseRows || []) as Course[]);
        setLessons((lessonRows || []) as Lesson[]);
        setLlos((lloRows || []) as Llo[]);
        setMcqs((mcqRows || []) as McqItem[]);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Không tải được dữ liệu ngân hàng MCQ.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profileId]);

  const filteredLessons = useMemo(() => {
    if (!selectedCourseId) return lessons;
    return lessons.filter((l) => l.course_id === selectedCourseId);
  }, [lessons, selectedCourseId]);

  const filteredLlos = useMemo(() => {
    let list = llos;
    if (selectedCourseId) {
      list = list.filter((l) => l.course_id === selectedCourseId);
    }
    if (selectedLessonId) {
      list = list.filter((l) => l.lesson_id === selectedLessonId);
    }
    return list;
  }, [llos, selectedCourseId, selectedLessonId]);

  const llosById = useMemo(() => {
    const map = new Map<string, Llo>();
    llos.forEach((l) => map.set(l.id, l));
    return map;
  }, [llos]);

  const coursesById = useMemo(() => {
    const map = new Map<string, Course>();
    courses.forEach((c) => map.set(c.id, c));
    return map;
  }, [courses]);

  const filteredMcqs = useMemo(() => {
    let list = mcqs;

    if (selectedCourseId) {
      list = list.filter((m) => m.course_id === selectedCourseId);
    }

    if (selectedLessonId) {
      const lessonLloIds = new Set(
        llos
          .filter(
            (l) =>
              l.course_id === selectedCourseId &&
              l.lesson_id === selectedLessonId
          )
          .map((l) => l.id)
      );

      list = list.filter((m) => {
        const ids = m.llo_ids || [];
        return ids.some((id) => lessonLloIds.has(id));
      });
    }

    if (selectedLloId) {
      list = list.filter((m) => (m.llo_ids || []).includes(selectedLloId));
    }

    if (searchStem.trim()) {
      const q = searchStem.toLowerCase();
      list = list.filter((m) => m.stem.toLowerCase().includes(q));
    }

    return list;
  }, [
    mcqs,
    selectedCourseId,
    selectedLessonId,
    selectedLloId,
    searchStem,
    llos,
  ]);

  const selectedCount = selectedMcqIds.size;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-3">
          Ngân hàng MCQ của tôi ({mcqs.length})
        </h2>

        {/* Bộ lọc */}
        <div className="grid md:grid-cols-4 gap-3 mb-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Học phần</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value || "");
                setSelectedLessonId("");
                setSelectedLloId("");
              }}
            >
              <option value="">Tất cả</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} – ${c.title}` : c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Bài học</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={selectedLessonId}
              onChange={(e) => {
                setSelectedLessonId(e.target.value || "");
                setSelectedLloId("");
              }}
            >
              <option value="">Tất cả</option>
              {filteredLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">LLO</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={selectedLloId}
              onChange={(e) => setSelectedLloId(e.target.value || "")}
            >
              <option value="">Tất cả</option>
              {filteredLlos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code ? `${l.code} – ${l.text}` : l.text}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Tìm theo stem</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Nhập từ khoá trong stem..."
              value={searchStem}
              onChange={(e) => setSearchStem(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs mb-2">
          <div className="text-slate-500">
            Đang hiển thị{" "}
            <span className="font-semibold text-slate-700">
              {filteredMcqs.length}
            </span>{" "}
            câu hỏi.
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Đã chọn{" "}
              <span className="font-semibold text-slate-700">
                {selectedCount}
              </span>{" "}
              câu để chia sẻ.
            </span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[11px] text-slate-500 hover:text-red-500"
              >
                Bỏ chọn
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Đang tải MCQ...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredMcqs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Không có câu hỏi nào phù hợp bộ lọc hiện tại.
          </p>
        ) : (
          <div className="border border-slate-100 rounded-xl max-h-[480px] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left text-slate-500">
                  <th className="py-2 pl-3 pr-2 w-8">
                    <span className="sr-only">Chọn</span>
                  </th>
                  <th className="py-2 pr-3">Stem</th>
                  <th className="py-2 pr-3 w-32">Học phần</th>
                  <th className="py-2 pr-3 w-28">LLO</th>
                  <th className="py-2 pr-3 w-20">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredMcqs.map((m) => {
                  const isSelected = selectedMcqIds.has(m.id);
                  const course = m.course_id
                    ? coursesById.get(m.course_id)
                    : null;
                  const firstLlo =
                    (m.llo_ids && llosById.get(m.llo_ids[0])) || null;

                  return (
                    <tr
                      key={m.id}
                      className={`border-t border-slate-100 ${
                        isSelected ? "bg-emerald-50/40" : "bg-white"
                      }`}
                    >
                      <td className="py-2 pl-3 pr-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          checked={isSelected}
                          onChange={() => onToggleSelect(m.id)}
                        />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <div className="line-clamp-2 text-[11px] text-slate-800">
                          {m.stem}
                        </div>
                      </td>
                      <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                        {course
                          ? course.code
                            ? `${course.code}`
                            : course.title
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                        {firstLlo
                          ? firstLlo.code || firstLlo.text.slice(0, 14) + "…"
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                        {m.status || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Gợi ý: Chọn các MCQ cần gửi, sau đó chuyển sang tab{" "}
        <span className="font-semibold">“Chia sẻ / Nhận MCQ”</span> để nhập
        email đồng nghiệp và gửi.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TAB 2 – CHIA SẺ / NHẬN MCQ                                         */
/* ------------------------------------------------------------------ */

type ShareReceiveTabProps = {
  profile: Profile;
  selectedMcqIds: Set<string>;
  onSharedSuccessfully: () => void;
};

function ShareReceiveTab({
  profile,
  selectedMcqIds,
  onSharedSuccessfully,
}: ShareReceiveTabProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchProfile | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [receivedLoading, setReceivedLoading] = useState(false);
  const [received, setReceived] = useState<ReceivedShare[]>([]);

  const selectedCount = selectedMcqIds.size;

  // Load MCQ được share cho mình
  useEffect(() => {
    async function loadReceived() {
      setReceivedLoading(true);
      setError(null);

      try {
        const { data: shareRows, error: shareErr } = await supabase
          .from("mcq_item_shares")
          .select("id, created_at, mcq_item_id, from_user_id")
          .eq("to_user_id", profile.id)
          .order("created_at", { ascending: false });

        if (shareErr) throw shareErr;

        const rows = shareRows || [];

        if (!rows.length) {
          setReceived([]);
          setReceivedLoading(false);
          return;
        }

        const mcqIds = Array.from(
          new Set(rows.map((r: any) => r.mcq_item_id))
        );
        const fromUserIds = Array.from(
          new Set(rows.map((r: any) => r.from_user_id))
        );

        const [{ data: mcqRows, error: mcqErr }, { data: userRows, error: userErr }] =
          await Promise.all([
            supabase
              .from("mcq_items")
              .select("id, stem")
              .in("id", mcqIds),
            supabase
              .from("profiles")
              .select("id, name, email")
              .in("id", fromUserIds),
          ]);

        if (mcqErr) throw mcqErr;
        if (userErr) throw userErr;

        const mcqMap = new Map<string, { id: string; stem: string }>();
        (mcqRows || []).forEach((m: any) =>
          mcqMap.set(m.id, { id: m.id, stem: m.stem })
        );

        const userMap = new Map<
          string,
          { id: string; name: string | null; email: string | null }
        >();
        (userRows || []).forEach((u: any) =>
          userMap.set(u.id, {
            id: u.id,
            name: u.name,
            email: u.email,
          })
        );

        const receivedList: ReceivedShare[] = rows.map((r: any) => {
          const mcq = mcqMap.get(r.mcq_item_id);
          const u = userMap.get(r.from_user_id);
          return {
            id: r.id,
            created_at: r.created_at,
            mcq_item_id: r.mcq_item_id,
            mcq_stem: mcq?.stem || "(Không tìm thấy stem)",
            from_user_name: u?.name ?? null,
            from_user_email: u?.email ?? null,
          };
        });

        setReceived(receivedList);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Không tải được danh sách MCQ nhận được.");
      } finally {
        setReceivedLoading(false);
      }
    }

    loadReceived();
  }, [profile.id]);

  async function handleSearchEmail() {
    setSearching(true);
    setError(null);
    setMessage(null);
    setSelectedUser(null);
    setSearchResults([]);

    try {
      const q = searchEmail.trim();
      if (!q) {
        setSearching(false);
        return;
      }

      const { data, error: searchErr } = await supabase
        .from("profiles")
        .select("id, email, name")
        .ilike("email", `%${q}%`)
        .neq("id", profile.id)
        .limit(10);

      if (searchErr) throw searchErr;

      setSearchResults((data || []) as SearchProfile[]);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Lỗi khi tìm user theo email.");
    } finally {
      setSearching(false);
    }
  }

  async function handleShare() {
    setShareLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!selectedUser) {
        throw new Error("Bạn chưa chọn người nhận.");
      }
      if (!selectedCount) {
        throw new Error("Bạn chưa chọn câu hỏi nào trong Ngân hàng MCQ.");
      }

      const mcqArray = Array.from(selectedMcqIds);

      const res = await fetch("/api/mcq/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${profile.id}`,
        },
        body: JSON.stringify({
          to_profile_id: selectedUser.id,
          mcq_item_ids: mcqArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi khi chia sẻ MCQ (API).");
      }

      setMessage(
        data.message ||
          `Đã gửi ${mcqArray.length} câu hỏi tới ${
            selectedUser.email || selectedUser.name
          }.`
      );
      onSharedSuccessfully();
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Lỗi khi chia sẻ MCQ.");
    } finally {
      setShareLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Khối gửi MCQ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold">Gửi MCQ cho đồng nghiệp</h2>

        <div className="text-xs text-slate-600 mb-1">
          Bạn đang chọn{" "}
          <span className="font-semibold text-slate-800">
            {selectedCount}
          </span>{" "}
          câu trong Ngân hàng MCQ. Chọn người nhận bằng email và nhấn{" "}
          <span className="font-semibold">Gửi MCQ</span>.
        </div>

        <div className="flex flex-col sm:flex-row gap-2 text-sm">
          <input
            type="email"
            placeholder="Nhập email đồng nghiệp..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSearchEmail}
            disabled={searching}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            {searching ? "Đang tìm..." : "Tìm user"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="border border-slate-100 rounded-xl max-h-40 overflow-auto text-xs">
            {searchResults.map((u) => {
              const isActive = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setSelectedUser((prev) => (prev?.id === u.id ? null : u))
                  }
                  className={`w-full text-left px-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 ${
                    isActive ? "bg-emerald-50/60" : ""
                  }`}
                >
                  <div className="font-medium text-slate-800">
                    {u.name || u.email}
                  </div>
                  <div className="text-[11px] text-slate-500">{u.email}</div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-2">
          <div className="text-slate-500">
            Người nhận:{" "}
            {selectedUser ? (
              <span className="font-semibold text-slate-800">
                {selectedUser.name || selectedUser.email}
              </span>
            ) : (
              <span className="italic text-slate-400">
                chưa chọn người nhận
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleShare}
            disabled={shareLoading || !selectedCount || !selectedUser}
            className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {shareLoading ? "Đang gửi..." : "Gửi MCQ"}
          </button>
        </div>

        {message && (
          <div className="text-xs text-emerald-600 mt-1">{message}</div>
        )}
        {error && (
          <div className="text-xs text-red-600 mt-1">{error}</div>
        )}
      </div>

      {/* Khối MCQ nhận được */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-2">
          MCQ đồng nghiệp đã chia sẻ cho bạn
        </h2>

        {receivedLoading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : received.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có câu hỏi nào được chia sẻ cho bạn.
          </p>
        ) : (
          <div className="border border-slate-100 rounded-xl max-h-[360px] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left text-slate-500">
                  <th className="py-2 pl-3 pr-2">Stem</th>
                  <th className="py-2 pr-2 w-40">Từ</th>
                  <th className="py-2 pr-3 w-36">Ngày nhận</th>
                </tr>
              </thead>
              <tbody>
                {received.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 bg-white"
                  >
                    <td className="py-2 pl-3 pr-2 align-top">
                      <div className="line-clamp-2 text-[11px] text-slate-800">
                        {r.mcq_stem}
                      </div>
                    </td>
                    <td className="py-2 pr-2 align-top text-[11px] text-slate-600">
                      <div>
                        {r.from_user_name || r.from_user_email || "—"}
                      </div>
                      {r.from_user_email && r.from_user_name && (
                        <div className="text-[10px] text-slate-400">
                          {r.from_user_email}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top text-[11px] text-slate-600">
                      {new Date(r.created_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-500">
          Các câu hỏi được chia sẻ cho bạn sẽ có thể dùng làm nguồn tạo đề
          thi trong mục <span className="font-semibold">Khảo thí</span>.
        </p>
      </div>
    </div>
  );
}
