import { esc, need, lineOf } from "./_util.mjs";

// sequence：やりとりの順番（シーケンス図。試作）。登場するものは5まで、やりとりは10まで。
// data: {
//   actors: [名前],
//   messages: [{ from, to, label, reply?: true（応答。点線） }],
//   highlight?: やりとりの番号（1から）, line?
// }
// opt: { width, height }（既定は 1172×440）
// - 上に登場するものの箱、下へ点線の生存線を引き、やりとりは上から順に横向きの矢印で書く。
// - 応答（reply）は点線の矢印。highlight のやりとりは primary の色と太字。

export default function sequence(data, opt = {}) {
  need("sequence", data, ["actors", "messages"]);
  const A = data.actors, M = data.messages;
  if (A.length < 2 || A.length > 5) throw new Error("sequence: actors は2〜5");
  if (M.length < 1 || M.length > 10) throw new Error("sequence: messages は1〜10");
  const LN = lineOf(data);
  const W = opt.width ?? 1172, H = opt.height ?? 440;
  const cw = W / A.length, bw = Math.min(200, cw - 32), bh = 48;
  const x = (name) => {
    const i = A.indexOf(name);
    if (i < 0) throw new Error(`sequence: ${name} が actors にない`);
    return i * cw + cw / 2;
  };
  const top = bh + 24, step = Math.min(56, (H - top - 12) / M.length);
  const boxes = A.map((a, i) => `<div class="absolute flex items-center justify-center rounded-panel border-2 bg-canvas px-[8px] text-center text-body font-bold text-ink ${LN.border}" style="left:${i * cw + (cw - bw) / 2}px;top:0;width:${bw}px;height:${bh}px">${esc(a)}</div>`).join("");
  const life = A.map((a) => `<line class="stroke-gray-400" stroke-width="2" stroke-dasharray="4 4" x1="${x(a)}" y1="${bh}" x2="${x(a)}" y2="${H}"/>`).join("");
  const msgs = M.map((m, i) => {
    const x1 = x(m.from), x2 = x(m.to);
    if (x1 === x2) throw new Error("sequence: 自分自身へのやりとりは書けない");
    const y = top + (i + 0.5) * step, dir = Math.sign(x2 - x1), s = 12;
    const on = data.highlight === i + 1;
    const stroke = on ? "stroke-primary" : LN.stroke, fill = on ? "fill-primary" : LN.fill;
    const ex = x2 - dir * 2;
    return `<line class="${stroke}" stroke-width="${on ? 3 : 2}" ${m.reply ? 'stroke-dasharray="8 5"' : ""} x1="${x1}" y1="${y}" x2="${ex - dir * s}" y2="${y}"/>
<polygon class="${fill}" points="${ex},${y} ${ex - dir * s},${y - 6} ${ex - dir * s},${y + 6}"/>
<text class="${on ? "fill-primary font-bold" : "fill-ink"} stroke-canvas text-caption" stroke-width="6" paint-order="stroke" x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle">${i + 1}. ${esc(m.label)}</text>`;
  }).join("");
  return `<div class="relative mx-auto" style="width:${W}px;height:${H}px" data-kind="sequence">
<svg class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${life}${msgs}</svg>
${boxes}
</div>`;
}
