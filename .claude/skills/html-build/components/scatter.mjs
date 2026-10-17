import { scaleLinear } from "d3-scale";
import { esc, need, callout, svgSize } from "./_util.mjs";
import { yGrid } from "./_axis.mjs";

// scatter：2つの量の関係を示す散布図。点は50まで。
// data: { points: [{ x, y, label? }], x_label, x_unit, y_label, y_unit, highlight?: [label], callout? }
// opt:  { width, height }
// - 名前（label）は、highlight に挙げた点にだけ書く（全部に書くと読めなくなるため）。
// - highlight の点は primary、ほかは gray-400。highlight がなければ全部 blue-600。

export default function scatter(data, opt = {}) {
  need("scatter", data, ["points", "x_unit", "y_unit"]);
  const P = data.points;
  if (P.length < 3 || P.length > 50) throw new Error("scatter: 点は3〜50");
  const { w, h } = svgSize(data, opt);
  const m = { l: 72, r: 24, t: 32, b: 56 };
  const x = scaleLinear().domain([Math.min(0, ...P.map((p) => p.x)), Math.max(...P.map((p) => p.x))]).nice(5).range([m.l, w - m.r]);
  const y = scaleLinear().domain([Math.min(0, ...P.map((p) => p.y)), Math.max(...P.map((p) => p.y))]).nice(5).range([h - m.b, m.t]);
  const hi = new Set(data.highlight ?? []);
  const anyHi = hi.size > 0;
  const dots = [...P]
    .sort((a, b) => hi.has(a.label) - hi.has(b.label)) // 強調する点を上に重ねる
    .map((p) => {
      const on = hi.has(p.label);
      const cls = !anyHi ? "fill-blue-600" : on ? "fill-primary" : "fill-gray-400";
      const tag = on ? `<text class="fill-primary text-body font-bold" x="${(x(p.x) + 12).toFixed(1)}" y="${(y(p.y) - 10).toFixed(1)}">${esc(p.label)}</text>` : "";
      return `<circle class="${cls} stroke-canvas" stroke-width="1.5" cx="${x(p.x).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="${on ? 8 : 6}"/>${tag}`;
    })
    .join("");
  const xt = x.ticks(6).map((t) => `<line class="stroke-line" x1="${x(t)}" x2="${x(t)}" y1="${m.t}" y2="${h - m.b}"/><text class="fill-label text-caption" x="${x(t)}" y="${h - m.b + 20}" text-anchor="middle">${t.toLocaleString("ja-JP")}</text>`).join("");
  return `<div class="flex h-full w-full gap-[32px]" data-kind="scatter">
<div class="flex min-w-0 flex-1 flex-col">
  <svg class="block overflow-visible" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="散布図">
  <text class="fill-label text-caption" x="${m.l - 64}" y="14">縦：${esc(data.y_label ?? "")}（${esc(data.y_unit)}）</text>
  ${yGrid(y, m.l, w - m.r)}
  ${xt}
  <line class="stroke-gray-600" x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}" stroke-width="2"/>
  <line class="stroke-gray-600" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${h - m.b}" stroke-width="2"/>
  <text class="fill-label text-caption" x="${w - m.r}" y="${h - 6}" text-anchor="end">横：${esc(data.x_label ?? "")}（${esc(data.x_unit)}）</text>
  ${dots}
  </svg>
</div>
${callout(data.callout)}
</div>`;
}
