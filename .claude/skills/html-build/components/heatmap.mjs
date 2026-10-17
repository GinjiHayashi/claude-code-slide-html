import { esc, need, num, unitLabel, seqStep } from "./_util.mjs";

// heatmap：2つの分類の組み合わせごとの値を、青の濃淡で示す。
// data: { rows: [行の名前], columns: [列の名前], values: [[行ごとの値]], unit, steps?: 段階の数（3〜5。既定 5） }
// - 最小から最大までを等しい幅で区切り、濃いほど大きい。色だけに頼らないよう、マスには値も書く。
// - 下に凡例（各段階の範囲）を書く。12行×12列まで。

export default function heatmap(data) {
  need("heatmap", data, ["rows", "columns", "values", "unit"]);
  const R = data.rows, C = data.columns, V = data.values;
  if (R.length > 12 || C.length > 12) throw new Error("heatmap: 12行×12列まで");
  if (V.length !== R.length || V.some((r) => r.length !== C.length)) throw new Error("heatmap: values は 行の数 × 列の数");
  const { shades: S, step, legend } = seqStep(V.flat(), data.steps ?? 5);
  const head = C.map((c) => `<div class="flex items-end justify-center pb-[4px] text-center text-caption font-bold text-label">${esc(c)}</div>`).join("");
  const body = R.map((r, i) => `<div class="flex items-center pr-[12px] text-body font-bold text-ink">${esc(r)}</div>` + V[i].map((v) => {
    const s = S[step(v)];
    return `<div class="flex items-center justify-center text-body ${s.bg} ${s.text}">${num(v)}</div>`;
  }).join("")).join("");
  return `<div class="flex h-full w-full flex-col gap-[8px]" data-kind="heatmap">
${unitLabel(data.unit)}
<div class="grid min-h-0 flex-1 gap-[2px]" style="grid-template-columns: auto repeat(${C.length}, 1fr); grid-template-rows: auto repeat(${R.length}, 1fr)">
<div></div>${head}
${body}
</div>
<div class="flex justify-end gap-[16px]">${legend}</div>
</div>`;
}
