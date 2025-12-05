"use client";

import { useState } from "react";
import Link from "next/link";

type StepGuide = {
  id: number;
  title: string;
  route: string;
  purpose: string;
  actions: string[];
  tips: string[];
};

const STEPS: StepGuide[] = [
  {
    id: 1,
    title: "Bước 1 – Bối cảnh & LLO",
    route: "/wizard/context",
    purpose:
      "Thiết lập toàn bộ bối cảnh học tập (chuyên ngành, bậc đào tạo, học phần, bài học) và chuẩn đầu ra LLO kèm mức Bloom.",
    actions: [
      "Từ Dashboard, mở \"Bước 1. Context & LLO\".",
      "Chọn hoặc tạo mới chuyên ngành và bậc đào tạo phù hợp (VD: YHCT – Sinh viên, Sau đại học…).",
      "Chọn hoặc tạo mới học phần và bài học.",
      "Nhập các LLO cho từng bài học (mỗi dòng là một chuẩn đầu ra).",
      "Gán mức Bloom cho từng LLO (Remember, Understand, Apply, Analyze, Evaluate, Create).",
      "Sử dụng chức năng GPT để kiểm tra sự phù hợp giữa bậc đào tạo, LLO với mức Bloom.",
    ],
    tips: [
      "LLO càng rõ hành động (động từ Bloom) thì các bước sau càng dễ sinh AU & MCQ.",
      "Nên tránh gom nhiều ý vào một LLO – hãy tách thành từng năng lực rõ ràng.",
    ],
  },
  {
    id: 2,
    title: "Bước 2 – Assessment Units (AU)",
    route: "/wizard/au",
    purpose:
      "Từ LLO và tài liệu của giảng viên, trích xuất các \"đơn vị đánh giá\" – những khối kiến thức/ kỹ năng cần được kiểm tra.",
    actions: [
      "Từ Dashboard, mở \"Bước 2. Assessment Units\".",
      "Chọn học phần / bài học đã thiết lập ở Bước 1 để load danh sách LLO liên quan.",
      "Upload tài liệu cá nhân (giáo trình, guideline, slide, handout…).",
      "Dùng GPT để gợi ý danh sách Assessment Units (AU) từ LLO + tài liệu.",
      "Đọc, sàng lọc, chỉnh sửa nội dung AU; xóa hoặc thêm các AU nếu cần.",
      "Gán thêm thuộc tính Bloom cho các AU.",
    ],
    tips: [
      "Mỗi AU nên mô tả một \"đơn vị kiến thức\" đủ nhỏ để tạo 1–3 câu MCQ.",
      "Không cần gán Bloom quá chi tiết ở AU nếu đã làm chặt ở LLO – chỉ đánh dấu mức tối thiểu (bloom_min) là đủ.",
    ],
  },
  {
    id: 3,
    title: "Bước 3 – Misconceptions (Mis)",
    route: "/wizard/misconcepts",
    purpose:
      "Xác định các sai lầm nhận thức thường gặp xuất phát từ từng AU, làm nền cho distractor của câu hỏi.",
    actions: [
      "Từ Dashboard, mở \"Bước 3. Misconceptions\".",
      "Chọn AU hoặc nhóm AU muốn sinh Mis.",
      "Dùng GPT để gợi ý danh sách Mis liên quan tới từng AU (VD: nhầm lẫn cơ chế bệnh sinh, nhầm điều kiện chỉ định, nhầm thứ tự xử trí…).",
      "Duyệt từng Mis: chỉnh câu chữ cho đúng với bối cảnh chương trình đào tạo, bỏ các Mis không phù hợp.",
      "Lưu lại Mis đã chọn, đảm bảo mỗi Mis đều gắn rõ với AU gốc.",
    ],
    tips: [
      "Mis nên mô tả \"cách suy nghĩ sai\" chứ không chỉ là đáp án sai.",
      "Một AU có thể có nhiều Mis, nhưng đừng giữ quá nhiều Mis tương tự nhau – sẽ dư thừa ở bước MCQ.",
    ],
  },
  {
    id: 4,
    title: "Bước 4 – Tạo câu hỏi MCQ",
    route: "/wizard/mcq",
    purpose:
      "Sinh câu hỏi trắc nghiệm từ AU + Mis, kiểm tra cấu trúc và mức Bloom trước khi đưa vào ngân hàng.",
    actions: [
      "Từ Dashboard, mở \"Bước 4. MCQ Generator\".",
      "Chọn AU và các Mis liên quan để làm đầu vào sinh câu hỏi.",
      "Dùng GPT để sinh stem, key và distractor (dựa trên Mis đã chọn).",
      "Đọc lại từng MCQ: chỉnh câu chữ, ngữ cảnh lâm sàng, từ ngữ chuyên môn.",
      "Kiểm tra mức Bloom mục tiêu của câu hỏi so với Bloom của LLO / AU.",
      "Sử dụng chức năng đánh giá cấu trúc (USMLE/NBME-style).",
      "Lưu MCQ đã hoàn chỉnh vào ngân hàng để chuẩn bị cho bước mô phỏng.",
    ],
    tips: [
      "Stem nên rõ ràng, không mơ hồ, tránh nhắc lại từ khoá của đáp án đúng.",
      "Distractor tốt phải dựa trên Mis có thật, không phải đáp án vô lý.",
    ],
  },
  {
    id: 5,
    title: "Bước 5 – Phân tích MCQ (Monte Carlo & Shapley)",
    route: "/wizard/simulate",
    purpose:
      "Mô phỏng người học làm bài, phân tích hành vi chọn đáp án và đo đóng góp của từng distractor bằng Shapley value.",
    actions: [
      "Từ Dashboard, mở \"Bước 5. MCQ Analysis\".",
      "Chọn bộ đề hoặc nhóm MCQ cần phân tích.",
      "Thiết lập tỷ lệ các persona người học hoặc dùng tỷ lệ do hệ thống gợi ý.",
      "Chạy mô phỏng Monte Carlo để tạo dữ liệu làm bài của số lượng lớn người học ảo.",
      "Tính và đọc Shapley Value cho từng distractor để biết distractor nào đóng góp nhiều nhất vào khả năng phân biệt.",
      "Quay lại chỉnh sửa hoặc loại bỏ những distractor chất lượng thấp, sau đó lưu phiên bản câu hỏi đã tinh chỉnh.",
    ],
    tips: [
      "Distractor có Shapley value rất thấp hoặc âm liên tục có thể cần viết lại hoặc bỏ.",
      "Nên phân tích theo từng nhóm MCQ cùng chủ đề để dễ so sánh.",
    ],
  },
];

