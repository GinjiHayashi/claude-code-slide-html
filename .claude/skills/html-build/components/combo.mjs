import { scaleLinear, scaleBand } from "d3-scale";
import { line as d3line } from "d3-shape";
import { esc, num, need, callout, svgSize } from "./_util.mjs";
import { yGrid, xLabels } from "./_axis.mjs";

// combo：量（棒）と推移（線）を同時に見せる複合グラフ。棒と線を1系列ずつ。時点は12まで。
// data: { x: [string], bar: { name, values, unit }, line: { name, values, unit }, callout? }
// opt:  { width, height }
// - 棒は左の軸（0から）、線は右の軸。単位の違う2つを1枚で見せる（charts.md 2章）。
// - 棒は gray-400 で、棒の中に数値を書く。線は primary の太線で、印の上に数値を書く。
// - 左上と右上に、それぞれの軸が何か（名前と単位）を書く。

export default function combo(data, opt = {}) {
  need("combo", data, ["x", "bar", "line"]);
  const { x: xs, bar, line: ln } = data;
  if (xs.length < 2 || xs.length > 12) throw new Error("combo: 時点は2〜12");
  const { w, h } = svgSize(data, opt);
  const m = { l: 64, r: 64, t: 40, b: 32 };
  const x = scaleBand().domain(xs).range([m.l, w - m.r]).padding(0.4);
  const yb = scaleLinear().domain([0, Math.max(...bar.values)]).nice(5).range([h - m.b, m.t]);
  const yl = scaleLinear().domain([Math.min(0, ...ln.values), Math.max(...ln.values)]).nice(5).range([h - m.b, m.t]);
  const cx = (l) => x(l) + x.bandwidth() / 2;
  const bars = xs
    .map((l, i) => {
      const top = yb(bar.values[i]);
      const bh = h - m.b - top;
      return `<rect class="fill-gray-400" x="${x(l).toFixed(1)}" y="${top.toFixed(1)}" width="${x.bandwidth().toFixed(1)}" height="${bh.toFixed(1)}"/>
<text class="fill-ink text-caption" x="${cx(l).toFixed(1)}" y="${(h - m.b - 8).toFixed(1)}" text-anchor="middle">${num(bar.values[i])}</text>`;
    })
    .join("");
  const pts = ln.values.map((v, i) => [cx(xs[i]), yl(v)]);
  const path = d3line()(pts);
  const marks = pts
    .map(([px, py], i) => `<circle class="fill-primary stroke-canvas" stroke-width="2" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6"/>
<text class="fill-primary text-caption font-bold" x="${px.toFixed(1)}" y="${(py - 14).toFixed(1)}" text-anchor="middle">${num(ln.values[i])}</text>`)
    .join("");
  return `<div class="flex h-full w-full gap-[32px]" data-kind="combo">
<div class="flex min-w-0 flex-1 flex-col">
  <svg data-origin="generated" class="block overflow-visible" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="複合グラフ">
  <rect class="fill-gray-400" x="${m.l - 56}" y="4" width="14" height="14"/>
  <text class="fill-ink text-body" x="${m.l - 36}" y="20">${esc(bar.name)}（${esc(bar.unit)}・左の目盛）</text>
  <circle class="fill-primary" cx="${w - m.r + 50}" cy="11" r="6"/>
  <text class="fill-primary text-body font-bold" x="${w - m.r + 36}" y="20" text-anchor="end">${esc(ln.name)}（${esc(ln.unit)}・右の目盛）</text>
  ${yGrid(yb, m.l, w - m.r)}
  ${yl.ticks(5).map((t) => `<text class="fill-primary text-caption" x="${w - m.r + 10}" y="${yl(t).toFixed(1)}" dominant-baseline="middle">${t.toLocaleString("ja-JP")}</text>`).join("")}
  ${bars}
  <line class="stroke-gray-600" x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}" stroke-width="2"/>
  <path class="fill-none stroke-primary" stroke-width="4" stroke-linejoin="round" d="${path}"/>
  ${marks}
  ${xLabels(xs, (l) => cx(l), h - 8)}
  </svg>
</div>
${callout(data.callout)}
</div>`;
}
