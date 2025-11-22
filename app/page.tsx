export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <section className="grid md:grid-cols-[3fr,2fr] gap-10 items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            ShapleyMCQ Lab
          </h1>
          <p className="text-slate-600 mb-4">
            Nền tảng sinh và đánh giá câu hỏi MCQ thế hệ mới, kết hợp{" "}
            <span className="font-semibold">AI</span>,{" "}
            <span className="font-semibold">Monte Carlo Simulation</span> và{" "}
            <span className="font-semibold">Shapley Values</span> để tối ưu
            distractor và chất lượng câu hỏi.
          </p>
          <ul className="space-y-2 text-sm text-slate-700 mb-6">
            <li>• Bước 1: Chọn chuyên ngành, bậc học, Bloom, LLO.</li>
            <li>• Bước 2: Sinh AU & misconceptions có chủ đích.</li>
            <li>• Bước 3: Sinh MCQ theo chuẩn USMLE/NBME.</li>
            <li>• Bước 4: Đánh giá bằng Monte Carlo + Shapley.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Bắt đầu sử dụng
            </a>
            <a
              href="#pipeline"
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:border-brand-400 hover:text-brand-700"
            >
              Xem pipeline
            </a>
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-5">
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Pipeline tổng quát
          </div>
          <ol className="space-y-3 text-sm text-slate-700">
            <li>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mr-2">
                1
              </span>
              Context & LLO: chuyên ngành, bậc học, Bloom, LLO.
            </li>
            <li>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mr-2">
                2
              </span>
              AU & Misconceptions: khung nội dung và sai lầm thường gặp.
            </li>
            <li>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mr-2">
                3
              </span>
              MCQ Generator: câu hỏi theo chuẩn USMLE/NBME.
            </li>
            <li>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mr-2">
                4
              </span>
              Monte Carlo & Shapley: đánh giá distractor trước khi thi thật.
            </li>
          </ol>
        </div>
      </section>

      <section id="pipeline" className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          Vì sao ShapleyMCQ Lab khác biệt?
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Thay vì chỉ sinh câu hỏi từ AI, ShapleyMCQ Lab xây dựng một pipeline
          đầy đủ: từ LLO và thang Bloom đến sinh AU, phân tích sai lầm thường
          gặp, sinh MCQ theo chuẩn NBME/USMLE, chạy mô phỏng Monte Carlo với
          persona người học, tính Shapley Values cho từng distractor, rồi mới
          để giảng viên duyệt và đưa vào ngân hàng câu hỏi.
        </p>
      </section>
    </div>
  );
}
