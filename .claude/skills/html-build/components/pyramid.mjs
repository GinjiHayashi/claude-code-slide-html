import { esc, check, R, O, LINE } from "./_util.mjs";

// pyramid：土台から上へ積み上がる関係。3〜5段。levels は上（頂点）から順に書く。
// data: { levels: [{ label, text? }], highlight?: 段の番号（1から。上から数える） }
// opt:  { width, height }
// - 左にピラミッド（台形を積む）、右に各段の説明を、段と同じ高さで書く。
// - 段は白地に枠。highlight の段は primary の塗りに白文字。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { levels: [{ label: R, text: O }], highlight: O };

export default function pyramid(data, opt = {}) {
  check("pyramid", data, schema);
  const Lv = data.levels;
  if (Lv.length < 3 || Lv.length > 5) throw new Error("pyramid: levels は3〜5");
  const LN = LINE;
  const H = opt.height ?? 440,
    PW = Math.min(560, (opt.width ?? 1172) * 0.5);
  const gap = 8,
    lh = (H - gap * (Lv.length - 1)) / Lv.length;
  const shapes = Lv.map((lv, i) => {
    const y0 = i * (lh + gap),
      y1 = y0 + lh;
    const w = (y) => (PW * y) / H; // 頂点からの距離に比例した幅
    const x = (y, side) => PW / 2 + (side * w(y)) / 2;
    const on = data.highlight === i + 1;
    const pts = [
      [x(y0, -1), y0],
      [x(y0, 1), y0],
      [x(y1, 1), y1],
      [x(y1, -1), y1],
    ]
      .map((p) => p.map((v) => v.toFixed(1)).join(","))
      .join(" ");
    return `<polygon class="${on ? "fill-primary stroke-primary" : `fill-canvas ${LN.stroke}`}" stroke-width="2" stroke-linejoin="round" points="${pts}"/>
<text class="${on ? "fill-on-primary" : "fill-ink"} text-heading font-bold" x="${PW / 2}" y="${(y0 + lh / 2 + (i === 0 ? lh * 0.25 : 0)).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(lv.label)}</text>`;
  });
  const texts = Lv.map(
    (lv, i) =>
      `<div class="flex items-center border-b border-line text-body ${data.highlight === i + 1 ? "font-bold text-primary" : "text-ink"}" style="height:${lh}px; margin-top:${i ? gap : 0}px">${esc(lv.text ?? "")}</div>`,
  );
  return `<div class="flex h-full w-full items-center gap-[48px]" data-kind="pyramid">
<svg data-origin="generated" class="block shrink-0 overflow-visible" width="${PW}" height="${H}" viewBox="0 0 ${PW} ${H}" role="img" aria-label="ピラミッド">${shapes.join("")}</svg>
<div class="min-w-0 flex-1">${texts.join("")}</div>
</div>`;
}
