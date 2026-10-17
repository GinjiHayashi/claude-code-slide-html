import { esc, need } from "./_util.mjs";

// table：正確な値を一覧で読ませる。8行×6列まで。
// data: { columns: [string], rows: [[...]], highlight?: [行の番号（1から）], align?: ["left"|"right"|"center"] }
// 数値の列は既定で右寄せし、列の中で小数の桁数を揃える（3 と 2.6 が並ぶなら 3.0 と書く）。見出し行は primary の塗りに白文字。

export default function table(data) {
  need("table", data, ["columns", "rows"]);
  const { columns, rows } = data;
  if (columns.length > 6) throw new Error("table: 列は6まで");
  if (rows.length > 8) throw new Error("table: 行は8まで");
  const hi = new Set(data.highlight ?? []);
  const align = columns.map((_, j) => data.align?.[j] ?? (rows.every((r) => typeof r[j] === "number") ? "right" : "left"));
  const digits = columns.map((_, j) =>
    Math.max(0, ...rows.map((r) => (typeof r[j] === "number" ? (String(r[j]).split(".")[1] ?? "").length : 0))));
  const fmt = (v, j) =>
    typeof v === "number" ? v.toLocaleString("ja-JP", { minimumFractionDigits: digits[j], maximumFractionDigits: digits[j] }) : esc(v);
  const cls = { left: "text-left", right: "text-right", center: "text-center" };
  const head = columns
    .map((c, j) => `<th class="bg-primary px-[16px] py-[10px] font-bold text-on-primary ${cls[align[j]]}">${esc(c)}</th>`)
    .join("");
  const body = rows
    .map((r, i) => {
      const row = hi.has(i + 1) ? "bg-highlight font-bold" : "bg-panel";
      const tds = r
        .map((v, j) => `<td class="border-b border-line px-[16px] py-[10px] ${cls[align[j]]}">${fmt(v, j)}</td>`)
        .join("");
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
