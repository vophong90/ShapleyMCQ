// app/admin/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: "admin" | "user" | string;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị",
  user: "Người dùng",
};

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [list, setList] = useState<Profile[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [resetting, setResetting] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );
  const canShow = currentProfile && currentProfile.role === "admin";

  /* =========================================================
     CHECK LOGIN + ROLE
  ========================================================= */
  useEffect(() => {
    (async () => {
      setLoadingMe(true);

      const { data, error: userErr } = await supabase.auth.getUser();
      const user = data.user;

      if (userErr || !user) {
        setLoadingMe(false);
        router.replace("/login");
        return;
      }

      const { data: me, error } = await supabase
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", user.id)
        .single();

      setLoadingMe(false);

      if (error || !me) {
        router.replace("/login");
        return;
      }

      setCurrentProfile(me);

      if (me.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setPage(1);
      await loadUsers({ q: "", page: 1 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     LOAD USERS
  ========================================================= */
  async function loadUsers(opts: { q: string; page: number }) {
    const q = opts.q ?? "";
    const p = opts.page ?? 1;

    setLoadingList(true);
    setSelectedIds([]);

    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("profiles")
      .select("id, email, name, role", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q.trim()) {
      const like = `%${q.trim()}%`;
      query = query.or(`email.ilike.${like},name.ilike.${like}`);
    }

    const { data, error, count } = await query;

    setLoadingList(false);

    if (error) {
      alert("Lỗi tải danh sách users: " + error.message);
      return;
    }

    setList((data as Profile[]) || []);
    setTotal(count ?? 0);
  }

  /* =========================================================
     UI HELPERS
  ========================================================= */
  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllCurrentPage() {
    if (selectedIds.length === list.length) setSelectedIds([]);
    else setSelectedIds(list.map((u) => u.id));
  }

  async function goToPage(nextPage: number) {
    const safe = Math.min(Math.max(1, nextPage), totalPages);
    setPage(safe);
    await loadUsers({ q: search, page: safe });
  }

  /* =========================================================
     ACTIONS
  ========================================================= */
  async function changeRoleForUser(id: string, newRole: "admin" | "user") {
    if (!window.confirm(`Đổi quyền user này thành "${ROLE_LABEL[newRole]}"?`))
      return;

    setSavingRole(true);
    const res = await fetch("/api/admin/users/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_ids: [id], role: newRole }),
    });
    const json = await res.json();
    setSavingRole(false);

    if (!res.ok || json.error) {
      alert("Đổi role thất bại: " + (json.error || res.statusText));
      return;
    }

    setList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
    );
  }

  async function changeRoleBulk(newRole: "admin" | "user") {
    if (!selectedIds.length) {
      alert("Chưa chọn user nào.");
      return;
    }
    if (
      !window.confirm(
        `Đổi quyền ${selectedIds.length} user thành "${ROLE_LABEL[newRole]}"?`
      )
    )
      return;

    setSavingRole(true);
    const res = await fetch("/api/admin/users/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_ids: selectedIds, role: newRole }),
    });
    const json = await res.json();
    setSavingRole(false);

    if (!res.ok || json.error) {
      alert("Đổi role thất bại: " + (json.error || res.statusText));
      return;
    }

    setList((prev) =>
      prev.map((u) =>
        selectedIds.includes(u.id) ? { ...u, role: newRole } : u
      )
    );
    alert(`Đã đổi role: ${json.ok}/${json.total}`);
  }

  async function deleteUsersBulk() {
    if (!selectedIds.length) {
      alert("Chưa chọn user nào.");
      return;
    }

    if (
      !window.confirm(
        `XÓA ${selectedIds.length} user đã chọn?\nHành động này sẽ xóa tài khoản Auth và hồ sơ liên quan (không hoàn tác).`
      )
    ) {
      return;
    }

    setDeleting(true);
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_ids: selectedIds }),
    });
    const json = await res.json();
    setDeleting(false);

    if (!res.ok || json.error) {
      alert("Xóa user thất bại: " + (json.error || res.statusText));
      return;
    }

    alert(`Đã xóa: ${json.ok}/${json.total}`);
    await loadUsers({ q: search, page });
  }

  async function deleteOne(id: string) {
    setSelectedIds([id]);
    await deleteUsersBulk();
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
    )
      return;

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

    alert(`Đã reset mật khẩu cho ${json.ok}/${json.total} tài khoản.`);
  }

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
          <p className="text-sm text-slate-500">
            Xem danh sách, đổi role, reset mật khẩu, và xóa user.
          </p>
        </div>

        {currentProfile && (
          <div className="text-xs text-right text-slate-500">
            Đăng nhập:{" "}
            <span className="font-semibold">
              {currentProfile.email || currentProfile.name}
            </span>{" "}
            ({ROLE_LABEL[currentProfile.role] || currentProfile.role})
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
                  setPage(1);
                  loadUsers({ q: search, page: 1 });
                }
              }}
              placeholder="Tìm theo email hoặc tên..."
              className="border rounded-lg px-3 py-2 text-sm w-64"
            />
            <button
              onClick={() => {
                setPage(1);
                loadUsers({ q: search, page: 1 });
              }}
              className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
            >
              Tìm
            </button>

            <div className="flex-1" />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => changeRoleBulk("user")}
                disabled={savingRole || selectedIds.length === 0}
                className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50"
              >
                Đổi thành Người dùng ({selectedIds.length})
              </button>
              <button
                onClick={() => changeRoleBulk("admin")}
                disabled={savingRole || selectedIds.length === 0}
                className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50"
              >
                Đổi thành Quản trị ({selectedIds.length})
              </button>

              <button
                onClick={resetPasswordBulk}
                disabled={resetting || selectedIds.length === 0}
                className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {resetting
                  ? "Đang reset..."
                  : `Reset mật khẩu (${selectedIds.length})`}
              </button>

              <button
                onClick={deleteUsersBulk}
                disabled={deleting || selectedIds.length === 0}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting
                  ? "Đang xóa..."
                  : `Xóa user (${selectedIds.length})`}
              </button>
            </div>
          </div>

          {/* Pagination */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <div>
              Tổng: <span className="font-semibold">{total}</span> user • Trang{" "}
              <span className="font-semibold">{page}</span>/{totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loadingList}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
              >
                ← Trước
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loadingList}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
              >
                Sau →
              </button>
            </div>
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
                        !!list.length && selectedIds.length === list.length
                      }
                      onChange={selectAllCurrentPage}
                    />
                  </th>
                  <th className="px-2 py-2 border-b text-left w-64">Email</th>
                  <th className="px-2 py-2 border-b text-left">Tên</th>
                  <th className="px-2 py-2 border-b text-left w-48">Role</th>
                  <th className="px-2 py-2 border-b text-right w-28">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {loadingList && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-3 text-slate-500 text-center"
                    >
                      Đang tải danh sách...
                    </td>
                  </tr>
                )}

                {!loadingList && list.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
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
                      <td className="px-2 py-2 border-t">{u.email}</td>
                      <td className="px-2 py-2 border-t">{u.name}</td>

                      <td className="px-2 py-2 border-t">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            changeRoleForUser(
                              u.id,
                              e.target.value as "admin" | "user"
                            )
                          }
                          disabled={savingRole}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="user">Người dùng</option>
                          <option value="admin">Quản trị</option>
                        </select>
                      </td>

                      <td className="px-2 py-2 border-t text-right">
                        <button
                          onClick={() => deleteOne(u.id)}
                          disabled={deleting}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-50"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            ⚠️ Reset/xóa user dùng Supabase service role. Hãy giới hạn trang này
            cho admin.
          </p>
        </>
      )}
    </div>
  );
}
