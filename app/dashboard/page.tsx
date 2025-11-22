export default function DashboardPage() {
  // Sau này sẽ kiểm tra login, load data từ Supabase, v.v.
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">
        Dashboard
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        Đây sẽ là trung tâm điều khiển cho pipeline AU → Misconceptions → MCQ →
        Monte Carlo → Shapley. Hiện tại mới là skeleton giao diện.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            1. LLO & Bối cảnh
          </h2>
          <p className="text-xs text-slate-600 mb-2">
            Chọn chuyên ngành, bậc học, Bloom, và LLO cho bài cần ra câu hỏi.
          </p>
          <button className="mt-1 inline-flex px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700">
            Bắt đầu
          </button>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            2. AU & Misconceptions
          </h2>
          <p className="text-xs text-slate-600 mb-2">
            Sinh và quản lý các Assessment Units và sai lầm thường gặp.
          </p>
          <button className="mt-1 inline-flex px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:border-brand-500 hover:text-brand-700">
            Quản lý AU
          </button>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">
            3. MCQ & Đánh giá
          </h2>
          <p className="text-xs text-slate-600 mb-2">
            Sinh câu MCQ, đánh giá theo chuẩn USMLE/NBME, Monte Carlo & Shapley.
          </p>
          <button className="mt-1 inline-flex px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:border-brand-500 hover:text-brand-700">
            Xem MCQ
          </button>
        </div>
      </div>
    </div>
  );
}
