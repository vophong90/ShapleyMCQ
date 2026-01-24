// app/admin/books/page.tsx
"use client";

import { useEffect, useState, ChangeEvent } from "react";

type BookRow = {
  id: string;
  title: string;
  specialty_code: string | null;
  status: string | null;
  created_at: string | null;
};

export default function AdminBooksPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<BookRow[]>([]);
  const [q, setQ] = useState("");

  // upload stub
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [specialtyCode, setSpecialtyCode] = useState("");

  async function loadBooks(keyword: string) {
    setLoading(true);
    const res = await fetch("/api/admin/books/list?keyword=" + encodeURIComponent(keyword || ""));
    const json = await res.json();
    setLoading(false);

    if (!res.ok || json?.error) {
      alert("Lỗi tải books: " + (json?.error || res.statusText));
      return;
    }

    setList(json?.data || []);
  }

  useEffect(() => {
    loadBooks("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
  }

  async function handleCreate() {
    if (!title.trim()) {
      alert("Nhập title trước.");
      return;
    }
    if (!file) {
      alert("Chọn file trước (stub upload).");
      return;
    }

    const res = await fetch("/api/admin/books/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        specialty_code: specialtyCode.trim() || null,
        original_filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || null,
      }),
    });

    const json = await res.json();

    if (!res.ok || json?.error) {
      alert("Tạo book thất bại: " + (json?.error || res.statusText));
      return;
    }

    alert("Đã tạo book metadata. (Bước upload storage sẽ làm tiếp ở patch sau)");
    setTitle("");
    setSpecialtyCode("");
    setFile(null);

    await loadBooks(q);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Books</h2>
        <p className="text-sm text-slate-600">
          Quản lý sách/giáo trình để dùng cho Option 3 (RAG/ingest). Patch này tạo khung UI + API stub.
        </p>
      </div>

      {/* Upload / Create (stub) */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Thêm book (metadata trước)
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="VD: Giáo trình Nội khoa YHCT – 2025"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Specialty code (tuỳ chọn)
            </label>
            <input
              value={specialtyCode}
              onChange={(e) => setSpecialtyCode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="VD: YHCT_NOIKHOA"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            File (stub — chưa upload storage)
          </label>
          <input
            type="file"
            onChange={onPickFile}
            className="block w-full text-sm text-slate-600
                     file:mr-3 file:py-1.5 file:px-3
                     file:rounded-lg file:border-0
                     file:text-sm file:font-semibold
                     file:bg-brand-50 file:text-brand-700
                     hover:file:bg-brand-100"
          />
          {file && (
            <div className="mt-1 text-xs text-slate-600">
              Đã chọn: <span className="font-semibold">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Tạo book
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadBooks(q);
            }}
            className="border rounded-lg px-3 py-2 text-sm w-72"
            placeholder="Tìm theo title..."
          />
          <button
            onClick={() => loadBooks(q)}
            className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
          >
            Tìm
          </button>
          <div className="flex-1" />
          <div className="text-xs text-slate-500">
            Tổng: <span className="font-semibold text-slate-900">{list.length}</span>
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-3 py-2 border-b text-left">Title</th>
                <th className="px-3 py-2 border-b text-left w-48">Specialty</th>
                <th className="px-3 py-2 border-b text-left w-32">Status</th>
                <th className="px-3 py-2 border-b text-left w-44">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500 text-center">
                    Đang tải...
                  </td>
                </tr>
              )}

              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500 text-center">
                    Chưa có book nào.
                  </td>
                </tr>
              )}

              {!loading &&
                list.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border-t">
                      <div className="font-semibold text-slate-900">{b.title}</div>
                      <div className="text-[11px] text-slate-500">{b.id}</div>
                    </td>
                    <td className="px-3 py-2 border-t">{b.specialty_code || "—"}</td>
                    <td className="px-3 py-2 border-t">{b.status || "draft"}</td>
                    <td className="px-3 py-2 border-t">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Patch tiếp theo: upload lên Storage + ingest pipeline + status.
        </p>
      </div>
    </div>
  );
}
