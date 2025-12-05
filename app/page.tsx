"use client";

import { useState } from "react";
import Link from "next/link";

type StepDef = {
  id: number;
  title: string;
  short: string;
  bullets: string[];
};

const STEPS: StepDef[] = [
  {
    id: 1,
    title: "Thiết lập bối cảnh & LLO",
    short: "Chuyên ngành – bậc đào tạo – học phần – bài học – LLO – Bloom",
    bullets: [
      "Khai báo chuyên ngành, bậc đào tạo, học phần và bài học",
      "Chuẩn hoá chuẩn đầu ra học tập (LLO) và gán mức Bloom",
      "Kiểm tra sự phù hợp giữa LLO và mức độ nhận thức"
    ]
  },
  {
    id: 2,
    title: "Tạo Assessment Units (AU)",
    short: "AI gợi ý AU từ tài liệu cá nhân",
    bullets: [
      "Upload giáo trình, guideline, slide hoặc tài liệu cá nhân",
      "GPT gợi ý các Assessment Units (khối kiến thức trọng tâm)",
      "Giảng viên rà soát, chọn lọc và cố định AU"
    ]
  },
  {
    id: 3,
    title: "Xây dựng Misconceptions",
    short: "Sai lầm nhận thức xuất phát từ AU",
    bullets: [
      "GPT sinh các sai lầm (Mis) từ AU đã chọn",
      "Chỉnh sửa mô tả sai lầm cốt lõi, gắn với bối cảnh lâm sàng",
      "Liên kết Mis với AU, chuẩn bị logic distractor"
    ]
  },
  {
    id: 4,
    title: "Sinh câu hỏi MCQ",
    short: "Stem & distractor theo chuẩn USMLE/NBME",
    bullets: [
      "GPT sinh stem và distractor dựa trên AU + Mis",
      "Đánh giá cấu trúc câu hỏi theo chuẩn USMLE/NBME",
      "Kiểm tra mức Bloom và tinh chỉnh trước khi lưu vào ngân hàng"
    ]
  },
  {
    id: 5,
    title: "Mô phỏng & phân tích Shapley",
    short: "Monte Carlo + Shapley value cho distractor",
    bullets: [
      "Mô phỏng người học ở nhiều mức năng lực khác nhau",
      "Theo dõi hành vi chọn đáp án của từng distractor",
      "Tính Shapley Value để đo đóng góp của mỗi distractor"
    ]
  }
];

export default function HomePage() {
  const [openId, setOpenId] = useState<number | null>(1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* HERO */}
      <section className="mb-16 grid gap-10 md:grid-cols-[3fr,2fr] items-center">
        {/* Bên trái */}
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 mb-3 leading-tight">
            ShapleyMCQ Lab
          </h1>
          <p className="text-[15px] text-slate-600 leading-relaxed mb-6 max-w-xl">
            Nền tảng hỗ trợ giảng viên biến chuẩn đầu ra thành các câu hỏi MCQ
            đã được kiểm chứng, thông qua một pipeline AI có thể giải thích
            được, kết hợp mô phỏng Monte Carlo và Shapley Values trong bối cảnh
            đào tạo y khoa.
          </p>

          {/* Chips tóm tắt – vẫn trung tính, nhưng có điểm nhấn brand */}
          <div className="flex flex-wrap gap-2 mb-8 text-[11px]">
            <span className="px-3 py-1 rounded-full border border-brand-200 text-brand-700 bg-brand-50/70">
              Canh chỉnh LLO & Bloom
            </span>
            <span className="px-3 py-1 rounded-full border border-slate-200 text-slate-600">
              AU & Misconceptions có chủ đích
            </span>
            <span className="px-3 py-1 rounded-full border border-slate-200 text-slate-600">
              MCQ + Monte Carlo + Shapley
            </span>
          </div>

          {/* CTA – dùng brand color & link đúng /dashboard */}
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Bắt đầu Pipeline →
            </Link>
            <a
              href="#pipeline"
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:border-slate-400"
            >
              Xem quy trình chi tiết
            </a>
          </div>
        </div>

        {/* Bên phải – mockup tối giản */}
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            </div>
            <span className="text-[11px] text-slate-400">
              pipeline.shapleymcq
            </span>
          </div>

          <div className="space-y-5 text-xs">
            <MiniBlock title="LLO & Bloom">
              <MiniLLO label="LO1: Chẩn đoán..." tag="Apply" />
              <MiniLLO label="LO2: Giải thích..." tag="Understand" />
              <MiniLLO label="LO3: Lập kế hoạch..." tag="Analyze" />
            </MiniBlock>

            <MiniBlock title="Phân tích Distractor">
              <MiniBar label="Distractor A" width="80%" />
              <MiniBar label="Distractor B" width="40%" />
              <MiniBar label="Distractor C" width="20%" />
            </MiniBlock>
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="pipeline">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Quy trình 5 bước
        </h2>
        <div className="space-y-3">
          {STEPS.map((step) => (
            <StepPanel
              key={step.id}
              step={step}
              open={openId === step.id}
              onToggle={() =>
                setOpenId((prev) => (prev === step.id ? null : step.id))
              }
            />
          ))}
        </div>

        <p className="mt-8 text-[15px] text-slate-600 leading-relaxed">
          Mỗi bước đều có GPT hỗ trợ sinh nội dung, kiểm tra tính phù hợp với
          chuẩn đầu ra và mô phỏng hành vi người học. Kết quả cuối cùng là một
          ngân hàng MCQ được kiểm tra cả về mặt chuyên môn lẫn thống kê, sẵn
          sàng sử dụng trong đánh giá năng lực.
        </p>
      </section>
    </div>
  );
}

/* ===== Sub components ===== */

function StepPanel({
  step,
  open,
  onToggle,
}: {
  step: StepDef;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-slate-200 rounded-xl bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-lg bg-brand-600 text-white text-xs flex items-center justify-center">
            {step.id}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">
              {step.title}
            </div>
            <div className="text-[12px] text-slate-500">{step.short}</div>
          </div>
        </div>
        <div className="text-[18px] text-slate-400">{open ? "–" : "+"}</div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 text-sm text-slate-600">
          {/* hàng chip nhỏ tượng trưng node AI */}
          <div className="flex gap-2 mb-3">
            <MiniChip />
            <MiniChip />
            <MiniChip />
          </div>

          <ul className="space-y-1 mb-3">
            {step.bullets.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>

          {/* progress tượng trưng cho bước */}
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-1.5 bg-brand-600 rounded-full"
                style={{ width: `${step.id * 18}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniChip() {
  return (
    <div className="h-6 px-2 rounded-full border border-slate-200 bg-slate-50 text-[10px] flex items-center text-slate-500">
      AI node
    </div>
  );
}

function MiniBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-500 mb-2">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MiniLLO({ label, tag }: { label: string; tag: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="truncate text-slate-600 mr-2">{label}</span>
      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
        {tag}
      </span>
    </div>
  );
}

function MiniBar({ label, width }: { label: string; width: string }) {
  return (
    <div className="flex items-center text-[11px]">
      <span className="w-24 text-slate-600">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 mx-2 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-brand-600"
          style={{ width }}
        />
      </div>
      <span className="text-slate-500">{width}</span>
    </div>
  );
}
