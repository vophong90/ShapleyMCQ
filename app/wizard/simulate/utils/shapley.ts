// app/wizard/simulate/utils/shapley.ts
import type { ShapleyRow, SimResult } from "../types";

export function computeShapleyFromSim(sim: SimResult): ShapleyRow[] {
  const distractorLabels = sim.options
    .filter((o) => !o.is_correct)
    .map((o) => o.label);

  const allLabels = ["B", "C", "D", "E", "F"];
  const orderedLabels = allLabels.filter((l) => distractorLabels.includes(l));

  const wrongCounts: Record<string, number> = {};
  const wrongCountsNovice: Record<string, number> = {};

  const lowAbility = new Set(["Novice", "Weak"]);
  let totalWrongAll = 0;
  let totalWrongLow = 0;

  for (const row of sim.response_matrix) {
    if (!row.is_correct) {
      totalWrongAll++;
      wrongCounts[row.chosen_option] =
        (wrongCounts[row.chosen_option] || 0) + 1;

      if (lowAbility.has(row.persona)) {
        totalWrongLow++;
        wrongCountsNovice[row.chosen_option] =
          (wrongCountsNovice[row.chosen_option] || 0) + 1;
      }
    }
  }

  if (totalWrongAll === 0) {
    return orderedLabels.map((label) => {
      const opt = sim.options.find((o) => o.label === label)!;
      return {
        label,
        text: opt.text,
        shapley: 0,
        share_pct: 0,
        wrong_pct: 0,
        novice_pct: 0,
        recommendation:
          "Item quá dễ, hầu hết người học trả lời đúng – khó đánh giá distractor.",
      };
    });
  }

  const n = orderedLabels.length;
  const countsArr = orderedLabels.map((l) => wrongCounts[l] || 0);

  function v(subset: Set<number>): number {
    let sum = 0;
    subset.forEach((idx) => {
      sum += countsArr[idx];
    });
    return sum / totalWrongAll;
  }

  function permutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];
    const result: number[][] = [];
    const [first, ...rest] = arr;
    const perms = permutations(rest);
    for (const p of perms) {
      for (let i = 0; i <= p.length; i++) {
        const copy = [...p];
        copy.splice(i, 0, first);
        result.push(copy);
      }
    }
    return result;
  }

  const perms = permutations([...Array(n).keys()]);
  const shapleyArr = new Array(n).fill(0);

  for (const perm of perms) {
    const S = new Set<number>();
    for (const j of perm) {
      const before = v(S);
      S.add(j);
      const after = v(S);
      const delta = after - before;
      shapleyArr[j] += delta;
    }
  }

  const factor = 1 / perms.length;
  for (let i = 0; i < n; i++) {
    shapleyArr[i] *= factor;
  }

  const rows: ShapleyRow[] = [];
  for (let i = 0; i < n; i++) {
    const label = orderedLabels[i];
    const opt = sim.options.find((o) => o.label === label)!;
    const shap = shapleyArr[i];
    const share_pct = shap * 100;

    const wrong_pct =
      ((wrongCounts[label] || 0) / sim.response_matrix.length) * 100;
    const novice_pct =
      totalWrongLow > 0
        ? ((wrongCountsNovice[label] || 0) / totalWrongLow) * 100
        : 0;

    let recommendation: string;
    if (share_pct >= 40) {
      recommendation =
        "Distractor rất mạnh – nên giữ, có vai trò lớn trong việc phân tán câu trả lời sai.";
    } else if (share_pct >= 25) {
      recommendation =
        "Distractor khá mạnh – nên giữ, có thể tinh chỉnh wording để rõ ràng hơn.";
    } else if (share_pct >= 10) {
      recommendation =
        "Distractor trung bình – có thể giữ nếu cần đủ bốn lựa chọn, cân nhắc cải thiện để hấp dẫn hơn.";
    } else {
      recommendation =
        "Distractor yếu – ít đóng góp vào câu sai, cân nhắc thay bằng distractor khác hoặc bỏ.";
    }

    rows.push({
      label,
      text: opt.text,
      shapley: shap,
      share_pct,
      wrong_pct,
      novice_pct,
      recommendation,
    });
  }

  return rows;
}
