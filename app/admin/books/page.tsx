// app/admin/books/page.tsx
"use client";

import { useEffect, useMemo, useState, ChangeEvent } from "react";

type BookRow = {
  id: string;
  title: string;
  specialty_id: string | null;
  specialty_name: string | null;
  status: string | null;
  created_at: string | null;
};

const DEFAULT_BUCKET = "books";

// Pagination
const PAGE_SIZE = 10;

export default function AdminBooksPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<BookRow[]>([]);
  const [q, setQ] = useState("");

  // create + upload + ingest (one flow)
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [specialtyName, setSpecialtyName] = useState("");

  const [creatingAll, setCreatingAll] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  // pagination state
  const [page, setPage] = useState(1);

  async function loadBooks(keyword: string) {
    setLoading(true);
    const res = await fetch(
      "/api/admin/books/list?keyword=" + encodeURIComponent(keyword || "")
    );
    const json = await res.json();
    setLoading(false);

    if (!res.ok || json?.error) {
      alert("Lỗi tải books: " + (json?.error || res.statusText));
      return;
    }

    setList((json?.data || []) as BookRow[]);
  }

  useEffect(() => {
    loadBooks("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset page when list changes or query changes
  useEffect(() => {
    setPage(1);
  }, [q, list.length]);

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
  }

  async function handleSearch() {
    await loadBooks(q);
    setPage(1);
  }

  async function handleCreateAll() {
    if (!title.trim()) {
      alert("Nhập title trước.");
      return;
    }
    if (!file) {
      alert("Chọn file trước.");
      return;
    }

    setCreatingAll(true);
    setProgressMsg("1/3 Đang tạo metadata...");

    try {
      // 1) Create metadata
      const createRes = await fetch("/api/admin/books/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          specialty_name: specialtyName.trim() || null,
          mime_type: file.type || null,
          file_size: file.size || null,
        }),
      });

      const createJson = await createRes.json();

      if (!createRes.ok || createJson?.error) {
        setProgressMsg(null);
        alert("Tạo book thất bại: " + (createJson?.error || createRes.statusText));
        setCreatingAll(false);
        return;
      }

      const bookId: string | undefined =
        createJson?.book_id || createJson?.id || createJson?.data?.id;

      if (!bookId) {
        setProgressMsg(null);
        alert("Tạo book OK nhưng không nhận được book_id từ API create.");
        setCreatingAll(false);
        return;
      }

      // 2) Upload to Storage
      setProgressMsg("2/3 Đang upload file lên Storage...");

      const form = new FormData();
      form.append("book_id", bookId);
      form.append("file", file);
      form.append("overwrite", "true");
      form.append("bucket", DEFAULT_BUCKET); // ✅ bucket bạn đã tạo

      const uploadRes = await fetch("/api/admin/books/upload", {
        method: "POST",
        body: form,
      });

      const uploadJson = await uploadRes.json();

      if (!uploadRes.ok || uploadJson?.error) {
        setProgressMsg(null);
        alert(
          "Upload thất bại: " +
            (uploadJson?.error || uploadRes.statusText) +
            (uploadJson?.detail ? ` | ${uploadJson.detail}` : "")
        );
        setCreatingAll(false);
        return;
      }

      // 3) Ingest
      setProgressMsg("3/3 Đang ingest (tách đoạn + embedding + lưu chunks)...");

      const ingestRes = await fetch("/api/admin/books/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: bookId,
          // ✅ mặc định “an toàn”
          rebuild: true,
          embedding_model: "text-embedding-3-small",
          chunk_target_chars: 900,
          chunk_overlap_chars: 150,
        }),
      });

      const ingestJson = await ingestRes.json();

      if (!ingestRes.ok || ingestJson?.error) {
        setProgressMsg(null);
        alert(
          "Ingest thất bại: " +
            (ingestJson?.error || ingestRes.statusText) +
            (ingestJson?.detail ? ` | ${ingestJson.detail}` : "")
        );
        setCreatingAll(false);
        return;
      }

      setProgressMsg(
        `✅ Hoàn tất: chunks=${ingestJson?.chunk_count ?? "?"}, model=${
          ingestJson?.embedding_model ?? "?"
        }`
      );

      // reset form
      setTitle("");
      setSpecialtyName("");
      setFile(null);

      // reload list
      await loadBooks(q);
    } catch (e: any) {
      setProgressMsg(null);
      alert("Lỗi không xác định: " + String(e?.message || e));
    } finally {
      setCreatingAll(false);
    }
  }

  const canCreate = useMemo(() => !!title.trim() && !!file && !creatingAll, [title, file, creatingAll]);

  // Pagination derived
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = list.slice(start, end);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Books</h2>
        <p className="text-sm text-slate-600">
          Tạo sách → upload Storage (bucket: <b>{DEFAULT_BUCKET}</b>) → ingest (chunks + embedding) chỉ bằng 1 nút.
        </p>
      </div>

      {/* Create ALL: metadata + upload + ingest */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Tạo sách (tự chạy đủ 3 bước)
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
              disabled={creatingAll}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Specialty name (tuỳ chọn)
            </label>
            <input
              value={specialtyName}
              onChange={(e) => setSpecialtyName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="VD: Da liễu / Nội khoa / Nhi khoa..."
              disabled={creatingAll}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            File
          </label>
          <input
            type="file"
            onChange={onPickFile}
            disabled={creatingAll}
            className="block w-full text-sm text-slate-600
                     file:mr-3 file:py-1.5 file:px-3
                     file:rounded-lg file:border-0
                     file:text-sm file:font-semibold
                     file:bg-brand-50 file:text-brand-700
                     hover:file:bg-brand-100"
          />
          {file && (
            <div className="mt-1 text-xs text-slate-600">
              Đã chọn: <span className="font-semibold">{file.name}</span>{" "}
              ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {progressMsg && (
          <div className="text-sm text-slate-700 bg-slate-50 border rounded-xl px-3 py-2">
            {progressMsg}
          </div>
        )}

        <div className="flex justify-end">
          <button
            disabled={!canCreate}
            onClick={handleCreateAll}
            className={[
              "px-4 py-2 rounded-xl text-sm font-semibold",
              canCreate
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            {creatingAll ? "Đang xử lý..." : "Tạo sách"}
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Mặc định: overwrite upload = true, rebuild ingest = true, model = text-embedding-3-small, chunk=900 overlap=150.
        </p>
      </div>

      {/* List */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="border rounded-lg px-3 py-2 text-sm w-72"
            placeholder="Tìm theo title..."
          />
          <button
            onClick={handleSearch}
            className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
          >
            Tìm
          </button>
          <div className="flex-1" />
          <div className="text-xs text-slate-500">
            Tổng: <span className="font-semibold text-slate-900">{total}</span>
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-3 py-2 border-b text-left">Title</th>
                <th className="px-3 py-2 border-b text-left w-56">Specialty</th>
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

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500 text-center">
                    Chưa có book nào.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border-t">
                      <div className="font-semibold text-slate-900">{b.title}</div>
                    </td>
                    <td className="px-3 py-2 border-t">
                      {b.specialty_name || b.specialty_id || "—"}
                    </td>
                    <td className="px-3 py-2 border-t">{b.status || "draft"}</td>
                    <td className="px-3 py-2 border-t">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Trang <span className="font-semibold text-slate-900">{safePage}</span> /{" "}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>

          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Trước
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sau →
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Bảng hiển thị: tên sách, chuyên ngành, trạng thái, ngày tạo.
        </p>
      </div>
    </div>
  );
}
