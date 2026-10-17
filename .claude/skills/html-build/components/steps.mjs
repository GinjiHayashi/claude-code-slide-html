import { esc, need, lineOf } from "./_util.mjs";

// steps：順番に行う手順。3〜6段。番号を付け、線でつないで順番を示す。
// data: { items: [{ title, text? }], highlight?: 段の番号（1から。今いる段など）, direction? }
// - direction: "right"（既定。左から右へ並べる。5段まで）／"down"（上から下へ並べる。6段まで。説明が長いとき向き）
// - title は全角12字まで、text は横向きで3行、縦向きで1〜2行までを目安にする。
// - カードは白地に枠（枠の色は _util.mjs の LINES）。highlight の段は淡い青の地に青い枠。

const circle = (i) =>
  `<div class="relative flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-primary text-heading font-bold text-on-primary">${i + 1}</div>`;

export default function steps(data) {
  need("steps", data, ["items"]);
  const I = data.items;
  const down = data.direction === "down";
  if (I.length < 3 || I.length > (down ? 6 : 5)) throw new Error(`steps: items は3〜${down ? 6 : 5}`);
  const LN = lineOf(data);
  const card = (i) => (data.highlight === i + 1 ? "bg-highlight border-primary" : `bg-canvas ${LN.border}`);

  if (down) {
    const rows = I.map((it, i) => {
      const line = i < I.length - 1 ? `<div class="absolute left-[23px] top-[calc(50%+24px)] h-[calc(100%-36px)] w-[2px] ${LN.bg}"></div>` : "";
      return `<div class="relative flex min-h-0 flex-1 items-center gap-[24px]">
  ${line}
  ${circle(i)}
  <div class="flex min-w-0 flex-1 items-baseline gap-[24px] rounded-panel border-2 px-[20px] py-[12px] ${card(i)}">
    <div class="w-[240px] shrink-0 text-heading font-bold text-ink">${esc(it.title)}</div>
    ${it.text ? `<div class="min-w-0 flex-1 text-body text-label">${esc(it.text)}</div>` : ""}
  </div>
</div>`;
    });
    return `<div class="flex h-full w-full flex-col justify-center gap-[12px]" data-kind="steps">${rows.join("\n")}</div>`;
  }

  const cards = I.map((it, i) => {
    const line = i < I.length - 1 ? `<div class="absolute left-[calc(50%+24px)] top-[23px] h-[2px] w-[calc(100%-24px)] ${LN.bg}"></div>` : "";
    return `<div class="relative flex min-w-0 flex-1 flex-col items-center">
  ${line}
  ${circle(i)}
  <div class="mt-[16px] w-full flex-1 rounded-panel border-2 p-[20px] ${card(i)}">
    <div class="text-heading font-bold text-ink">${esc(it.title)}</div>
    ${it.text ? `<div class="mt-[8px] text-body text-label">${esc(it.text)}</div>` : ""}
  </div>
</div>`;
  });
  return `<div class="flex h-full w-full items-center" data-kind="steps">
<div class="flex w-full items-stretch gap-[24px]">${cards.join("\n")}</div>
</div>`;
}
