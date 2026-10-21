import { esc, check, R, O, within } from "./_util.mjs";

// compare：選択肢を観点ごとに比べる。選択肢は2〜3、観点は6まで。
// data: {
//   options: [選択肢の名前], criteria: [観点の名前],
//   values: [[観点1での各選択肢の値], ...]（値は「◯」「△」「×」、短い文、または { mark, note }）,
//   recommend?: 推奨する選択肢の名前
// }
// - 推奨の列は淡い青で塗り、見出しの上に「推奨」と書く（色だけに頼らない）。
// - 記号は小見出しの大きさで書き、意味は形で区別する。文を添えるときは記号の下に書き、記号の位置を列の中央に揃える。
//  ◯ は primary、△ は ink、× は label の色。

const MARK = {
  "◯": "text-primary",
  "○": "text-primary",
  "◎": "text-primary",
  "△": "text-ink",
  "×": "text-label",
  "✕": "text-label",
};

const cell = (v) => {
  const o = typeof v === "object" && v !== null ? v : MARK[v] ? { mark: v } : { note: v };
  const mark = o.mark ? `<span class="text-heading font-bold ${MARK[o.mark] ?? "text-ink"}">${esc(o.mark)}</span>` : "";
  const note = o.note ? `<span class="text-body text-ink">${esc(o.note)}</span>` : "";
  return `${mark}${note}`;
};

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { options: [R], criteria: [R], values: [O], recommend: O };

// 数の決まり（within で確かめ、schema.mjs が出す）
export const limits = { options: [2, 3], criteria: [0, 6] };

export default function compare(data) {
  check("compare", data, schema);
  const O = data.options,
    Cr = data.criteria;
  within("compare", limits, "options", O.length);
  within("compare", limits, "criteria", Cr.length);
  if (data.values.length !== Cr.length || data.values.some((r) => r.length !== O.length)) throw new Error("compare: values は 観点の数 × 選択肢の数");
  const rec = data.recommend ? O.indexOf(data.recommend) : -1;
  if (data.recommend && rec < 0) throw new Error(`compare: recommend の ${data.recommend} が options にない`);
  const tint = (j) => (j === rec ? "bg-highlight" : "");
  const head = O.map(
    (o, j) => `<div class="flex flex-col items-center justify-end gap-[4px] rounded-t-panel px-[12px] pb-[12px] pt-[8px] ${tint(j)}">
  ${j === rec ? `<span class="rounded-full bg-primary px-[12px] text-caption font-bold text-on-primary">推奨</span>` : ""}
  <span class="text-center text-heading font-bold ${j === rec ? "text-primary" : "text-ink"}">${esc(o)}</span>
</div>`,
  ).join("");
  const rows = Cr.map((c, i) => {
    const last = i === Cr.length - 1;
    const vals = data.values[i]
      .map(
        (v, j) =>
          `<div class="flex flex-col items-center justify-center gap-[2px] border-t border-line px-[12px] py-[8px] text-center ${tint(j)} ${last && j === rec ? "rounded-b-panel" : ""}">${cell(v)}</div>`,
      )
      .join("");
    return `<div class="flex items-center border-t border-line pr-[12px] text-body font-bold text-ink">${esc(c)}</div>${vals}`;
  }).join("");
  return `<div class="grid h-full w-full" style="grid-template-columns: minmax(160px, 0.8fr) repeat(${O.length}, 1fr); grid-template-rows: auto repeat(${Cr.length}, 1fr)" data-kind="compare">
<div></div>${head}
${rows}
</div>`;
}
