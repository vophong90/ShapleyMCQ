import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randn() {
  // Box–Muller
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function logistic(x: number) {
  // tránh overflow nhẹ
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

function p3pl(theta: number, a: number, b: number, c: number) {
  const p = c + (1 - c) * logistic(a * (theta - b));
  return Math.min(0.999999, Math.max(0.000001, p));
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

type SimBody = {
  exam_id?: string;
  // số thí sinh ảo
  n_students?: number;

  // phân phối năng lực theta ~ N(mu, sigma)
  theta_mu?: number;
  theta_sigma?: number;

  // chuẩn thật (theo theta) và chuẩn đậu theo điểm thô
  theta_cut?: number; // ví dụ 0
  raw_cut_percent?: number; // ví dụ 0.6 (60%)

  // worst-case: lấy bin quanh theta_cut
  bin_width?: number; // ví dụ 0.25

  // số lựa chọn (để check sanity, không dùng trực tiếp vì params đã có c)
  k_choice?: number;

  // seed optional (để tái lập) - ở đây chỉ dùng để clamp n, không set RNG global
  seed?: number;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteClient();

    // 1) auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as SimBody;

    const exam_id = body.exam_id?.trim();
    if (!exam_id) {
      return NextResponse.json({ error: "exam_id là bắt buộc" }, { status: 400 });
    }

    // Defaults hợp lý
    const n_students = clamp(Number(body.n_students ?? 5000), 200, 200000);
    const theta_mu = Number(body.theta_mu ?? 0);
    const theta_sigma = clamp(Number(body.theta_sigma ?? 1), 0.2, 5);

    const theta_cut = Number(body.theta_cut ?? 0);
    const raw_cut_percent = clamp(Number(body.raw_cut_percent ?? 0.6), 0.05, 0.95);
    const bin_width = clamp(Number(body.bin_width ?? 0.25), 0.05, 2.0);

    // 2) verify exam exists + owner (RLS chặn nếu không phải owner)
    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .select("id, title, owner_id")
      .eq("id", exam_id)
      .single();

    if (examErr || !exam) {
      return NextResponse.json(
        { error: "Không tìm thấy đề thi hoặc bạn không có quyền." },
        { status: 404 }
      );
    }

    // 3) load IRT params for this exam
    const { data: params, error: pErr } = await supabase
      .from("exam_item_irt_params")
      .select("mcq_item_id, irt_a, irt_b, irt_c, difficulty_label")
      .eq("exam_id", exam_id);

    if (pErr) throw pErr;
    if (!params?.length) {
      return NextResponse.json(
        { error: "Chưa có IRT params. Hãy chạy GPT gán độ khó trước." },
        { status: 400 }
      );
    }

    // 4) simulate responses and misclassification
    const J = params.length;
    const raw_cut = Math.ceil(raw_cut_percent * J); // số câu đúng để đậu

    let mis = 0;
    let false_pass = 0;
    let false_fail = 0;

    // worst-case: chỉ xét thí sinh có theta trong [cut - bw/2, cut + bw/2]
    let wc_total = 0;
    let wc_mis = 0;

    for (let i = 0; i < n_students; i++) {
      const theta = theta_mu + theta_sigma * randn();

      // true pass/fail by theta
      const true_pass = theta >= theta_cut;

      // generate raw score
      let score = 0;
      for (let j = 0; j < J; j++) {
        const a = Number((params[j] as any).irt_a);
        const b = Number((params[j] as any).irt_b);
        const c = Number((params[j] as any).irt_c);
        const p = p3pl(theta, a, b, c);
        if (Math.random() < p) score++;
      }

      const pred_pass = score >= raw_cut;

      const wrong = pred_pass !== true_pass;
      if (wrong) {
        mis++;
        if (pred_pass && !true_pass) false_pass++;
        if (!pred_pass && true_pass) false_fail++;
      }

      const inBin = Math.abs(theta - theta_cut) <= bin_width / 2;
      if (inBin) {
        wc_total++;
        if (wrong) wc_mis++;
      }
    }

    const overall_misclass = (mis / n_students) * 100;
    const fp = (false_pass / n_students) * 100;
    const ff = (false_fail / n_students) * 100;

    const worstcase_misclass =
      wc_total > 0 ? (wc_mis / wc_total) * 100 : overall_misclass;

    // 5) save into exam_irt_simulations
    const insertRow = {
      exam_id,
      owner_id: user.id,

      model: "3PL",
      n_students: Math.round(n_students),
      k_choice: Number(body.k_choice ?? 4),

      theta_mu,
      theta_sigma,

      theta_cut,
      raw_cut_percent,
      bin_width,

      overall_misclass,
      worstcase_misclass,
      false_pass: fp,
      false_fail: ff,
    };

    const { data: saved, error: sErr } = await supabase
      .from("exam_irt_simulations")
      .insert([insertRow])
      .select("id, created_at")
      .single();

    if (sErr) throw sErr;

    return NextResponse.json(
      {
        success: true,
        exam: { id: exam.id, title: exam.title },
        sim_id: saved?.id,
        created_at: saved?.created_at,

        J,
        raw_cut,
        raw_cut_percent,

        overall_misclass,
        worstcase_misclass,
        false_pass: fp,
        false_fail: ff,

        worstcase_bin: {
          theta_cut,
          bin_width,
          n_in_bin: wc_total,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Lỗi server /api/exams/irt-simulate:", e);
    return NextResponse.json(
      { error: "Lỗi server", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
