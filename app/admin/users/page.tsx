"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  specialty_code?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  author: "Author",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [list, setList] = useState<Profile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const [resetting, setResetting] = useState(false);

  // 1. Kiểm tra session + role admin
  useEffect(() => {
    (async () => {
      setLoadingMe(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: me, error } = await supabase
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", session.user.id)
        .single();

      setLoadingMe(false);

      if (error || !me) {
        router.replace("/login");
        return;
      }

      setCurrentProfile(me);

      if (me.role !== "admin") {
        // Không phải admin thì về dashboard
        router.replace("/dashboard");
        return;
      }

      // Nếu là admin thì load danh sách
      loadUsers("");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers(q: string) {
    setLoadingList(true);
    setSelectedIds([]);

    let query = supabase
      .from("profiles")
      .select("id, email, name, role")
      .order("created_at", { ascending: false });

    if (q.trim()) {
      const like = `%${q.trim()}%`;
      query = query.or(
        `email.ilike.${like},name.ilike.${like}`
      );
    }

    const { data, error } = await query;
    setLoadingList(false);

    if (error) {
      alert("Lỗi tải danh sách users: " + error.message);
      return;
    }

    setList(data || []);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    if (selectedIds.length === list.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(list.map((u) => u.id));
    }
  }

  async function changeRoleForUser(id: string, newRole: string) {
    setSavingRole(true);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", id);

    setSavingRole(false);

    if (error) {
      alert("Đổi role thất bại: " + error.message);
      return;
    }

    setList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
    );
  }

  async function resetPasswordBulk() {
    if (!selectedIds.length) {
      alert("Chưa chọn user nào.");
      return;
    }

    if (
      !window.confirm(
        `Reset mật khẩu cho ${selectedIds.length} user về mật khẩu mặc định?`
      )
    ) {
      return;
    }

    setResetting(true);

    const res = await fetch("/api/admin/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_ids: selectedIds }),
    });

    const json = await res.json();
    setResetting(false);

    if (json.error) {
      alert("Lỗi reset mật khẩu: " + json.error);
      return;
    }

    alert(
      `Đã reset mật khẩu cho ${json.ok}/${json.total} tài khoản.\n(Lưu ý: bạn cần thông báo mật khẩu mới cho người dùng.)`
    );
  }

  const canShow = currentProfile && currentProfile.role === "admin";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Quản lý người dùng
          </h1>
          <p className="text-sm text-slate-500">
            Xem danh sách user, đổi role và reset mật khẩu về mặc định.
          </p>
        </div>

        {currentProfile && (
          <div className="text-xs text-right text-slate-500">
            Đăng nhập:{" "}
            <span className="font-semibold">
              {currentProfile.email || currentProfile.name}
            </span>{" "}
            ({currentProfile.role})
          </div>
        )}
      </div>

      {loadingMe && (
        <div className="text-sm text-slate-500">Đang kiểm tra quyền…</div>
      )}

      {!loadingMe && !canShow && (
        <div className="text-sm text-red-600">
          Bạn không có quyền truy cập trang Admin.
        </div>
      )}

      {!loadingMe && canShow && (
        <>
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  loadUsers(search);
                }
              }}
              placeholder="Tìm theo email hoặc tên..."
              className="border rounded-lg px-3 py-2 text-sm w-64"
            />
            <button
              onClick={() => loadUsers(search)}
              className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
            >
              Tìm
            </button>

            <div className="flex-1" />

            <button
              onClick={resetPasswordBulk}
              disabled={resetting || selectedIds.length === 0}
              className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50"
            >
              {resetting
                ? "Đang reset..."
                : `Reset mật khẩu (${selectedIds.length})`}
            </button>
          </div>

          {/* Table */}
          <div className="border rounded-xl bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-2 py-2 border-b text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        !!list.length &&
                        selectedIds.length === list.length
                      }
                      onChange={selectAll}
                    />
                  </th>
                  <th className="px-2 py-2 border-b text-left w-64">
                    Email
                  </th>
                  <th className="px-2 py-2 border-b text-left">
                    Tên
                  </th>
                  <th className="px-2 py-2 border-b text-left w-40">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingList && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-3 text-slate-500 text-center"
                    >
                      Đang tải danh sách...
                    </td>
                  </tr>
                )}

                {!loadingList && list.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-3 text-slate-500 text-center"
                    >
                      Chưa có user nào.
                    </td>
                  </tr>
                )}

                {!loadingList &&
                  list.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-2 py-2 border-t text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleSelect(u.id)}
                        />
                      </td>
                      <td className="px-2 py-2 border-t">
                        {u.email}
                      </td>
                      <td className="px-2 py-2 border-t">
                        {u.name}
                      </td>
                      <td className="px-2 py-2 border-t">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            changeRoleForUser(u.id, e.target.value)
                          }
                          disabled={savingRole}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          {Object.keys(ROLE_LABEL).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r] || r}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            ⚠️ Lưu ý: Reset mật khẩu dùng Supabase service role. Hãy giới hạn
            quyền truy cập trang này cho admin duy nhất, và không chia sẻ URL
            này công khai.
          </p>
        </>
      )}
    </div>
  );
}
