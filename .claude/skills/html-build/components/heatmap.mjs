import { esc, need, num, unitLabel } from "./_util.mjs";

// heatmap：2つの分類の組み合わせごとの値を、青の濃淡で示す（試作）。
// data: { rows: [行の名前], columns: [列の名前], values: [[行ごとの値]], unit, steps?: 段階の数（3〜5。既定 5） }
// - 最小から最大までを等しい幅で区切り、濃いほど大きい。色だけに頼らないよう、マスには値も書く。
// - 下に凡例（各段階の範囲）を書く。12行×12列まで。

const SHADES = [
  { bg: "bg-blue-50", text: "text-ink" },
  { bg: "bg-blue-200", text: "text-ink" },
  { bg: "bg-blue-400", text: "text-ink" },
  { bg: "bg-blue-600", text: "text-on-primary" },
  { bg: "bg-blue-900", text: "text-on-primary" },
];
const PICK = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };

export default function heatmap(data) {
  need("heatmap", data, ["rows", "columns", "values", "unit"]);
  const R = data.rows, C = data.columns, V = data.values;
  if (R.length > 12 || C.length > 12) throw new Error("heatmap: 12行×12列まで");
  if (V.length !== R.length || V.some((r) => r.length !== C.length)) throw new Error("heatmap: values は 行の数 × 列の数");
  const n = data.steps ?? 5;
  if (!PICK[n]) throw new Error("heatmap: steps は3〜5");
  const S = PICK[n].map((i) => SHADES[i]);
  const all = V.flat(), lo = Math.min(...all), hi = Math.max(...all);
  const w = (hi - lo) / n || 1;
  const step = (v) => Math.min(n - 1, Math.floor((v - lo) / w));
  const head = C.map((c) => `<div class="flex items-end justify-center pb-[4px] text-center text-caption font-bold text-label">${esc(c)}</div>`).join("");
  const body = R.map((r, i) => `<div class="flex items-center pr-[12px] text-body font-bold text-ink">${esc(r)}</div>` + V[i].map((v) => {
    const s = S[step(v)];
    return `<div class="flex items-center justify-center text-body ${s.bg} ${s.text}">${num(v)}</div>`;
  }).join("")).join("");
  const legend = S.map((s, k) => {
    const a = lo + w * k, b = k === n - 1 ? hi : lo + w * (k + 1);
    return `<div class="flex items-center gap-[6px]"><span class="inline-block h-[16px] w-[24px] border border-line ${s.bg}"></span><span class="text-caption text-label">${num(Math.round(a))}〜${num(Math.round(b))}</span></div>`;
  }).join("");
  return `<div class="flex h-full w-full flex-col gap-[8px]" data-kind="heatmap">
${unitLabel(data.unit)}
<div class="grid min-h-0 flex-1 gap-[2px]" style="grid-template-columns: auto repeat(${C.length}, 1fr); grid-template-rows: auto repeat(${R.length}, 1fr)">
<div></div>${head}
${body}
</div>
<div class="flex justify-end gap-[16px]">${legend}</div>
</div>`;
}
