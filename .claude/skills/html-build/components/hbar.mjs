import { esc, check, R, O, optional, num, callout, unitLabel } from "./_util.mjs";

// hbar：項目名が長い比較や順位を示す横棒。2〜10本。既定で大きい順に並べる（sort: false で書いた順）。
// data: { data: [{ label, value, highlight? }], unit, sort?, callout?: { value, label } }
// 棒の根元に、上から下まで途切れない基準線を引く。項目名の幅は枠の 30%（200 まで）なので、狭い枠にも置ける。callout は任意。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { data: [{ label: R, value: R, highlight: O }], unit: R, sort: O, callout: optional({ value: R, label: R }) };

export default function hbar(data) {
  check("hbar", data, schema);
  let rows = [...data.data];
  if (rows.length < 2 || rows.length > 10) throw new Error("hbar: data は2〜10本");
  if (data.sort !== false) rows.sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const anyHi = rows.some((r) => r.highlight);
  const lines = rows
    .map((r) => {
      const fill = !anyHi || r.highlight ? "bg-primary" : "bg-gray-400";
      const txt = !anyHi || r.highlight ? "font-bold text-primary" : "text-ink";
      const w = ((Math.max(r.value, 0) / max) * 100).toFixed(2);
      return `<div class="flex min-h-0 flex-1 items-stretch gap-[16px]">
    <div class="flex w-[30%] max-w-[200px] shrink-0 items-center justify-end text-right text-body ${txt}">${esc(r.label)}</div>
    <div class="flex min-w-0 flex-1 items-center gap-[8px] border-l-2 border-gray-600 py-[4px]">
      <div class="h-full max-h-[32px] ${fill}" style="width: calc((100% - 80px) * ${w} / 100)"></div>
      <div class="text-body ${txt}">${num(r.value)}</div>
    </div>
  </div>`;
    })
    .join("\n");
  return `<div class="flex h-full w-full gap-[32px]" data-kind="hbar">
<div class="flex min-w-0 flex-1 flex-col">
  ${unitLabel(data.unit)}
  <div class="mt-[8px] flex min-h-0 flex-1 flex-col">
  ${lines}
  </div>
</div>
${callout(data.callout)}
</div>`;
}
