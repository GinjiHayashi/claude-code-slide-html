import { scaleLinear, scalePoint } from "d3-scale";
import { line as d3line } from "d3-shape";
import { esc, num, need, callout, unitLabel, SERIES, marker, svgSize } from "./_util.mjs";
import { yGrid, xLabels, spread } from "./_axis.mjs";

// line：時間の変化と傾向を示す折れ線。系列は4まで、時点は24まで。
// data: { x: [string], series: [{ name, values: [number] }], unit, highlight?: 系列名, target?: { value, label? }, zero?, callout? }
// opt:  { width, height }（置く枠の大きさ。スライドの型が渡す。既定は title-diagram の 1172×440）
// - 縦軸は既定で0を含める（zero: false で値の範囲に合わせる）。
// - highlight の系列だけ primary の太線、ほかは gray-400。highlight がなければ青の濃淡で塗り分ける。
// - データ点には系列ごとに形の違う印を付け、系列名と最後の値を線の右端に直接書く（凡例を離さない。charts.md 3章）。
// - target は点線で示す。callout は任意。

export default function line(data, opt = {}) {
  need("line", data, ["x", "series", "unit"]);
  const { x: xs, series } = data;
  if (series.length < 1 || series.length > 4) throw new Error("line: 系列は1〜4");
  if (xs.length < 2 || xs.length > 24) throw new Error("line: 時点は2〜24");
  const { w, h: h0 } = svgSize(data, opt);
  const h = h0 - 26; // 上に単位を書く分（単位 18 ＋ 間 8）
  const m = { l: 64, r: 184, t: 12, b: 32 };
  const all = series.flatMap((s) => s.values).concat(data.target ? [data.target.value] : []);
  const lo = data.zero === false ? Math.min(...all) : Math.min(0, ...all);
  const y = scaleLinear().domain([lo, Math.max(...all)]).nice(5).range([h - m.b, m.t]);
  const x = scalePoint().domain(xs).range([m.l, w - m.r]).padding(0.2);
  const anyHi = series.some((s) => s.name === data.highlight);
  const look = (s, k) =>
    !anyHi ? { ...SERIES[k], width: 3, strong: true }
    : s.name === data.highlight ? { ...SERIES[0], width: 4, strong: true }
    : { ...SERIES[4], width: 2, strong: false };

  const path = d3line().x((d) => x(d[0])).y((d) => y(d[1]));
  const lines = series
    .map((s, k) => {
      const L = look(s, k);
      const pts = s.values.map((v, i) => [xs[i], v]);
      const marks = pts.map(([xi, v]) => marker(k, x(xi), y(v), L.fill)).join("");
      return `<path class="fill-none ${L.stroke}" stroke-width="${L.width}" stroke-linejoin="round" d="${path(pts)}"/>${marks}`;
    });
  // 強調する系列を最後に描いて、いちばん上に重ねる
  const order = series.map((s, k) => k).sort((a, b) => look(series[a], a).strong - look(series[b], b).strong);
  const ends = spread(series.map((s, k) => ({ s, k, y: y(s.values.at(-1)) })), 22, m.t, h - m.b)
    .map(({ s, k, y: ly }) => {
      const L = look(s, k);
      // 文字は白地で 4.5:1 を満たす色にし、系列の色と印の形は文字の前の印で示す（淡い青の文字は読みにくいため）
      const txt = !L.strong ? "fill-label" : anyHi ? "fill-primary font-bold" : "fill-ink font-bold";
      return `${marker(k, w - m.r + 22, ly, L.fill)}<text class="${txt} text-body" x="${w - m.r + 36}" y="${ly.toFixed(1)}" dominant-baseline="middle">${esc(s.name)}　${num(s.values.at(-1))}</text>`;
    })
    .join("");
  const ty = data.target ? y(data.target.value).toFixed(1) : 0;
  const target = data.target
    ? `<line class="stroke-gray-600" x1="${m.l}" x2="${w - m.r}" y1="${ty}" y2="${ty}" stroke-width="2" stroke-dasharray="8 6"/>
<text class="fill-gray-800 text-caption" x="${m.l + 4}" y="${ty - 8}">${esc(data.target.label ?? "目標")}　${num(data.target.value)}</text>`
    : "";
  return `<div class="flex h-full w-full gap-[32px]" data-kind="line">
<div class="flex min-w-0 flex-1 flex-col">
  ${unitLabel(data.unit)}
  <svg data-origin="generated" class="mt-[8px] block overflow-visible" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="折れ線グラフ">
  ${yGrid(y, m.l, w - m.r)}
  <line class="stroke-gray-600" x1="${m.l}" x2="${w - m.r}" y1="${y(lo)}" y2="${y(lo)}" stroke-width="2"/>
  ${xLabels(xs, (l) => x(l), h - 8)}
  ${target}
  ${order.map((k) => lines[k]).join("")}
  ${ends}
  </svg>
</div>
${callout(data.callout)}
</div>`;
}
