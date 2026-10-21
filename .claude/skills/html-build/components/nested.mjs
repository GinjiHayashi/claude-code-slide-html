import { esc, inline, check, R, O, LINE, within } from "./_util.mjs";

// nested：入れ子の包含関係。3〜6段を、外から内へ囲みを重ねて描く（AI ⊃ 機械学習 ⊃ 深層学習 など）。
// data: { items: [{ label, text?, tone? }] }（外から順に）
// - 各段の囲みの左上に「label：text」（label は太字）。text は一言の説明
// - いちばん内側は青地に白の字の箱にして目立たせる（tone は書けない）
// - tone：内側以外の囲みの地。plain（白地。既定）／soft（淡い青の地）／muted（灰色の地）
// - 図は枠の上下の中央に置く
// opt: { width, height }

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { items: [{ label: R, text: O, tone: O }] };

const TONE = { plain: "bg-canvas", soft: "bg-highlight", muted: "bg-panel" };

// 数の決まり（within で確かめ、schema.mjs が出す）
export const limits = { items: [3, 6] };

export default function nested(data, opt = {}) {
  check("nested", data, schema);
  const I = data.items;
  within("nested", limits, "items", I.length);
  const tones = Object.keys(TONE);
  for (const [n, it] of I.entries())
    if (it.tone !== undefined && !tones.includes(it.tone)) throw new Error(`nested: items[${n + 1}] の tone は ${tones.join("・")} のどれか`);
  if (I.at(-1).tone !== undefined) throw new Error("nested: いちばん内側の段は tone を書けない（いつも青地で目立たせる）");

  const text = (it) => `<span class="font-bold">${esc(it.label)}</span>${it.text ? `<span class="font-normal">：${inline(it.text)}</span>` : ""}`;
  // 内側から外へ、囲みを1段ずつかぶせる
  let html = `<div class="flex min-h-[64px] items-center justify-center rounded-panel border-2 border-primary bg-primary px-[24px] py-[8px] text-center text-body text-on-primary">${text(I.at(-1))}</div>`;
  for (let k = I.length - 2; k >= 0; k--)
    html = `<div class="rounded-panel border-2 ${LINE.border} ${TONE[I[k].tone ?? "plain"]} px-[32px] pb-[20px] pt-[8px]">
<div class="pb-[8px] text-body text-ink">${text(I[k])}</div>
${html}
</div>`;
  return `<div class="flex h-full w-full flex-col justify-center" style="max-height:${opt.height ?? 440}px" data-kind="nested">
${html}
</div>`;
}
