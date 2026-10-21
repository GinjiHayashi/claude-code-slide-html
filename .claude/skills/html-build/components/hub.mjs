import { esc, inline, check, R, O, optional, LINE } from "./_util.mjs";

// hub：1つの共通の口（横長の帯）に、複数のものがつながる。上に1つの箱、真ん中に帯、下に2〜6個の箱。
// data: { top: { label }, hub: { label, text? }, items: [{ label, text? }] }
// - top：上の箱（青地に白の字）。帯とは上下両向きの線でつなぐ
// - hub：真ん中の帯（淡い青の地、角の丸い横長）。text は帯の名前のあとに（…）で添える説明
// - items：下の箱（白地に枠）。帯からそれぞれへ線を引く。text は箱の下の短い説明（2行まで）
// - 図は枠の上下の中央に置く
// opt: { width, height }

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { top: { label: R }, hub: { label: R, text: O }, items: [{ label: R, text: O }] };

const BH = 72, // 箱と帯の高さ
  GAP_V = 48, // 段と段のあいだ（線の長さ）
  GAP_H = 24, // 下の箱どうしのあいだ
  CAP = 56, // 下の箱の説明（2行）
  f1 = (v) => v.toFixed(1);

export default function hub(data, opt = {}) {
  check("hub", data, schema);
  const I = data.items;
  if (I.length < 2 || I.length > 6) throw new Error("hub: items は2〜6");
  const W = opt.width ?? 1172,
    H = opt.height ?? 440;
  const capH = I.some((it) => it.text) ? CAP + 8 : 0;
  const total = 3 * BH + 2 * GAP_V + capH;
  const oy = Math.max(0, (H - total) / 2);
  const y1 = oy, // 上の箱
    y2 = y1 + BH + GAP_V, // 帯
    y3 = y2 + BH + GAP_V; // 下の箱
  const bw = (W - GAP_H * (I.length - 1)) / I.length;
  const tw = Math.min(320, W * 0.4);
  const xs = I.map((_, k) => k * (bw + GAP_H) + bw / 2);

  // 線：上の箱と帯は両向きの矢印、帯と下の箱はただの線
  const tri = (x, y, up) =>
    `<polygon class="${LINE.fill}" points="${f1(x)},${f1(y)} ${f1(x - 7)},${f1(y + (up ? 12 : -12))} ${f1(x + 7)},${f1(y + (up ? 12 : -12))}"/>`;
  const svg = [
    `<path class="fill-none ${LINE.stroke}" stroke-width="2.5" d="M${f1(W / 2)},${f1(y1 + BH + 14)}V${f1(y2 - 14)}"/>`,
    tri(W / 2, y1 + BH + 4, true),
    tri(W / 2, y2 - 4, false),
    ...xs.map((x) => `<path class="fill-none ${LINE.stroke}" stroke-width="2.5" d="M${f1(x)},${f1(y2 + BH)}V${f1(y3)}"/>`),
  ];
  const box = (x, y, w, look, html) =>
    `<div class="absolute flex items-center justify-center px-[12px] text-center text-body font-bold ${look}" style="left:${f1(x)}px;top:${f1(y)}px;width:${f1(w)}px;height:${BH}px">${html}</div>`;
  const html = [
    box(W / 2 - tw / 2, y1, tw, "rounded-panel border-2 border-primary bg-primary text-on-primary", esc(data.top.label)),
    box(
      0,
      y2,
      W,
      `rounded-full border-2 ${LINE.border} bg-highlight text-ink`,
      `<span>${esc(data.hub.label)}${data.hub.text ? `<span class="font-normal">（${inline(data.hub.text)}）</span>` : ""}</span>`,
    ),
    ...I.map((it, k) => box(xs[k] - bw / 2, y3, bw, `rounded-panel border-2 ${LINE.border} bg-canvas text-ink`, esc(it.label))),
    ...I.map((it, k) =>
      it.text
        ? `<div class="absolute text-center text-body text-label" style="left:${f1(xs[k] - bw / 2)}px;top:${f1(y3 + BH + 8)}px;width:${f1(bw)}px">${inline(it.text)}</div>`
        : "",
    ),
  ];
  return `<div class="relative mx-auto" style="width:${W}px;height:${H}px" data-kind="hub">
<svg data-origin="generated" class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${svg.join("")}</svg>
${html.filter(Boolean).join("\n")}
</div>`;
}