export default function GuidePage() {
  const [openId, setOpenId] = useState<number | null>(1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          Hướng dẫn sử dụng ShapleyMCQ Lab
        </h1>
        <p className="text-[15px] text-slate-600 leading-relaxed max-w-2xl">
          Trang này giải thích chi tiết cách đi qua 5 bước của pipeline:
          từ chuẩn đầu ra (LLO) đến ngân hàng câu hỏi MCQ đã được phân tích
          bằng Monte Carlo và Shapley Value.
        </p>
      </header>

      <section className="space-y-3">
        {STEPS.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            open={openId === step.id}
            onToggle={() =>
              setOpenId((prev) => (prev === step.id ? null : step.id))
            }
          />
        ))}
      </section>
    </div>
  );
}

function StepCard({
  step,
  open,
  onToggle,
}: {
  step: StepGuide;
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
            <div className="text-[12px] text-slate-500">{step.purpose}</div>
          </div>
        </div>
        <div className="text-[18px] text-slate-400">{open ? "–" : "+"}</div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 text-sm text-slate-600 space-y-3">
          <div>
            <div className="text-[12px] font-semibold text-slate-700 mb-1">
              Cách thực hiện
            </div>
            <ol className="list-decimal list-inside space-y-1">
              {step.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </div>

          <div>
            <div className="text-[12px] font-semibold text-slate-700 mb-1">
              Gợi ý & lưu ý
            </div>
            <ul className="list-disc list-inside space-y-1">
              {step.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>

          <div className="pt-1">
            <Link
              href={step.route}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
            >
              Mở bước này trong ứng dụng →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
