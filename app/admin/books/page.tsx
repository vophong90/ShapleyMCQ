// app/admin/books/page.tsx
"use client";

import { useEffect, useMemo, useState, ChangeEvent } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import * as tus from "tus-js-client";

type BookRow = {
  id: string;
  title: string;
  specialty_id: string | null;
  specialty_name: string | null;
  status: string | null;
  created_at: string | null;
};

const DEFAULT_BUCKET = "books";
const PAGE_SIZE = 10;

function safeFileName(name: string) {
  const base = (name || "file")
    .replace(/[^\p{L}\p{N}\.\-_ ]/gu, "")
    .trim()
    .replace(/\s+/g, "_");
  return base.slice(0, 180) || "file";
}

async function uploadResumableToSupabase(params: {
  tusEndpoint: string;
  bucket: string;
  objectName: string;
  anonKey: string;
  accessToken: string;
  file: File;
  onProgress?: (pct: number) => void;
}) {
  const {
    tusEndpoint,
    bucket,
    objectName,
    anonKey,
    accessToken,
    file,
    onProgress,
  } = params;

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
      },
      metadata: {
        bucketName: bucket,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress: (uploaded, total) =>
        onProgress?.(Number(((uploaded / total) * 100).toFixed(2))),
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}

export default function AdminBooksPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<BookRow[]>([]);
  const [q, setQ] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [specialtyName, setSpecialtyName] = useState("");

  const [creatingAll, setCreatingAll] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  const [page, setPage] = useState(1);

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  async function getAccessTokenOrThrow() {
    const { data: sessData, error: sessErr } = await supabase.auth.getSession();
    const accessToken = sessData?.session?.access_token;

    if (sessErr || !accessToken) {
      throw new Error("Không lấy được access token. Bạn đăng nhập lại.");
    }

    return accessToken;
  }

  async function authedFetch(
    input: string,
    init: RequestInit = {},
    accessToken?: string
  ) {
    const token = accessToken || (await getAccessTokenOrThrow());

    const headers = new Headers(init.headers || {});
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(input, {
      ...init,
      credentials: "include",
      headers,
    });
  }

  async function loadBooks(keyword: string) {
    setLoading(true);
    try {
      const token = await getAccessTokenOrThrow();
      const res = await authedFetch(
        "/api/admin/books/list?keyword=" + encodeURIComponent(keyword || ""),
        { method: "GET" },
        token
      );
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.error) {
        alert("Lỗi tải books: " + (json?.error || res.statusText));
        setLoading(false);
        return;
      }

      setList((json?.data || []) as BookRow[]);
    } catch (e: any) {
      alert("Lỗi tải books: " + String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooks("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!supabase) {
      alert(
        "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }

    setCreatingAll(true);
    setProgressMsg("1/4 Đang tạo metadata...");

    try {
      const accessToken = await getAccessTokenOrThrow();

      /* 1) Create metadata */
      const createRes = await authedFetch(
        "/api/admin/books/create",
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            specialty_name: specialtyName.trim() || null,
            mime_type: file.type || null,
            file_size: file.size || null,
          }),
        },
        accessToken
      );

      const createJson = await createRes.json().catch(() => ({}));

      if (!createRes.ok || createJson?.error) {
        setProgressMsg(null);
        alert(
          "Tạo book thất bại: " + (createJson?.error || createRes.statusText)
        );
        return;
      }

      const bookId: string | undefined =
        createJson?.book_id || createJson?.id || createJson?.data?.id;

      if (!bookId) {
        setProgressMsg(null);
        alert("Tạo book OK nhưng không nhận được book_id từ API create.");
        return;
      }

      /* 2) Upload init */
      setProgressMsg("2/4 Đang chuẩn bị upload (signed resumable)...");

      const initRes = await authedFetch(
        "/api/admin/books/upload-init",
        {
          method: "POST",
          body: JSON.stringify({
            book_id: bookId,
            file_name: safeFileName(file.name || title.trim()),
            content_type: file.type || null,
            upsert: true,
          }),
        },
        accessToken
      );

      const initJson = await initRes.json().catch(() => ({}));

      if (!initRes.ok || initJson?.error) {
        setProgressMsg(null);
        alert(
          "Upload init thất bại: " + (initJson?.error || initRes.statusText)
        );
        return;
      }

      const tusEndpoint: string = initJson.tusEndpoint;
      const objectName: string = initJson.objectName;
      const bucket: string = initJson.bucket || DEFAULT_BUCKET;
      const anonKey: string =
        initJson.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

      if (!tusEndpoint || !objectName) {
        setProgressMsg(null);
        alert("Upload init thiếu tusEndpoint hoặc objectName.");
        return;
      }

      if (!anonKey) {
        setProgressMsg(null);
        alert("Thiếu anonKey (NEXT_PUBLIC_SUPABASE_ANON_KEY).");
        return;
      }

      /* 2.2) Upload */
      setProgressMsg("2/4 Đang upload file (resumable)... 0%");

      await uploadResumableToSupabase({
        tusEndpoint,
        bucket,
        objectName,
        accessToken,
        anonKey,
        file,
        onProgress: (pct) =>
          setProgressMsg(`2/4 Đang upload file (resumable)... ${pct}%`),
      });

      const storage_path = objectName;

      /* 3) Attach DB */
      setProgressMsg("3/4 Đang cập nhật DB (storage_bucket/path + metadata)...");

      const attachRes = await authedFetch(
        "/api/admin/books/upload",
        {
          method: "POST",
          body: JSON.stringify({
            book_id: bookId,
            storage_path,
            mime_type: file.type || null,
            file_size: file.size || null,
          }),
        },
        accessToken
      );

      const attachJson = await attachRes.json().catch(() => ({}));

      if (!attachRes.ok || attachJson?.error) {
        setProgressMsg(null);
        alert(
          "Cập nhật DB thất bại: " +
            (attachJson?.error || attachRes.statusText) +
            (attachJson?.detail ? ` | ${attachJson.detail}` : "")
        );
        return;
      }

      /* 4) Ingest */
      setProgressMsg("4/4 Đang ingest (tách đoạn + embedding + lưu chunks)...");

      const ingestRes = await authedFetch(
        "/api/admin/books/ingest",
        {
          method: "POST",
          body: JSON.stringify({
            book_id: bookId,
            rebuild: true,
            embedding_model: "text-embedding-3-small",
            chunk_target_chars: 900,
            chunk_overlap_chars: 150,
          }),
        },
        accessToken
      );

      const ingestJson = await ingestRes.json().catch(() => ({}));

      if (!ingestRes.ok || ingestJson?.error) {
        setProgressMsg(null);
        alert(
          "Ingest thất bại: " +
            (ingestJson?.error || ingestRes.statusText) +
            (ingestJson?.detail ? ` | ${ingestJson.detail}` : "")
        );
        return;
      }

      setProgressMsg(
        `✅ Hoàn tất: chunks=${ingestJson?.chunk_count ?? "?"}, model=${
          ingestJson?.embedding_model ?? "?"
        }`
      );

      setTitle("");
      setSpecialtyName("");
      setFile(null);

      await loadBooks(q);
    } catch (e: any) {
      setProgressMsg(null);
      alert("Lỗi không xác định: " + String(e?.message || e));
    } finally {
      setCreatingAll(false);
    }
  }

  const canCreate = useMemo(
    () => !!title.trim() && !!file && !creatingAll,
    [title, file, creatingAll]
  );

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
          1 nút: Tạo metadata → Upload resumable (bucket: <b>{DEFAULT_BUCKET}</b>)
          → API cập nhật DB → ingest.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Tạo sách (tự chạy đủ)
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
          Mặc định: upload resumable (6MB chunks), rebuild ingest = true, model =
          text-embedding-3-small, chunk=900 overlap=150.
        </p>
      </div>

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
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-slate-500 text-center"
                  >
                    Đang tải...
                  </td>
                </tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-slate-500 text-center"
                  >
                    Chưa có book nào.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border-t">
                      <div className="font-semibold text-slate-900">
                        {b.title}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-t">
                      {b.specialty_name || b.specialty_id || "—"}
                    </td>
                    <td className="px-3 py-2 border-t">{b.status || "draft"}</td>
                    <td className="px-3 py-2 border-t">
                      {b.created_at
                        ? new Date(b.created_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Trang{" "}
            <span className="font-semibold text-slate-900">{safePage}</span> /{" "}
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
          Bảng chỉ hiển thị: tên sách, chuyên ngành, trạng thái, ngày tạo.
        </p>
      </div>
    </div>
  );
}
