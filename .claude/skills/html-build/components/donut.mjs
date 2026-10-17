import { pie, arc } from "d3-shape";
import { esc, num, need, callout, unitLabel, SERIES, svgSize } from "./_util.mjs";

// donut：全体の総量が明らかなときの構成比。5項目まで（超える分は「その他」にまとめて渡す）。
// data: { items: [{ label, value }], unit, total?: 中央に書く値, total_label?, callout? }
// opt:  { width, height }
// - 12時の位置から時計回りに、大きい順に並べる（charts.md 3章）。「その他」は値に関係なく最後にする。
// - 色は大きい順に青の濃い方から。「その他」は灰色。
// - 各項目の名前・値・割合を右に並べて書く（色だけで読ませない）。多くの場合は hbar の方が正確に伝わる。

export default function donut(data, opt = {}) {
  need("donut", data, ["items", "unit"]);
  if (data.items.length < 2 || data.items.length > 5) throw new Error("donut: items は2〜5");
  const others = data.items.filter((d) => d.label === "その他");
  const items = data.items.filter((d) => d.label !== "その他").sort((a, b) => b.value - a.value).concat(others);
  const sum = items.reduce((a, d) => a + d.value, 0);
  const { w, h: h0 } = svgSize(data, opt);
  const h = h0 - 24;
  const r = Math.min(h / 2 - 8, 200);
  const cx = r + 8, cy = h / 2;
  const color = (d, k) => (d.label === "その他" ? SERIES[4] : SERIES[Math.min(k, 3)]);
  const arcs = pie().sort(null).value((d) => d.value)(items);
  const shape = arc().innerRadius(r * 0.6).outerRadius(r);
  const slices = arcs
    .map((a, k) => `<path class="${color(a.data, k).fill} stroke-canvas" stroke-width="2" d="${shape(a)}" transform="translate(${cx},${cy})"/>`)
    .join("");
  const center = `<text class="fill-ink text-kpi font-bold" x="${cx}" y="${cy + 4}" text-anchor="middle" dominant-baseline="middle">${esc(data.total ?? num(sum))}</text>
<text class="fill-label text-body" x="${cx}" y="${cy + 44}" text-anchor="middle">${esc(data.total_label ?? `合計（${data.unit}）`)}</text>`;
  const rows = items
    .map((d, k) => `<div class="flex items-center gap-[12px] border-b border-line py-[10px]">
    <span class="inline-block h-[16px] w-[16px] shrink-0 ${color(d, k).bg}"></span>
    <span class="min-w-0 flex-1 text-body text-ink">${esc(d.label)}</span>
    <span class="w-[96px] text-right text-body text-ink">${num(d.value)}</span>
    <span class="w-[72px] text-right text-heading font-bold text-ink">${Math.round((d.value / sum) * 100)}%</span>
  </div>`)
    .join("\n");
  return `<div class="flex h-full w-full gap-[32px]" data-kind="donut">
<div class="flex min-w-0 flex-1 flex-col">
  ${unitLabel(data.unit)}
  <div class="mt-[8px] flex min-h-0 flex-1 items-center gap-[48px]">
    <svg class="block shrink-0" width="${2 * r + 16}" height="${h}" viewBox="0 0 ${2 * r + 16} ${h}" role="img" aria-label="ドーナツグラフ">${slices}${center}</svg>
    <div class="min-w-0 max-w-[480px] flex-1">${rows}</div>
  </div>
</div>
${callout(data.callout)}
</div>`;
}
