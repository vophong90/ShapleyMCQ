export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* ===== HERO SECTION ===== */}
      <section className="grid md:grid-cols-[3fr,2fr] gap-10 items-center">
        {/* LEFT: TEXT + CTA */}
        <div>
          {/* Badge trên cùng */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-medium text-emerald-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Nền tảng xây dựng & phân tích MCQ dựa trên LLO – Bloom – Shapley
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            ShapleyMCQ Lab
          </h1>

          <p className="text-slate-600 mb-4 text-sm md:text-base">
            Nền tảng hỗ trợ sinh – đánh giá – tối ưu câu hỏi trắc nghiệm MCQ
            thế hệ mới, kết hợp{" "}
            <span className="font-semibold">AI</span>,{" "}
            <span className="font-semibold">Monte Carlo Simulation</span> và{" "}
            <span className="font-semibold">Shapley Values</span> để đảm bảo
            chất lượng ngân hàng câu hỏi theo chuẩn đào tạo y khoa hiện đại.
          </p>

          {/* 4 “chips” tóm tắt tính năng */}
          <div className="flex flex-wrap gap-2 mb-6 text-[11px]">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              LLO & Bloom alignment
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              AU & Misconceptions có chủ đích
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              MCQ theo chuẩn USMLE / NBME
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              Monte Carlo & Shapley cho distractor
            </span>
          </div>

          {/* Tóm tắt pipeline mới – có icon từng bước */}
          <ul className="space-y-2 text-sm text-slate-700 mb-6">
            <li className="flex items-start gap-2">
              <span className="mt-[2px]">📚</span>
              <span>
                <span className="font-semibold">Bước 1 – Bối cảnh & LLO:</span>{" "}
                Thiết lập Chuyên ngành – Bậc đào tạo – Học phần – Bài học – LLO – Bloom, 
                kiểm tra mức Bloom phù hợp cho từng LLO.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-[2px]">🧩</span>
              <span>
                <span className="font-semibold">Bước 2 – Assessment Units:</span>{" "}
                Upload tài liệu cá nhân, GPT hỗ trợ sinh AU, người dùng sàng lọc 
                và hoàn thiện AU trọng tâm.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-[2px]">⚠️</span>
              <span>
                <span className="font-semibold">Bước 3 – Misconceptions:</span>{" "}
                GPT tạo các sai lầm (Mis) từ AU đã chọn; người dùng chỉnh sửa, chuẩn hóa 
                và lưu lại những sai lầm then chốt.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-[2px]">✏️</span>
              <span>
                <span className="font-semibold">Bước 4 – MCQ Generator:</span>{" "}
                GPT sinh MCQ từ AU & Mis, đánh giá mức Bloom, kiểm tra cấu trúc 
                theo chuẩn NBME/USMLE; giảng viên tinh chỉnh và lưu vào ngân hàng câu hỏi.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-[2px]">🎯</span>
              <span>
                <span className="font-semibold">Bước 5 – Phân tích MCQ:</span>{" "}
                GPT mô phỏng người học ở nhiều mức năng lực (Monte Carlo), tính{" "}
                Shapley Value cho từng distractor, hỗ trợ chỉnh sửa tới khi không còn 
                distractor chất lượng thấp.
              </span>
            </li>
          </ul>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Bắt đầu sử dụng
            </a>
            <a
              href="#pipeline"
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
            >
              Xem chi tiết pipeline
            </a>
          </div>
        </div>

        {/* RIGHT: MOCKUP UI MINH HỌA PIPELINE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          {/* Thanh “cửa sổ app” */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </div>
            <span className="text-[11px] text-slate-400">
              shapleymcq-lab / pipeline
            </span>
          </div>

          {/* “Dashboard” thu nhỏ */}
          <div className="space-y-4">
            {/* Hàng step tags */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                1. Context & LLO
              </span>
              <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-700">
                2. AU
              </span>
              <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                3. Mis
              </span>
              <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700">
                4. MCQ
              </span>
              <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">
                5. Analysis
              </span>
            </div>

            {/* Mockup: 2 cột – LLO/Bloom + MCQ/Analysis */}
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              {/* LLO & Bloom */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700">
                    LLO & Bloom
                  </span>
                  <span className="text-[10px] text-slate-400">Step 1</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="truncate">LO1: Chẩn đoán viêm loét…</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Apply
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate">LO2: Giải thích cơ chế…</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                      Understand
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate">LO3: Lập kế hoạch điều trị…</span>
                    <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      Analyze
                    </span>
                  </div>
                </div>
              </div>

              {/* MCQ & Analysis */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700">
                    MCQ & Shapley
                  </span>
                  <span className="text-[10px] text-slate-400">Step 4–5</span>
                </div>

                {/* Mock bar chart nhỏ cho distractors */}
                <div className="mt-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Distractor A
                    </span>
                    <div className="flex-1 mx-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-1.5 w-4/5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[10px] text-emerald-700">+0.18</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Distractor B
                    </span>
                    <div className="flex-1 mx-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-1.5 w-2/5 rounded-full bg-amber-400" />
                    </div>
                    <span className="text-[10px] text-amber-700">+0.06</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Distractor C
                    </span>
                    <div className="flex-1 mx-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-1.5 w-1/5 rounded-full bg-rose-400" />
                    </div>
                    <span className="text-[10px] text-rose-700">-0.02</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dòng chú thích nhỏ dưới cùng */}
            <p className="text-[11px] text-slate-500 mt-2">
              Mỗi bước đều có hỗ trợ GPT để sinh nội dung, kiểm tra mức Bloom,
              mô phỏng người học và gợi ý chỉnh sửa câu hỏi trước khi đưa vào
              ngân hàng MCQ chính thức.
            </p>
          </div>
        </div>
      </section>

      {/* ===== BOTTOM SECTION: GIẢI THÍCH CHI TIẾT PIPELINE ===== */}
      <section id="pipeline" className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          Tại sao ShapleyMCQ Lab khác biệt?
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed mb-4">
          Khác với các công cụ chỉ dừng lại ở việc sinh câu hỏi từ AI,
          ShapleyMCQ Lab thiết kế một pipeline hoàn chỉnh: từ chuẩn đầu ra (LLO),
          mức Bloom và đơn vị đánh giá (AU), đến phân tích sai lầm thường gặp,
          sinh câu hỏi theo chuẩn NBME/USMLE, và cuối cùng là mô phỏng người học
          bằng Monte Carlo kết hợp Shapley Value. Mỗi câu hỏi trước khi được
          đưa vào ngân hàng đều trải qua một vòng phản biện sư phạm – thống kê –
          mô phỏng để đảm bảo tính phân loại và độ tin cậy.
        </p>
      </section>
    </div>
  );
}
