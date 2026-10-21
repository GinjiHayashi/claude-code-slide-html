import { esc, inline, check, R, O, optional, LINE, within } from "./_util.mjs";
import { loadAsset, inlineSvg } from "./_asset.mjs";

// cards：同じ重さの項目を、2〜6枚のカードにして2〜3列で並べる。
// data: { items: [{ heading, text?, icon?, tone? }], columns?, numbered?, summary? }
// - カードは、見出しの帯と説明を1枚の実線の枠（_util.mjs の LINE）に入れる。見出しの帯と説明の高さは、同じ段のカードどうしでそろえる。
// - tone：見出しの帯の色で、重さの違いを示す。plain（白地に黒の字。既定）／primary（青地に白の字）／soft（淡い青の地）／muted（灰色の地）
// - icon：見出しの左の小さなアイコン（24px。phosphor:<名前> か assets の SVG）。numbered: true なら、見出しの左に番号の小さい丸（icon が優先）
// - columns：列の数（2 か 3）。書かなければ、2枚と4枚は2列、ほかは3列
// - summary：カードの下に置く「まとめの帯」。{ text, tone? }。高さは見出しの帯と同じ（1行のとき）。tone は既定 soft
// - 説明は全角60字（3行）までを目安にする。説明の `…` は文中のコード、**…** は太字
// layout の grid-4 も、この部品で描く（4枚・2列・番号の丸）。
// opt: { width, height, deck }

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = {
  items: [{ heading: R, text: O, icon: O, tone: O }],
  columns: O,
  numbered: O,
  summary: optional({ text: R, tone: O }),
};

// band：見出しの帯の地と字（白・淡い地は、説明との境に線を引く）。fill：まとめの帯の地と字。num：番号の丸
const TONE = {
  plain: { band: `bg-canvas text-ink border-b-2 ${LINE.border}`, fill: "bg-canvas text-ink", num: "bg-primary text-on-primary" },
  primary: { band: "bg-primary text-on-primary", fill: "bg-primary text-on-primary", num: "bg-canvas text-primary" },
  soft: { band: `bg-highlight text-ink border-b-2 ${LINE.border}`, fill: "bg-highlight text-ink", num: "bg-primary text-on-primary" },
  muted: { band: `bg-panel text-label border-b-2 ${LINE.border}`, fill: "bg-panel text-label", num: "bg-gray-400 text-on-primary" },
};
const BAND = "flex items-center justify-center gap-[8px] px-[16px] py-[12px] text-center text-heading font-bold";

// 数の決まり（within で確かめ、schema.mjs が出す）
export const limits = { items: [2, 6] };

export default function cards(data, opt = {}) {
  check("cards", data, schema);
  const I = data.items;
  within("cards", limits, "items", I.length);
  const tones = Object.keys(TONE);
  for (const [n, it] of I.entries())
    if (it.tone !== undefined && !tones.includes(it.tone)) throw new Error(`cards: items[${n + 1}] の tone は ${tones.join("・")} のどれか`);
  if (data.summary?.tone !== undefined && !tones.includes(data.summary.tone)) throw new Error(`cards: summary の tone は ${tones.join("・")} のどれか`);
  const cols = data.columns ?? (I.length === 2 || I.length === 4 ? 2 : 3);
  if (![2, 3].includes(cols)) throw new Error("cards: columns は 2 か 3");
  const rows = Math.ceil(I.length / cols);

  // 段ごとに「見出しの帯・説明・すき間」の3つの行を作り、カードは見出しの帯と説明の2行にまたがる（subgrid で高さをそろえる）
  const tracks = [];
  for (let r = 0; r < rows; r++) tracks.push("auto", "auto", r < rows - 1 || data.summary ? "24px" : "");
  const cardsHtml = I.map((it, i) => {
    const t = TONE[it.tone ?? "plain"];
    const mark = it.icon
      ? `<span class="flex shrink-0">${inlineSvg(loadAsset("cards", it.icon, opt.deck), it.icon, 24)}</span>`
      : data.numbered
        ? `<span class="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-caption font-bold ${t.num}">${i + 1}</span>`
        : "";
    const row = Math.floor(i / cols) * 3 + 1,
      col = (i % cols) + 1;
    return `<div class="grid grid-rows-subgrid overflow-hidden rounded-panel border-2 ${LINE.border} bg-canvas" style="grid-row:${row} / span 2;grid-column:${col}">
  <div class="${BAND} ${t.band}">${mark}<span>${esc(it.heading)}</span></div>
  <div class="px-[20px] py-[16px] text-body text-ink">${it.text ? inline(it.text) : ""}</div>
</div>`;
  }).join("\n");
  const summary = data.summary
    ? `<div class="${BAND} rounded-panel border-2 ${LINE.border} ${TONE[data.summary.tone ?? "soft"].fill}" style="grid-row:${rows * 3 + 1};grid-column:1 / -1">${inline(data.summary.text)}</div>`
    : "";
  return `<div class="grid w-full gap-x-[24px]" style="grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:${tracks.filter(Boolean).join(" ")}${data.summary ? " auto" : ""}" data-kind="cards">
${cardsHtml}
${summary}
</div>`;
}
