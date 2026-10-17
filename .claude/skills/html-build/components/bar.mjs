import { esc, num, need, callout, unitLabel } from "./_util.mjs";

// bar：分類ごとの量を比べる縦棒。2〜12本、原点は0。
// data: { data: [{ label, value, highlight? }], unit, callout?: { value, label } }
// 色：highlight の棒だけ primary、ほかは gray-400。どれも highlight でなければ全部 primary。
// gray-400 は白地で 3:1 に届かないため、棒の上に必ず数値を書く（colors.md 3章）。
// 1本分の列は幅 160 まで（棒は 96 まで）。本数が少ないときは間が開きすぎないよう、まとめて中央に寄せる。
// 枠いっぱいに広がるので、置く場所の大きさを親が決めれば、単体でも他の図と並べても使える。callout は任意。

export default function bar(data) {
  need("bar", data, ["data", "unit"]);
  const rows = data.data;
  if (rows.length < 2 || rows.length > 12) throw new Error("bar: data は2〜12本");
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const anyHi = rows.some((r) => r.highlight);
  const cols = rows
    .map((r) => {
      const fill = !anyHi || r.highlight ? "bg-primary" : "bg-gray-400";
      const txt = !anyHi || r.highlight ? "text-primary" : "text-ink";
      const h = ((Math.max(r.value, 0) / max) * 100).toFixed(2);
      return `<div class="flex h-full min-w-0 max-w-[160px] flex-1 flex-col items-center justify-end">
    <div class="mb-[6px] text-heading font-bold ${txt}">${num(r.value)}</div>
    <div class="w-full max-w-[96px] ${fill}" style="height: calc((100% - 40px) * ${h} / 100)"></div>
  </div>`;
    })
    .join("\n");
  const labels = rows
    .map((r) => `<div class="min-w-0 max-w-[160px] flex-1 text-center text-body text-ink">${esc(r.label)}</div>`)
    .join("\n");
  return `<div class="flex h-full w-full gap-[32px]" data-kind="bar">
<div class="flex min-w-0 flex-1 flex-col">
  ${unitLabel(data.unit)}
  <div class="mt-[8px] flex min-h-0 flex-1 items-end justify-center gap-[24px] border-b-2 border-gray-600 px-[16px]">
  ${cols}
  </div>
  <div class="flex justify-center gap-[24px] px-[16px] pt-[8px]">
  ${labels}
  </div>
</div>
${callout(data.callout)}
</div>`;
}
