import { esc, check, R, O, LINE } from "./_util.mjs";

// timeline：出来事を時間順に、横一本の線の上に並べる。3〜6個。
// data: { items: [{ date, label, text? }], highlight?: 番号（1から） }
// - 日付は線の上、出来事の名前と説明は線の下に書く。間隔は等しくする（日付の間の長さには合わせない）。
// - 印は白地の丸に枠。highlight の出来事は primary で塗り、名前も primary にする。
// - 線と枠の色は _util.mjs の LINE（Light Blue 1200）。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { items: [{ date: R, label: R, text: O }], highlight: O };

export default function timeline(data) {
  check("timeline", data, schema);
  const I = data.items;
  if (I.length < 3 || I.length > 6) throw new Error("timeline: items は3〜6");
  const LN = LINE;
  const cols = I.map((it, i) => {
    const on = data.highlight === i + 1;
    const dot = on ? "h-[24px] w-[24px] bg-primary border-primary" : `h-[18px] w-[18px] bg-canvas ${LN.border}`;
    return `<div class="flex min-w-0 flex-1 flex-col items-center px-[8px] text-center">
  <div class="flex h-[48px] items-end pb-[16px] text-heading font-bold ${on ? "text-primary" : "text-ink"}">${esc(it.date)}</div>
  <div class="flex h-[24px] items-center"><div class="rounded-full border-[3px] ${dot}"></div></div>
  <div class="mt-[16px] text-heading font-bold ${on ? "text-primary" : "text-ink"}">${esc(it.label)}</div>
  ${it.text ? `<div class="mt-[8px] text-body text-label">${esc(it.text)}</div>` : ""}
</div>`;
  });
  return `<div class="flex h-full w-full items-center" data-kind="timeline">
<div class="relative w-full">
  <div class="absolute top-[58px] h-[3px] ${LN.bg}" style="left: calc(100% / ${2 * I.length}); right: calc(100% / ${2 * I.length})"></div>
  <div class="relative flex w-full">${cols.join("\n")}</div>
</div>
</div>`;
}
