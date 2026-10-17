import { esc, need, lineOf } from "./_util.mjs";

// matrix：2つの軸で4つに分ける（2×2）。
// data: { x_axis: { label, low, high }, y_axis: { label, low, high }, cells: [左上, 右上, 左下, 右下]（各 { title, items? }）, highlight?: 1〜4, line? }
// - 縦軸は上が high、横軸は右が high。軸の名前と両端の言葉を、軸に沿って書く。
// - マスは白地に枠。highlight のマスは淡い青の地に青い枠。各マスの項目は3つまで。

export default function matrix(data) {
  need("matrix", data, ["x_axis", "y_axis", "cells"]);
  if (data.cells.length !== 4) throw new Error("matrix: cells は4つ（左上・右上・左下・右下）");
  const LN = lineOf(data);
  const { x_axis: X, y_axis: Y } = data;
  const cells = data.cells.map((c, i) => {
    if ((c.items ?? []).length > 3) throw new Error("matrix: 各マスの項目は3つまで");
    const on = data.highlight === i + 1;
    const look = on ? "bg-highlight border-primary" : `bg-canvas ${LN.border}`;
    const items = (c.items ?? []).map((t) => `<li class="text-body text-ink">${esc(t)}</li>`).join("");
    return `<div class="flex min-h-0 flex-col rounded-panel border-2 p-[20px] ${look}">
  <div class="text-heading font-bold ${on ? "text-primary" : "text-ink"}">${esc(c.title)}</div>
  ${items ? `<ul class="mt-[8px] list-disc pl-[20px]">${items}</ul>` : ""}
</div>`;
  });
  return `<div class="grid h-full w-full gap-[8px]" style="grid-template-columns: 40px 1fr; grid-template-rows: 1fr 40px" data-kind="matrix">
  <div class="flex flex-col items-center justify-between py-[8px] text-caption text-label">
    <span>${esc(Y.high)}</span>
    <span class="flex flex-col items-center text-body font-bold text-ink"><span>↑</span><span class="[writing-mode:vertical-rl]">${esc(Y.label)}</span></span>
    <span>${esc(Y.low)}</span>
  </div>
  <div class="grid min-h-0 grid-cols-2 grid-rows-2 gap-[16px]">${cells.join("\n")}</div>
  <div></div>
  <div class="flex items-center justify-between px-[8px] text-caption text-label">
    <span>${esc(X.low)}</span>
    <span class="text-body font-bold text-ink">${esc(X.label)} →</span>
    <span>${esc(X.high)}</span>
  </div>
</div>`;
}
