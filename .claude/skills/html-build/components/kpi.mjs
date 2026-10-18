import { esc, check, R, O } from "./_util.mjs";

// kpi：結論の数字を大きく見せる。1〜4個を横に並べる。
// data: { items: [{ label, value, unit?, compare?, trend?: number[], highlight? }] }

const spark = (values) => {
  if (!Array.isArray(values) || values.length < 2) return "";
  const w = 160, h = 32, min = Math.min(...values), max = Math.max(...values);
  const y = (v) => (max === min ? h / 2 : h - ((v - min) / (max - min)) * (h - 4) - 2);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${y(v).toFixed(1)}`);
  const last = pts.at(-1).split(",");
  return `<svg data-origin="generated" class="mt-[12px] block" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
  <polyline class="fill-none stroke-blue-600" stroke-width="2" points="${pts.join(" ")}"/>
  <circle class="fill-blue-600" cx="${last[0]}" cy="${last[1]}" r="3"/>
</svg>`;
};

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { items: [{ label: R, value: R, unit: O, compare: O, trend: O, highlight: O }] };

export default function kpi(data) {
  check("kpi", data, schema);
  const items = data.items;
  if (items.length < 1 || items.length > 4) throw new Error("kpi: items は1〜4個");
  const cards = items
    .map((it) => {
      const box = it.highlight ? "bg-highlight border-primary" : "bg-panel border-gray-400"; // 塗りの箱には必ず枠を付ける（地の色だけだと境目がわかりにくい）
      const val = it.highlight ? "text-primary" : "text-ink";
      return `<div class="flex flex-1 flex-col rounded-panel border-2 ${box} p-[24px]">
  <div class="text-body font-bold text-label">${esc(it.label)}</div>
  <div class="mt-[12px] flex items-baseline gap-[6px]">
    <span class="text-kpi font-bold ${val}">${esc(it.value)}</span>
    ${it.unit ? `<span class="text-heading text-label">${esc(it.unit)}</span>` : ""}
  </div>
  ${it.compare ? `<div class="mt-[8px] text-body text-ink">${esc(it.compare)}</div>` : ""}
  ${spark(it.trend)}
</div>`;
    })
    .join("\n");
  return `<div class="flex w-full gap-[24px]" data-kind="kpi">\n${cards}\n</div>`;
}
