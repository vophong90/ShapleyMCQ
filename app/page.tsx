export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* ================= HERO ================= */}
      <section className="grid md:grid-cols-2 gap-12 items-center">
        
        {/* LEFT CONTENT */}
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 mb-4 leading-tight">
            ShapleyMCQ Lab
          </h1>

          <p className="text-slate-600 text-[15px] leading-relaxed mb-6">
            Nền tảng hỗ trợ giảng viên xây dựng và phân tích câu hỏi MCQ theo
            quy trình chuẩn hoá, kết hợp AI, Monte Carlo Simulation và Shapley
            Values — giúp đảm bảo chất lượng sư phạm, mức Bloom phù hợp và khả
            năng phân loại của từng câu hỏi.
          </p>

          {/* 5 STEP PIPELINE (minimal style) */}
          <div className="space-y-4 mb-8">
            <Step
              number={1}
              title="Thiết lập bối cảnh & LLO"
              desc="Chuyên ngành – Bậc đào tạo – Học phần – Bài học – LLO – Bloom; kiểm tra mức Bloom phù hợp."
            />
            <Step
              number={2}
              title="Tạo Assessment Units (AU)"
              desc="Upload tài liệu, GPT đề xuất AU; người dùng chọn lọc và hoàn thiện AU trọng tâm."
            />
            <Step
              number={3}
              title="Sinh Misconceptions"
              desc="GPT tạo Mis từ AU đã chọn; người dùng chuẩn hoá và lưu sai lầm then chốt."
            />
            <Step
              number={4}
              title="Tạo MCQ theo chuẩn USMLE/NBME"
              desc="GPT sinh MCQ từ AU & Mis; đánh giá mức Bloom và cấu trúc câu hỏi."
            />
            <Step
              number={5}
              title="Phân tích MCQ bằng Monte Carlo + Shapley"
              desc="Mô phỏng người học ở nhiều mức năng lực; đánh giá distractor và tối ưu hóa câu hỏi."
            />
          </div>

          <div className="flex gap-3">
            <a
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Bắt đầu sử dụng
            </a>
            <a
              href="#pipeline"
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:border-slate-400"
            >
              Xem chi tiết pipeline
            </a>
          </div>
        </div>

        {/* RIGHT MOCKUP — CLEAN, MINIMAL */}
        <div className="border rounded-2xl bg-white shadow-sm p-6">
          <div className="mb-4">
            <div className="h-2 w-20 bg-emerald-600 rounded-full mb-2"></div>
            <div className="h-2 w-32 bg-slate-200 rounded-full"></div>
          </div>

          <div className="space-y-5">
            <MockBlock title="LLO & Bloom">
              <MockLlo label="LO1: Chẩn đoán..." level="Apply" />
              <MockLlo label="LO2: Giải thích..." level="Understand" />
              <MockLlo label="LO3: Lập kế hoạch..." level="Analyze" />
            </MockBlock>

            <MockBlock title="MCQ & Distractor Analysis">
              <MockBar label="Distractor A" value="80%" color="emerald" />
              <MockBar label="Distractor B" value="40%" color="amber" />
              <MockBar label="Distractor C" value="20%" color="rose" />
            </MockBlock>
          </div>
        </div>
      </section>

      {/* ================= WHY SECTION ================= */}
      <section id="pipeline" className="mt-20">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          Vì sao ShapleyMCQ Lab khác biệt?
        </h2>
        <p className="text-[15px] text-slate-600 leading-relaxed">
          ShapleyMCQ Lab không chỉ sinh câu hỏi từ AI. Nền tảng cung cấp quy 
          trình đầy đủ — từ chuẩn đầu ra, đơn vị đánh giá, sai lầm trọng tâm, 
          đến sinh MCQ và phân tích distractor bằng mô phỏng thống kê. Điều này 
          đảm bảo mỗi câu hỏi được kiểm chứng về tính phân loại, mức Bloom phù 
          hợp và độ tin cậy trước khi đưa vào ngân hàng đề thi chính thức.
        </p>
      </section>
    </div>
  );
}

/* ================= REUSABLE COMPONENTS ================= */

function Step({
  number,
  title,
  desc,
}: {
  number: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="h-6 w-6 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
        {number}
      </div>
      <div>
        <div className="font-medium text-slate-800">{title}</div>
        <div className="text-sm text-slate-500 leading-snug">{desc}</div>
      </div>
    </div>
  );
}

function MockBlock({ title, children }: any) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MockLlo({ label, level }: { label: string; level: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="truncate text-slate-600">{label}</span>
      <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-700">
        {level}
      </span>
    </div>
  );
}

function MockBar({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: any = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
  };
  return (
    <div className="flex items-center text-xs">
      <span className="w-24 text-slate-600">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 mx-2 overflow-hidden">
        <div
          className={`h-1.5 rounded-full ${colorMap[color]}`}
          style={{ width: value }}
        ></div>
      </div>
      <span className={`text-${color}-700}`}>{value}</span>
    </div>
  );
}
