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

type RowState = {
  file?: File | null;
  uploading?: boolean;
  ingesting?: boolean;
  lastMsg?: string | null;
};

export default function AdminBooksPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<BookRow[]>([]);
  const [q, setQ] = useState("");

  // create form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [specialtyName, setSpecialtyName] = useState("");

  // ingest options (global)
  const [rebuild, setRebuild] = useState(true);
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-small");
  const [chunkTargetChars, setChunkTargetChars] = useState(900);
  const [chunkOverlapChars, setChunkOverlapChars] = useState(150);

  // per-row local state
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  // upload options (global)
  const [overwriteUpload, setOverwriteUpload] = useState(true);
  const [bucket, setBucket] = useState(""); // optional, empty = API default

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

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
  }

  function onPickRowFile(bookId: string, e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setRowState((s) => ({
      ...s,
      [bookId]: {
        ...(s[bookId] || {}),
        file: f,
        lastMsg: f ? `Đã chọn file: ${f.name}` : "Đã bỏ chọn file",
      },
    }));
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
        specialty_name: specialtyName.trim() || null,
        mime_type: file.type || null,
        file_size: file.size || null,
      }),
    });

    const json = await res.json();

    if (!res.ok || json?.error) {
      alert("Tạo book thất bại: " + (json?.error || res.statusText));
      return;
    }

    alert("Đã tạo book metadata. Giờ bạn Upload file lên Storage rồi Ingest.");
    setTitle("");
    setSpecialtyName("");
    setFile(null);

    await loadBooks(q);
  }

  async function handleUpload(bookId: string) {
    const rs = rowState[bookId];
    const picked = rs?.file || null;
    if (!picked) {
      alert("Chọn file ở dòng sách đó trước (cột Actions).");
      return;
    }

    setRowState((s) => ({
      ...s,
      [bookId]: { ...(s[bookId] || {}), uploading: true, lastMsg: "Đang upload..." },
    }));

    try {
      const form = new FormData();
      form.append("book_id", bookId);
      form.append("file", picked);
      form.append("overwrite", overwriteUpload ? "true" : "false");
      if (bucket.trim()) form.append("bucket", bucket.trim());

      const res = await fetch("/api/admin/books/upload", {
        method: "POST",
        body: form,
      });
      const json = await res.json();

      if (!res.ok || json?.error) {
        setRowState((s) => ({
          ...s,
          [bookId]: {
            ...(s[bookId] || {}),
            uploading: false,
            lastMsg: "Upload lỗi: " + (json?.error || res.statusText),
          },
        }));
        return;
      }

      setRowState((s) => ({
        ...s,
        [bookId]: {
          ...(s[bookId] || {}),
          uploading: false,
          lastMsg: `Upload OK → ${json?.bucket || ""}/${json?.storage_path || ""}`,
        },
      }));

      await loadBooks(q);
    } catch (e: any) {
      setRowState((s) => ({
        ...s,
        [bookId]: {
          ...(s[bookId] || {}),
          uploading: false,
          lastMsg: "Upload exception: " + String(e?.message || e),
        },
      }));
    }
  }

  async function handleIngest(bookId: string) {
    setRowState((s) => ({
      ...s,
      [bookId]: { ...(s[bookId] || {}), ingesting: true, lastMsg: "Đang ingest..." },
    }));

    try {
      const res = await fetch("/api/admin/books/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: bookId,
          rebuild,
          embedding_model: embeddingModel.trim() || undefined,
          chunk_target_chars: Number(chunkTargetChars) || 900,
          chunk_overlap_chars: Number(chunkOverlapChars) || 150,
        }),
      });

      const json = await res.json();

      if (!res.ok || json?.error) {
        setRowState((s) => ({
          ...s,
          [bookId]: {
            ...(s[bookId] || {}),
            ingesting: false,
            lastMsg: "Ingest lỗi: " + (json?.error || res.statusText) + (json?.detail ? ` | ${json.detail}` : ""),
          },
        }));
        return;
      }

      setRowState((s) => ({
        ...s,
        [bookId]: {
          ...(s[bookId] || {}),
          ingesting: false,
          lastMsg: `Ingest OK: chunks=${json?.chunk_count ?? "?"}, model=${json?.embedding_model ?? "?"}`,
        },
      }));

      await loadBooks(q);
    } catch (e: any) {
      setRowState((s) => ({
        ...s,
        [bookId]: {
          ...(s[bookId] || {}),
          ingesting: false,
          lastMsg: "Ingest exception: " + String(e?.message || e),
        },
      }));
    }
  }

  async function handleUploadAndIngest(bookId: string) {
    const rs = rowState[bookId];
    const picked = rs?.file || null;
    if (!picked) {
      alert("Chọn file ở dòng sách đó trước (cột Actions).");
      return;
    }

    await handleUpload(bookId);
    // Nếu upload thất bại, handleUpload đã set lastMsg; ta check nhanh:
    const after = rowState[bookId]?.lastMsg || "";
    if (after.startsWith("Upload lỗi") || after.startsWith("Upload exception")) return;

    await handleIngest(bookId);
  }

  const canCreate = useMemo(() => !!title.trim() && !!file, [title, file]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Books</h2>
        <p className="text-sm text-slate-600">
          Admin upload + ingest sách để dùng cho RAG. User thường chỉ đọc sách status=ready (tuỳ RLS của bạn).
        </p>
      </div>

      {/* Create (metadata) */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          1) Tạo book (metadata)
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
              Specialty name (tuỳ chọn)
            </label>
            <input
              value={specialtyName}
              onChange={(e) => setSpecialtyName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="VD: Da liễu / Nội khoa / Nhi khoa..."
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            File (để lấy mime_type + file_size khi tạo metadata)
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
              Đã chọn: <span className="font-semibold">{file.name}</span> (
              {(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            disabled={!canCreate}
            onClick={handleCreate}
            className={[
              "px-4 py-2 rounded-xl text-sm font-semibold",
              canCreate ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            Tạo book
          </button>
        </div>
      </div>

      {/* Options */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          2) Tuỳ chọn Upload / Ingest
        </div>

        <div className="grid lg:grid-cols-3 gap-3">
          <div className="border rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700">Upload</div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overwriteUpload}
                onChange={(e) => setOverwriteUpload(e.target.checked)}
              />
              Overwrite (upsert)
            </label>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Bucket (optional)
              </label>
              <input
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Để trống = API default (BOOKS_BUCKET / books)"
              />
            </div>
          </div>

          <div className="border rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700">Ingest</div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rebuild}
                onChange={(e) => setRebuild(e.target.checked)}
              />
              Rebuild (xóa chunks cũ)
            </label>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Embedding model
              </label>
              <input
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="text-embedding-3-small"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                Gợi ý: small=1536, large=3072 (API ingest sẽ tự update embedding_model/dim vào books).
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700">Chunking</div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Target chars
                </label>
                <input
                  type="number"
                  value={chunkTargetChars}
                  onChange={(e) => setChunkTargetChars(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  min={300}
                  max={2000}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Overlap chars
                </label>
                <input
                  type="number"
                  value={chunkOverlapChars}
                  onChange={(e) => setChunkOverlapChars(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  min={0}
                  max={600}
                />
              </div>
            </div>
          </div>
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
                <th className="px-3 py-2 border-b text-left w-56">Specialty</th>
                <th className="px-3 py-2 border-b text-left w-32">Status</th>
                <th className="px-3 py-2 border-b text-left w-44">Created</th>
                <th className="px-3 py-2 border-b text-left w-[420px]">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500 text-center">
                    Đang tải...
                  </td>
                </tr>
              )}

              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500 text-center">
                    Chưa có book nào.
                  </td>
                </tr>
              )}

              {!loading &&
                list.map((b) => {
                  const rs = rowState[b.id] || {};
                  const busy = !!rs.uploading || !!rs.ingesting;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 align-top">
                      <td className="px-3 py-2 border-t">
                        <div className="font-semibold text-slate-900">{b.title}</div>
                        <div className="text-[11px] text-slate-500">{b.id}</div>
                        {rs.lastMsg && (
                          <div className="mt-1 text-[11px] text-slate-600">
                            {rs.lastMsg}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 border-t">
                        {b.specialty_name || b.specialty_id || "—"}
                      </td>

                      <td className="px-3 py-2 border-t">{b.status || "draft"}</td>

                      <td className="px-3 py-2 border-t">
                        {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                      </td>

                      <td className="px-3 py-2 border-t">
                        <div className="space-y-2">
                          <div>
                            <input
                              type="file"
                              onChange={(e) => onPickRowFile(b.id, e)}
                              className="block w-full text-xs text-slate-600
                                file:mr-2 file:py-1 file:px-2
                                file:rounded-lg file:border-0
                                file:text-xs file:font-semibold
                                file:bg-slate-200 file:text-slate-800
                                hover:file:bg-slate-300"
                            />
                            {rs.file && (
                              <div className="mt-1 text-[11px] text-slate-600">
                                File: <span className="font-semibold">{rs.file.name}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={busy}
                              onClick={() => handleUpload(b.id)}
                              className={[
                                "px-3 py-1.5 rounded-lg text-xs font-semibold border",
                                busy ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-white hover:bg-slate-50 border-slate-300",
                              ].join(" ")}
                            >
                              {rs.uploading ? "Uploading..." : "Upload"}
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => handleIngest(b.id)}
                              className={[
                                "px-3 py-1.5 rounded-lg text-xs font-semibold",
                                busy ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800",
                              ].join(" ")}
                            >
                              {rs.ingesting ? "Ingesting..." : "Ingest"}
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => handleUploadAndIngest(b.id)}
                              className={[
                                "px-3 py-1.5 rounded-lg text-xs font-semibold",
                                busy ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700",
                              ].join(" ")}
                            >
                              Upload + Ingest
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-500">
                            Tip: nếu sách đã ingest trước đó, bật <b>Rebuild</b> để tránh lỗi unique(chunk_index).
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Flow: Create (metadata) → Upload (storage_bucket/storage_path) → Ingest (book_chunks + book_ingest_jobs + update books.status=ready).
        </p>
      </div>
    </div>
  );
}
