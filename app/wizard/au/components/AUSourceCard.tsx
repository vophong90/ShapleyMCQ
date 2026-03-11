"use client";

import type { ChangeEvent } from "react";
import type { AuSourceMode } from "../page";

type Book = {
  id: string;
  title: string;
  subtitle: string | null;
  specialty_id: string | null;
  specialty_name: string | null;
};

type Props = {
  sourceMode: AuSourceMode;
  onChangeSourceMode: (m: AuSourceMode) => void;
  auCount: number;
  onChangeAuCount: (value: number) => void;

  files: File[];
  onFilesChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;

  books: Book[];
  loadingBooks: boolean;
  selectedBookId: string | null;
  onChangeSelectedBookId: (id: string | null) => void;

  onGenAU: () => void;
  genLoading: boolean;
};

export function AUSourceCard({
  sourceMode,
  onChangeSourceMode,
  auCount,
  onChangeAuCount,
  files,
  onFilesChange,
  onRemoveFile,
  books,
  loadingBooks,
  selectedBookId,
  onChangeSelectedBookId,
  onGenAU,
  genLoading,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
      <div className="text-xs font-semibold text-slate-700 mb-1">
        Chọn nguồn sinh Assessment Units (AU)
      </div>

      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <button
          type="button"
          onClick={() => onChangeSourceMode("upload")}
          className={
            "text-left border rounded-xl p-3 flex flex-col gap-1 transition " +
            (sourceMode === "upload"
              ? "border-brand-500 bg-brand-50"
              : "border-slate-200 hover:border-slate-300")
          }
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full border border-slate-400 bg-white">
              {sourceMode === "upload" && (
                <span className="block h-2 w-2 rounded-full bg-brand-600 mx-auto my-auto" />
              )}
            </span>
            <span className="font-semibold text-slate-800">
              1. Từ file bạn upload
            </span>
          </div>
          <p className="text-[11px] text-slate-600">
            PDF, Word, PowerPoint hoặc hình ảnh của bài giảng/tài liệu tham khảo.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSourceMode("book")}
          className={
            "text-left border rounded-xl p-3 flex flex-col gap-1 transition " +
            (sourceMode === "book"
              ? "border-brand-500 bg-brand-50"
              : "border-slate-200 hover:border-slate-300")
          }
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full border border-slate-400 bg-white">
              {sourceMode === "book" && (
                <span className="block h-2 w-2 rounded-full bg-brand-600 mx-auto my-auto" />
              )}
            </span>
            <span className="font-semibold text-slate-800">
              2. Từ sách đã nạp vào hệ thống
            </span>
          </div>
          <p className="text-[11px] text-slate-600">
            Dùng nội dung từ các sách đã ingest xong và đang được bật sử dụng trong
            hệ thống.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSourceMode("gpt")}
          className={
            "text-left border rounded-xl p-3 flex flex-col gap-1 transition " +
            (sourceMode === "gpt"
              ? "border-brand-500 bg-brand-50"
              : "border-slate-200 hover:border-slate-300")
          }
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full border border-slate-400 bg-white">
              {sourceMode === "gpt" && (
                <span className="block h-2 w-2 rounded-full bg-brand-600 mx-auto my-auto" />
              )}
            </span>
            <span className="font-semibold text-slate-800">
              3. Từ kiến thức GPT (không dùng tài liệu)
            </span>
          </div>
          <p className="text-[11px] text-slate-600">
            GPT dùng kiến thức nền + LLO/bối cảnh để sinh AU, không dựa trên file
            cụ thể.
          </p>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <div>
          {sourceMode === "upload" && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">
                Tài liệu bài học (không lưu, chỉ dùng trong phiên)
              </div>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                onChange={onFilesChange}
                className="block w-full text-xs text-slate-600
                         file:mr-3 file:py-1.5 file:px-3
                         file:rounded-lg file:border-0
                         file:text-xs file:font-medium
                         file:bg-brand-50 file:text-brand-700
                         hover:file:bg-brand-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Chấp nhận: PDF, Word, PowerPoint, hình ảnh. File không được lưu
                lên server mà chỉ dùng để GPT phân tích trong phiên làm việc này.
              </p>

              {files.length > 0 && (
                <div className="border border-dashed border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 mt-2">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                    Các file đã chọn:
                  </div>
                  <ul className="space-y-1">
                    {files.map((file, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2 text-[11px] text-slate-700"
                      >
                        <span className="truncate">
                          {file.name}{" "}
                          <span className="text-slate-400">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveFile(idx)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100"
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {sourceMode === "book" && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">
                Chọn sách làm nguồn sinh AU
              </div>

              {loadingBooks ? (
                <p className="text-[11px] text-slate-500">
                  Đang tải danh sách sách…
                </p>
              ) : books.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Hiện chưa có sách nào ở trạng thái sẵn sàng sử dụng
                  (<code className="mx-1">ready</code>) và đang bật hoạt động trong
                  hệ thống.
                </p>
              ) : (
                <select
                  value={selectedBookId ?? ""}
                  onChange={(e) =>
                    onChangeSelectedBookId(e.target.value || null)
                  }
                  className="w-full border rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                >
                  <option value="">-- Chọn một sách --</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                      {b.subtitle ? ` – ${b.subtitle}` : ""}
                      {b.specialty_name ? ` [${b.specialty_name}]` : ""}
                    </option>
                  ))}
                </select>
              )}

              <p className="mt-1 text-[11px] text-slate-500">
                Danh sách này lấy từ các sách công khai đang hoạt động trong hệ
                thống. Khi chọn một sách, hệ thống sẽ trích nội dung từ bảng
                <code className="mx-1">book_chunks</code> để GPT sinh AU.
              </p>
            </div>
          )}

          {sourceMode === "gpt" && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">
                Dùng thuần kiến thức GPT
              </div>
              <p className="text-[11px] text-slate-600">
                Chế độ này không sử dụng file upload hay sách trong DB. GPT sẽ
                dựa trên LLO, bậc học, Bloom và thông tin bối cảnh để sinh AU theo
                kiến thức nền của mô hình.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Thích hợp khi anh muốn có bộ AU khung trước, rồi sau đó tinh
                chỉnh lại theo tài liệu cụ thể.
              </p>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Số lượng AU cần sinh
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={40}
              value={auCount}
              onChange={(e) => onChangeAuCount(Number(e.target.value || 8))}
              className="w-24 border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white"
            />
            <span className="text-[11px] text-slate-500">
              (1–40) — giúp tránh GPT sinh quá nhiều AU
            </span>
          </div>

          <div className="pt-3">
            <button
              type="button"
              onClick={onGenAU}
              disabled={genLoading}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60"
            >
              {genLoading
                ? "Đang sinh AU từ GPT…"
                : "Sinh AU từ GPT (theo nguồn đã chọn)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
