import { esc, check, R, O, optional, num, callout, unitLabel, SERIES, within } from "./_util.mjs";

// stacked-bar：量と内訳を同時に見せる積み上げ縦棒。系列は5まで、分類は8まで。
// data: { categories: [string], series: [{ name, values: [number] }], unit, percent?, callout? }
// percent: true で各棒を 100% にそろえて構成比を見せる。
// 下から series の順に積む。系列名は右側に、棒と同じ上下の順で並べる（凡例をグラフの隣に置く。charts.md 4章）。
// 面の中には、高さが足りるときだけ数値を書く。棒の上には合計を書く（percent のときは書かない）。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { categories: [R], series: [{ name: R, values: R }], unit: R, percent: O, callout: optional({ value: R, label: R }) };

// 数の決まり（within で確かめ、schema.mjs が出す）
export const limits = { 系列: [2, 5], 分類: [1, 8] };

export default function stackedBar(data) {
  check("stacked-bar", data, schema);
  const { categories: cats, series } = data;
  within("stacked-bar", limits, "系列", series.length);
  within("stacked-bar", limits, "分類", cats.length);
  const totals = cats.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
  const max = data.percent ? 100 : Math.max(...totals) || 1;
  const fit = cats.length * 160 + (cats.length - 1) * 24 + 32;
  const cols = cats
    .map((_, i) => {
      const tot = data.percent ? 100 : totals[i];
      const segs = series
        .map((s, k) => {
          const v = s.values[i];
          const share = data.percent ? (v / totals[i]) * 100 : v;
          const inBar = ((share / tot) * 100).toFixed(2); // 棒の中での割合
          const label = data.percent ? `${Math.round(share)}%` : num(v);
          const show = (share / max) * 360 >= 22; // 面の高さが文字より低いときは書かない
          return `<div class="flex w-full items-center justify-center text-caption font-bold ${SERIES[k].bg} ${SERIES[k].on}" style="height: ${inBar}%">${show ? label : ""}</div>`;
        })
        .reverse()
        .join("");
      const barH = ((tot / max) * 100).toFixed(2);
      const top = data.percent ? "" : `<div class="mb-[6px] text-heading font-bold text-ink">${num(totals[i])}</div>`;
      return `<div class="flex h-full min-w-0 max-w-[160px] flex-1 flex-col items-center justify-end">${top}<div class="flex w-full max-w-[96px] flex-col" style="height: calc((100% - 40px) * ${barH} / 100)">${segs}</div></div>`;
    })
    .join("\n");
  const labels = cats.map((c) => `<div class="min-w-0 max-w-[160px] flex-1 text-center text-body text-ink">${esc(c)}</div>`).join("");
  const legend = series
    .map(
      (s, k) =>
        `<div class="flex items-center gap-[8px] text-body text-ink"><span class="inline-block h-[14px] w-[14px] ${SERIES[k].bg}"></span>${esc(s.name)}</div>`,
    )
    .reverse()
    .join("");
  return `<div class="flex h-full w-full gap-[32px]" data-kind="stacked-bar">
<div class="mx-auto flex w-full min-w-0 flex-1 flex-col" style="max-width: ${fit + 200}px">
  ${unitLabel(data.percent ? "%" : data.unit)}
  <div class="mt-[8px] flex min-h-0 flex-1 gap-[24px]">
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex min-h-0 flex-1 items-end justify-center gap-[24px] border-b-2 border-gray-600 px-[16px]">${cols}</div>
      <div class="flex justify-center gap-[24px] px-[16px] pt-[8px]">${labels}</div>
    </div>
    <div class="flex w-[176px] shrink-0 flex-col justify-center gap-[8px] pb-[40px]">${legend}</div>
  </div>
</div>
${callout(data.callout)}
</div>`;
}
