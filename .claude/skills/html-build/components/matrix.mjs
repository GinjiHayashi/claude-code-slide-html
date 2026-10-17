import { esc, need, lineOf } from "./_util.mjs";

// matrix：2つの軸で4つに分ける（2×2）。
// data: {
//   x_axis: { label, low, high }, y_axis: { label, low, high },
//   cells: [左上, 右上, 左下, 右下]（各 { title, text?, items? }）,
//   highlight?: 1〜4, line?
// }
// - 軸：両端に low・high を書き、その間を両矢印でつなぐ。軸の名前は矢印に重ねず、横軸は矢印の下、縦軸は矢印の左の中央に置く（ユーザーが決定）。縦軸は上が high、横軸は右が high。
// - マス：見出しの下の本文（text：普通の文、items：箇条書き3つまで）は、見出しより字下げする。text と items は両方書ける。
// - マスは白地に枠。highlight のマスは淡い青の地に青い枠。

const head = (dir, cls) =>
  ({
    left: `<svg class="absolute left-0 top-1/2 -translate-y-1/2" width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path class="${cls}" d="M0 7L12 0V14Z"/></svg>`,
    right: `<svg class="absolute right-0 top-1/2 -translate-y-1/2" width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path class="${cls}" d="M12 7L0 0V14Z"/></svg>`,
    up: `<svg class="absolute top-0 left-1/2 -translate-x-1/2" width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><path class="${cls}" d="M7 0L14 12H0Z"/></svg>`,
    down: `<svg class="absolute bottom-0 left-1/2 -translate-x-1/2" width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><path class="${cls}" d="M7 12L14 0H0Z"/></svg>`,
  })[dir];

export default function matrix(data) {
  need("matrix", data, ["x_axis", "y_axis", "cells"]);
  if (data.cells.length !== 4) throw new Error("matrix: cells は4つ（左上・右上・左下・右下）");
  const LN = lineOf(data);
  const { x_axis: X, y_axis: Y } = data;
  const cells = data.cells.map((c, i) => {
    if ((c.items ?? []).length > 3) throw new Error("matrix: 各マスの項目は3つまで");
    const on = data.highlight === i + 1;
    const look = on ? "bg-highlight border-primary" : `bg-canvas ${LN.border}`;
    const text = c.text ? `<p class="m-0 mt-[8px] pl-[16px] text-body text-ink">${esc(c.text)}</p>` : "";
    const items = (c.items ?? []).map((t) => `<li class="text-body text-ink">${esc(t)}</li>`).join("");
    return `<div class="flex min-h-0 flex-col rounded-panel border-2 p-[20px] ${look}">
  <div class="text-heading font-bold ${on ? "text-primary" : "text-ink"}">${esc(c.title)}</div>
  ${text}
  ${items ? `<ul class="m-0 mt-[8px] list-disc pl-[36px]">${items}</ul>` : ""}
</div>`;
  });
  // 横軸：low ←———→ high の両矢印。軸の名前は矢印に重ねず、その下の中央に置く
  const xAxis = `<div class="flex flex-col gap-[4px]">
    <div class="flex items-center gap-[12px] text-body text-label">
      <span class="shrink-0">${esc(X.low)}</span>
      <div class="relative h-[14px] min-w-0 flex-1">
        <div class="absolute left-[2px] right-[2px] top-1/2 h-[2px] -translate-y-1/2 ${LN.bg}"></div>
        ${head("left", LN.fill)}${head("right", LN.fill)}
      </div>
      <span class="shrink-0">${esc(X.high)}</span>
    </div>
    <div class="text-center text-heading font-bold text-ink">${esc(X.label)}</div>
  </div>`;
  // 縦軸：上に high、下に low の両矢印。軸の名前は矢印に重ねず、その左の中央に縦書きで置く
  const yAxis = `<div class="flex h-full items-stretch gap-[4px]">
    <div class="flex flex-col justify-center"><span class="text-heading font-bold text-ink [writing-mode:vertical-rl]">${esc(Y.label)}</span></div>
    <div class="flex flex-col items-center gap-[8px] text-body text-label">
      <span class="shrink-0 [writing-mode:vertical-rl]">${esc(Y.high)}</span>
      <div class="relative w-[14px] min-h-0 flex-1">
        <div class="absolute bottom-[2px] left-1/2 top-[2px] w-[2px] -translate-x-1/2 ${LN.bg}"></div>
        ${head("up", LN.fill)}${head("down", LN.fill)}
      </div>
      <span class="shrink-0 [writing-mode:vertical-rl]">${esc(Y.low)}</span>
    </div>
  </div>`;
  return `<div class="grid h-full w-full gap-[12px]" style="grid-template-columns: 56px 1fr; grid-template-rows: 1fr 64px" data-kind="matrix">
  ${yAxis}
  <div class="grid min-h-0 grid-cols-2 grid-rows-2 gap-[16px]">${cells.join("\n")}</div>
  <div></div>
  ${xAxis}
</div>`;
}
