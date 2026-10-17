import { pie, arc } from "d3-shape";
import { esc, num, need, callout, unitLabel, SERIES, svgSize } from "./_util.mjs";
import { spread } from "./_axis.mjs";

// donut：全体の総量が明らかなときの構成比。5項目まで（超える分は「その他」にまとめて渡す）。
// data: { items: [{ label, value }], unit, total?: 中央に書く値, total_label?, legend?, callout? }
// legend（項目名の書き方）：
//   direct（既定）  名前と割合を、引き出し線で輪の外に直接書く。凡例の表を置かないので場所を取らない
//   compact         割合を輪の上に書き、名前は輪の下に1行で並べる。最も小さい
//   table           右に表（名前・値・割合）。値まで正確に読ませたいとき。単独で置くとき向き
// opt:  { width, height }
// - 12時の位置から時計回りに、大きい順に並べる（charts.md 3章）。「その他」は値に関係なく最後にする。
// - 色は大きい順に青の濃い方から。「その他」は灰色。
// - どの書き方でも、名前と割合を文字で書く（色だけで読ませない）。多くの場合は hbar の方が正確に伝わる。

export default function donut(data, opt = {}) {
  need("donut", data, ["items", "unit"]);
  if (data.items.length < 2 || data.items.length > 5) throw new Error("donut: items は2〜5");
  const others = data.items.filter((d) => d.label === "その他");
  const items = data.items.filter((d) => d.label !== "その他").sort((a, b) => b.value - a.value).concat(others);
  const sum = items.reduce((a, d) => a + d.value, 0);
  const { w, h: h0 } = svgSize(data, opt);
  const h = h0 - 28; // 単位（18）と間（8）の分を引き、枠の高さに収める
  const legend = data.legend ?? "direct";
  // 輪の大きさは書き方ごとに決める。direct は左右に名前を書く幅、table は右の表の幅、compact は下の1行の高さを残す
  const r = Math.max(60, Math.min(200,
    legend === "direct" ? Math.min(h / 2 - 8, (w - 340) / 2 - 8)
    : legend === "table" ? Math.min(h / 2 - 8, (w - 528) / 2 - 8)
    : Math.min((h - 48) / 2 - 8, w / 2 - 8)));
  const cx = r + 8, cy = h / 2;
  const color = (d, k) => (d.label === "その他" ? SERIES[4] : SERIES[Math.min(k, 3)]);
  const arcs = pie().sort(null).value((d) => d.value)(items);
  const shape = arc().innerRadius(r * 0.6).outerRadius(r);
  const slices = arcs
    .map((a, k) => `<path class="${color(a.data, k).fill} stroke-canvas" stroke-width="2" d="${shape(a)}" transform="translate(${cx},${cy})"/>`)
    .join("");
  const big = r >= 140 ? "text-kpi" : "text-heading"; // 輪が小さいときは中央の数字も小さくして穴に収める
  const center = `<text class="fill-ink ${big} font-bold" x="${cx}" y="${cy + 4}" text-anchor="middle" dominant-baseline="middle">${esc(data.total ?? num(sum))}</text>
<text class="fill-label ${r >= 140 ? "text-body" : "text-caption"}" x="${cx}" y="${cy + (r >= 140 ? 44 : 26)}" text-anchor="middle">${esc(data.total_label ?? `合計（${data.unit}）`)}</text>`;
  const pct = (d) => `${Math.round((d.value / sum) * 100)}%`;

  if (legend === "table") {
    const rows = items
      .map((d, k) => `<div class="flex items-center gap-[12px] border-b border-line py-[10px]">
    <span class="inline-block h-[16px] w-[16px] shrink-0 ${color(d, k).bg}"></span>
    <span class="min-w-0 flex-1 text-body text-ink">${esc(d.label)}</span>
    <span class="w-[96px] text-right text-body text-ink">${num(d.value)}</span>
    <span class="w-[72px] text-right text-heading font-bold text-ink">${pct(d)}</span>
  </div>`)
      .join("\n");
    return wrap(`<div class="mt-[8px] flex min-h-0 flex-1 items-center gap-[48px]">
    <svg class="block shrink-0" width="${2 * r + 16}" height="${h}" viewBox="0 0 ${2 * r + 16} ${h}" role="img" aria-label="ドーナツグラフ">${slices}${center}</svg>
    <div class="min-w-0 max-w-[480px] flex-1">${rows}</div>
  </div>`);
  }

  if (legend === "compact") {
    // 割合を輪の上に書く。細すぎる切れ目（8% 未満）には書かず、下の並びで読ませる
    const mid = arc().innerRadius(r * 0.8).outerRadius(r * 0.8);
    const onRing = arcs
      .map((a, k) => (a.data.value / sum < 0.08 ? "" : `<text class="${color(a.data, k).onFill} text-body font-bold" x="${(cx + mid.centroid(a)[0]).toFixed(1)}" y="${(cy + mid.centroid(a)[1]).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${pct(a.data)}</text>`))
      .join("");
    const R2 = Math.min(r, (h - 48) / 2 - 8);
    const names = items
      .map((d, k) => `<span class="inline-flex items-center gap-[6px] text-body text-ink"><span class="inline-block h-[14px] w-[14px] ${color(d, k).bg}"></span>${esc(d.label)}${d.value / sum < 0.08 ? ` ${pct(d)}` : ""}</span>`)
      .join("");
    return wrap(`<div class="mt-[8px] flex min-h-0 flex-1 flex-col items-center">
    <svg class="block min-h-0 flex-1" width="${2 * r + 16}" height="${h - 48}" viewBox="0 0 ${2 * r + 16} ${h}" role="img" aria-label="ドーナツグラフ">${slices}${onRing}${center}</svg>
    <div class="flex flex-wrap justify-center gap-x-[20px] gap-y-[4px] pt-[8px]">${names}</div>
  </div>`);
  }

  // direct：引き出し線で外に書く。左右それぞれで、ラベルが重ならないよう上下に押し広げる
  const out = arc().innerRadius(r + 12).outerRadius(r + 12);
  const edge = arc().innerRadius(r).outerRadius(r);
  const L = arcs.map((a, k) => {
    const [ox, oy] = out.centroid(a);
    return { a, k, side: ox >= 0 ? 1 : -1, y: cy + oy, ex: edge.centroid(a), ox, oy };
  });
  const lab = [1, -1].flatMap((side) => spread(L.filter((l) => l.side === side), 44, 24, h - 26)); // 名前（上）と割合（下）が SVG の内側に収まる範囲
  const cw = 2 * r + 2 * 170; // 輪の左右に名前を書く幅
  const dcx = cw / 2;
  const tags = lab
    .map(({ a, k, side, y: ly, ex }) => {
      const tx = dcx + side * (r + 40);
      const d = a.data;
      return `<path class="fill-none stroke-gray-600" stroke-width="1.5" d="M${(dcx + ex[0]).toFixed(1)},${(cy + ex[1]).toFixed(1)}L${(dcx + side * (r + 28)).toFixed(1)},${ly.toFixed(1)}L${tx.toFixed(1)},${ly.toFixed(1)}"/>
<text class="fill-ink text-body" x="${(tx + side * 6).toFixed(1)}" y="${(ly - 10).toFixed(1)}" text-anchor="${side > 0 ? "start" : "end"}" dominant-baseline="middle">${esc(d.label)}</text>
<text class="fill-ink text-heading font-bold" x="${(tx + side * 6).toFixed(1)}" y="${(ly + 12).toFixed(1)}" text-anchor="${side > 0 ? "start" : "end"}" dominant-baseline="middle">${pct(d)}</text>`;
    })
    .join("");
  const moved = slices.replaceAll(`translate(${cx},${cy})`, `translate(${dcx},${cy})`);
  const c2 = center.replaceAll(`x="${cx}"`, `x="${dcx}"`);
  return wrap(`<div class="mt-[8px] flex min-h-0 flex-1 items-center justify-center">
    <svg class="block max-w-full" width="${cw}" height="${h}" viewBox="0 0 ${cw} ${h}" role="img" aria-label="ドーナツグラフ">${moved}${c2}${tags}</svg>
  </div>`);

  function wrap(inner) {
    return `<div class="flex h-full w-full gap-[32px]" data-kind="donut">
<div class="flex min-w-0 flex-1 flex-col">
  ${unitLabel(data.unit)}
  ${inner}
</div>
${callout(data.callout)}
</div>`;
  }
}
