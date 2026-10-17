import { esc, need } from "./_util.mjs";

// steps：順番に行う手順。3〜5段。番号を付け、左から右へ並べる。
// data: { items: [{ title, text? }], highlight?: 段の番号（1から。今いる段など） }
// - title は全角12字まで、text は3行までを目安にする。
// - highlight の段は淡い青の地に青い枠。highlight がなければすべて同じ見た目。
// - 番号の丸を線でつなぎ、順番があることを示す。

export default function steps(data) {
  need("steps", data, ["items"]);
  const I = data.items;
  if (I.length < 3 || I.length > 5) throw new Error("steps: items は3〜5");
  const cards = I.map((it, i) => {
    const on = data.highlight === i + 1;
    const card = on ? "bg-highlight border-primary" : "bg-panel border-panel";
    const line = i < I.length - 1 ? `<div class="absolute left-[calc(50%+28px)] top-[23px] h-[2px] w-[calc(100%-56px+24px)] bg-gray-400"></div>` : "";
    return `<div class="relative flex min-w-0 flex-1 flex-col items-center">
  ${line}
  <div class="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-primary text-heading font-bold text-on-primary">${i + 1}</div>
  <div class="mt-[16px] w-full flex-1 rounded-panel border-2 p-[20px] ${card}">
    <div class="text-heading font-bold text-ink">${esc(it.title)}</div>
    ${it.text ? `<div class="mt-[8px] text-body text-label">${esc(it.text)}</div>` : ""}
  </div>
</div>`;
  });
  return `<div class="flex h-full w-full items-center" data-kind="steps">
<div class="flex w-full items-stretch gap-[24px]">${cards.join("\n")}</div>
</div>`;
}
