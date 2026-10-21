import { esc, check, R, O, within } from "./_util.mjs";

// kpi：結論の数字を大きく見せる。1〜4個を横に並べる。
// data: { items: [{ label, value, unit?, compare?, trend?: number[], highlight? }] }
// ラベル・数字・比較の行の高さは、カードどうしでそろえる。1枚の幅が MIN_W より狭くなる枠では縦に積む。
// opt: { width }（置く枠の幅。既定 1172）

const spark = (values) => {
  if (!Array.isArray(values) || values.length < 2) return "";
  const w = 160,
    h = 32,
    min = Math.min(...values),
    max = Math.max(...values);
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

// 横に並べるときの1枚の幅の下限。これより狭くなる枠では、縦に積む（1枚を1行にした横長のカード）
const MIN_W = 160;

// 数の決まり（within で確かめ、schema.mjs が出す）
export const limits = { items: [1, 4] };

export default function kpi(data, opt = {}) {
  check("kpi", data, schema);
  const items = data.items;
  within("kpi", limits, "items", items.length);
  const W = opt.width ?? 1172,
    GAP = 24;
  const stack = items.length > 1 && (W - GAP * (items.length - 1)) / items.length < MIN_W;
  const look = (it) => ({
    box: it.highlight ? "bg-highlight border-primary" : "bg-panel border-gray-400", // 塗りの箱には必ず枠を付ける（地の色だけだと境目がわかりにくい）
    val: it.highlight ? "text-primary" : "text-ink",
  });
  const value = (it, c) => `<div class="flex items-baseline gap-[6px]">
    <span class="text-kpi font-bold ${c.val}">${esc(it.value)}</span>
    ${it.unit ? `<span class="text-heading text-label">${esc(it.unit)}</span>` : ""}
  </div>`;
  if (stack) {
    // 縦に積む：1枚を1行にし、ラベル・数字・比較を左から並べる。数字と比較の列をカードどうしでそろえる（subgrid）
    const cards = items
      .map((it) => {
        const c = look(it);
        return `<div class="col-span-3 grid grid-cols-subgrid items-center gap-x-[24px] rounded-panel border-2 ${c.box} px-[24px] py-[8px]">
  <div class="min-w-0 text-body font-bold text-label">${esc(it.label)}</div>
  ${value(it, c)}
  <div class="text-body text-ink">${it.compare ? esc(it.compare) : ""}</div>
</div>`;
      })
      .join("\n");
    return `<div class="grid w-full grid-cols-[1fr_auto_auto] gap-y-[12px]" data-kind="kpi">\n${cards}\n</div>`;
  }
  // 横に並べる：ラベル・数字・比較・小さな折れ線を、カードどうしで同じ行にそろえる（subgrid）。
  // ラベルの折り返しの数が違っても、数字の高さがずれない
  const cards = items
    .map((it) => {
      const c = look(it);
      return `<div class="row-span-4 grid grid-rows-subgrid gap-0 rounded-panel border-2 ${c.box} p-[24px]">
  <div class="text-body font-bold text-label">${esc(it.label)}</div>
  <div class="mt-[12px]">${value(it, c)}</div>
  <div class="${it.compare ? "mt-[8px] " : ""}text-body text-ink">${it.compare ? esc(it.compare) : ""}</div>
  <div>${spark(it.trend)}</div>
</div>`;
    })
    .join("\n");
  return `<div class="grid w-full auto-cols-fr grid-flow-col gap-x-[24px]" style="grid-template-rows:repeat(4,auto)" data-kind="kpi">\n${cards}\n</div>`;
}
