import { scaleLinear, scalePoint } from "d3-scale";
import { area as d3area, stack, stackOffsetExpand } from "d3-shape";
import { esc, need, callout, unitLabel, SERIES, svgSize } from "./_util.mjs";
import { yGrid, xLabels, spread } from "./_axis.mjs";

// area：量と構成比の時間の変化を示す積み上げ面グラフ。系列は5まで、時点は24まで。
// data: { x: [string], series: [{ name, values: [number] }], unit, percent?, callout? }
// opt:  { width, height }
// - 下から series の順に積む。percent: true で各時点を 100% にそろえる。
// - 系列名は、それぞれの面の右端の近くに書く（charts.md 3章）。面の境目には白い線を引いて区別しやすくする。

export default function area(data, opt = {}) {
  need("area", data, ["x", "series", "unit"]);
  const { x: xs, series } = data;
  if (series.length < 2 || series.length > 5) throw new Error("area: 系列は2〜5");
  if (xs.length < 2 || xs.length > 24) throw new Error("area: 時点は2〜24");
  const { w, h: h0 } = svgSize(data, opt);
  const h = h0 - 26; // 単位（18）と間（8）の分
  const m = { l: 64, r: 168, t: 12, b: 32 };
  const rows = xs.map((_, i) => Object.fromEntries(series.map((s) => [s.name, s.values[i]])));
  const st = stack().keys(series.map((s) => s.name));
  if (data.percent) st.offset(stackOffsetExpand);
  const layers = st(rows);
  const top = data.percent ? 1 : Math.max(...layers.at(-1).map((d) => d[1]));
  const y = scaleLinear().domain([0, top]).nice(5).range([h - m.b, m.t]);
  const x = scalePoint().domain(xs).range([m.l, w - m.r]).padding(0);
  const shape = d3area().x((d, i) => x(xs[i])).y0((d) => y(d[0])).y1((d) => y(d[1]));
  const fmt = data.percent ? (v) => `${Math.round(v * 100)}%` : undefined;
  const paths = layers
    .map((L, k) => `<path class="${SERIES[k].fill} stroke-canvas" stroke-width="1.5" d="${shape(L)}"/>`)
    .join("");
  const labels = spread(layers.map((L, k) => ({ k, y: y((L.at(-1)[0] + L.at(-1)[1]) / 2) })), 22, m.t, h - m.b)
    // 文字は白地で読める ink にし、どの面かは文字の前の色の四角で示す
    .map(({ k, y: ly }) => `<rect class="${SERIES[k].fill}" x="${w - m.r + 16}" y="${(ly - 7).toFixed(1)}" width="14" height="14"/><text class="fill-ink text-body font-bold" x="${w - m.r + 38}" y="${ly.toFixed(1)}" dominant-baseline="middle">${esc(series[k].name)}</text>`)
    .join("");
  return `<div class="flex h-full w-full gap-[32px]" data-kind="area">
<div class="flex min-w-0 flex-1 flex-col">
  ${unitLabel(data.percent ? "%" : data.unit)}
  <svg class="mt-[8px] block overflow-visible" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="面グラフ">
  ${yGrid(y, m.l, w - m.r, fmt)}
  ${paths}
  <line class="stroke-gray-600" x1="${m.l}" x2="${w - m.r}" y1="${y(0)}" y2="${y(0)}" stroke-width="2"/>
  ${xLabels(xs, (l) => x(l), h - 8)}
  ${labels}
  </svg>
</div>
${callout(data.callout)}
</div>`;
}
