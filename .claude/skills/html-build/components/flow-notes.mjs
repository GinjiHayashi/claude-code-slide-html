import { esc, inline, check, R, O, optional, LINE } from "./_util.mjs";

// flow-notes：横に並べた流れの箱と、それぞれの下に置く説明の箱。2〜5個。
// data: { items: [{ label, note }], base?: { label } }
// - 上の段：流れの箱（白地に枠）を左から右へ矢印でつなぐ
// - 中の段：各箱に対応する説明の箱（淡い青の地）。説明の箱の高さはそろえる。説明の箱から上の箱へ上向きの矢印
// - base：いちばん下の横長の帯（青地に白の字。例：相互レビュー）。帯から説明の箱へ上向きの矢印
// - note の `…` は文中のコード、**…** は太字。全角40字（2〜3行）までを目安にする
// - 図は枠の上下の中央に置く
// opt: { width, height }

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { items: [{ label: R, note: R }], base: optional({ label: R }) };

const GAP_H = 56, // 上の箱どうしのあいだ（矢印の長さ）
  GAP_V = 40; // 段と段のあいだ（上向きの矢印の長さ）

// 矢印（線と先の三角）。right：右向き、up：上向き
const right = `<svg class="block" width="${GAP_H}" height="16" viewBox="0 0 ${GAP_H} 16" aria-hidden="true"><path class="fill-none ${LINE.stroke}" stroke-width="2.5" d="M4,8H${GAP_H - 16}"/><polygon class="${LINE.fill}" points="${GAP_H - 4},8 ${GAP_H - 17},1 ${GAP_H - 17},15"/></svg>`;
const up = `<svg class="block" width="16" height="${GAP_V}" viewBox="0 0 16 ${GAP_V}" aria-hidden="true"><path class="fill-none ${LINE.stroke}" stroke-width="2.5" d="M8,${GAP_V - 4}V16"/><polygon class="${LINE.fill}" points="8,4 1,17 15,17"/></svg>`;

export default function flowNotes(data, opt = {}) {
  check("flow-notes", data, schema);
  const I = data.items;
  if (I.length < 2 || I.length > 5) throw new Error("flow-notes: items は2〜5");
  // 列は「箱・矢印・箱・矢印・…」。矢印の列は GAP_H の幅
  const cols = I.map(() => "minmax(0,1fr)").join(` ${GAP_H}px `);
  const at = (k) => 2 * k + 1;
  const cell = (row, col, cls, html) => `<div class="${cls}" style="grid-row:${row};grid-column:${col}">${html}</div>`;
  const parts = [];
  I.forEach((it, k) => {
    parts.push(
      cell(
        1,
        at(k),
        `flex h-[72px] items-center justify-center rounded-panel border-2 ${LINE.border} bg-canvas px-[12px] text-center text-body font-bold text-ink`,
        esc(it.label),
      ),
      cell(2, at(k), "flex justify-center", up),
      cell(
        3,
        at(k),
        `flex items-center justify-center rounded-panel border-2 ${LINE.border} bg-highlight px-[16px] py-[12px] text-center text-body text-ink`,
        inline(it.note),
      ),
    );
    if (k < I.length - 1) parts.push(cell(1, at(k) + 1, "flex items-center", right));
    if (data.base) parts.push(cell(4, at(k), "flex justify-center", up));
  });
  if (data.base)
    parts.push(
      cell(
        5,
        "1 / -1",
        "flex h-[56px] items-center justify-center rounded-panel border-2 border-primary bg-primary text-body font-bold text-on-primary",
        esc(data.base.label),
      ),
    );
  return `<div class="flex h-full w-full flex-col justify-center" style="max-height:${opt.height ?? 440}px" data-kind="flow-notes">
<div class="grid w-full" style="grid-template-columns:${cols}">
${parts.join("\n")}
</div>
</div>`;
}
