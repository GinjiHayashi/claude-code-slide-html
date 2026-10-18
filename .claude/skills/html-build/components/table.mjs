import { esc, check, R, O } from "./_util.mjs";

// table：正確な値を一覧で読ませる。8行×6列まで。
// data: { columns: [string], rows: [[...]], highlight?: [行の番号（1から）], align?: ["left"|"right"|"center"], style? }
// highlight は任意（書かなければ強調しない）。
// style（見た目の種類）：既定は zebra（見出しの青がタイトルの青とそろい、統一感があるため）
//   panel  本文の行は薄いグレーの地＋横線（見本のガイドブックと同じ）
//   lines  白地＋横線だけ
//   zebra  白と薄いグレーを1行おきに。線なし
//   light  見出しを淡い青の地に青い文字、白地＋横線。最も軽い
//   light-zebra  light の見出し＋白と薄いグレーを1行おきに。線なし
// 数値の列は既定で右寄せし、列の中で小数の桁数を揃える（3 と 2.6 が並ぶなら 3.0 と書く）。見出し行は primary の塗りに白文字。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { columns: [R], rows: [O], highlight: O, align: O, style: O };

export default function table(data) {
  check("table", data, schema);
  const { columns, rows } = data;
  if (columns.length > 6) throw new Error("table: 列は6まで");
  if (rows.length > 8) throw new Error("table: 行は8まで");
  const hi = new Set(data.highlight ?? []);
  const style = data.style ?? "zebra";
  const ST = {
    panel: { th: "bg-primary text-on-primary", row: () => "bg-panel", td: "border-b border-line" },
    lines: { th: "bg-primary text-on-primary", row: () => "bg-canvas", td: "border-b border-line" },
    zebra: { th: "bg-primary text-on-primary", row: (i) => (i % 2 ? "bg-panel" : "bg-canvas"), td: "" },
    light: { th: "bg-highlight text-primary border-b-2 border-primary", row: () => "bg-canvas", td: "border-b border-line" },
    "light-zebra": { th: "bg-highlight text-primary border-b-2 border-primary", row: (i) => (i % 2 ? "bg-panel" : "bg-canvas"), td: "" },
  }[style];
  if (!ST) throw new Error(`table: style は panel・lines・zebra・light・light-zebra のどれか`);
  const align = columns.map((_, j) => data.align?.[j] ?? (rows.every((r) => typeof r[j] === "number") ? "right" : "left"));
  const digits = columns.map((_, j) => Math.max(0, ...rows.map((r) => (typeof r[j] === "number" ? (String(r[j]).split(".")[1] ?? "").length : 0))));
  const fmt = (v, j) => (typeof v === "number" ? v.toLocaleString("ja-JP", { minimumFractionDigits: digits[j], maximumFractionDigits: digits[j] }) : esc(v));
  const cls = { left: "text-left", right: "text-right", center: "text-center" };
  const head = columns.map((c, j) => `<th class="${ST.th} px-[16px] py-[10px] font-bold ${cls[align[j]]}">${esc(c)}</th>`).join("");
  const body = rows
    .map((r, i) => {
      const row = hi.has(i + 1) ? "bg-highlight font-bold" : ST.row(i);
      const tds = r.map((v, j) => `<td class="${ST.td} px-[16px] py-[10px] ${cls[align[j]]}">${fmt(v, j)}</td>`).join("");
      return `<tr class="${row}">${tds}</tr>`;
    })
    .join("\n");
  return `<table class="w-full border-collapse text-body text-ink" data-kind="table">
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>`;
}
