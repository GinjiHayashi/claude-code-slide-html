import { esc, inline, check, R, O, LINE } from "./_util.mjs";

// layers：横長の帯を上から下へ重ねた層。3〜6層。左に上下両向きの矢印を引き、上端と下端にラベルを置く。
// data: { items: [{ label, text?, tone? }], top?, bottom?, note? }
// - 帯の文は「label：text」（label は太字）。text の `…` は文中のコード、**…** は太字
// - tone：帯の塗り。plain（白地。既定）／primary（青地に白の字）／soft（淡い青の地）／muted（灰色の地）
// - top・bottom：左の矢印の上端と下端のラベル（例：読まなくても守られる／読んで従う）。どちらもなければ矢印を引かない
// - note：図の下の注記（例：層の並びは資料にない整理のときに「層の並びは AI が整理したもの」）
// - 帯の高さは 64px（2行の文なら伸びる）。図は枠の上下の中央に置く
// opt: { width, height }

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { items: [{ label: R, text: O, tone: O }], top: O, bottom: O, note: O };

const TONE = {
  plain: `bg-canvas text-ink ${LINE.border}`,
  primary: "bg-primary text-on-primary border-primary",
  soft: `bg-highlight text-ink ${LINE.border}`,
  muted: `bg-panel text-label border-gray-400`,
};
const LABEL_W = 200; // 左のラベルの列の幅

export default function layers(data, opt = {}) {
  check("layers", data, schema);
  const I = data.items;
  if (I.length < 3 || I.length > 6) throw new Error("layers: items は3〜6");
  const tones = Object.keys(TONE);
  for (const [n, it] of I.entries())
    if (it.tone !== undefined && !tones.includes(it.tone)) throw new Error(`layers: items[${n + 1}] の tone は ${tones.join("・")} のどれか`);
  const side = data.top || data.bottom;

  const bands = I.map(
    (it) =>
      `<div class="flex min-h-[64px] items-center rounded-panel border-2 px-[24px] py-[8px] text-body ${TONE[it.tone ?? "plain"]}"><span><span class="font-bold">${esc(it.label)}</span>${it.text ? `：${inline(it.text)}` : ""}</span></div>`,
  ).join("\n");
  // 左の列：上端のラベル、上下両向きの矢印（残りの高さいっぱい）、下端のラベル
  const head = (up) =>
    `<svg data-origin="generated" class="shrink-0" width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><polygon class="${LINE.fill}" points="${up ? "8,0 0,12 16,12" : "0,0 16,0 8,12"}"/></svg>`;
  const arrow = side
    ? `<div class="flex shrink-0 flex-col items-end gap-[8px]" style="width:${LABEL_W}px">
  <div class="text-right text-body font-bold text-ink">${esc(data.top ?? "")}</div>
  <div class="flex flex-1 flex-col items-center self-end pr-[8px]">${head(true)}<div class="w-[3px] flex-1 ${LINE.bg}"></div>${head(false)}</div>
  <div class="text-right text-body font-bold text-ink">${esc(data.bottom ?? "")}</div>
</div>`
    : "";
  const note = data.note ? `<div class="text-caption text-label">※ ${esc(data.note)}</div>` : "";
  return `<div class="flex h-full w-full flex-col justify-center gap-[12px]" style="max-height:${opt.height ?? 440}px" data-kind="layers">
<div class="flex items-stretch gap-[16px]">
${arrow}
<div class="flex min-w-0 flex-1 flex-col gap-[12px]">
${bands}
</div>
</div>
${note}
</div>`;
}
