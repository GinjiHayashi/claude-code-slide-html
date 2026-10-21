import { esc, check, R, O, LINE, within } from "./_util.mjs";

// roadmap：期間のある計画を、横に期間・縦に分野（レーン）を並べた表の上に棒で示す。
// data: { periods: [string], lanes: [{ name, items: [{ start, end, label, highlight? }] }] }
// - start・end は periods の名前で書く（例 "2026年4月"）。end を含む。
// - 期間は8列まで、レーンは4まで。同じレーンの棒は重ねない（重なるならレーンを分ける）。
// - 見出し行は table と同じ primary の塗りに白文字。レーンは白と薄いグレーを交互にする（表の style: zebra と揃える）。
// - 棒は白地に枠。highlight の棒は primary の塗りに白文字。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { periods: [R], lanes: [{ name: R, items: [{ start: R, end: R, label: R, highlight: O }] }] };

// 数の決まり（within で確かめ、schema.mjs が出す）
export const limits = { periods: [2, 8], lanes: [1, 4] };

export default function roadmap(data) {
  check("roadmap", data, schema);
  const P = data.periods,
    L = data.lanes;
  within("roadmap", limits, "periods", P.length);
  within("roadmap", limits, "lanes", L.length);
  const LN = LINE;
  const idx = (p) => {
    const i = P.indexOf(p);
    if (i < 0) throw new Error(`roadmap: periods に ${p} がない`);
    return i;
  };
  const cols = `grid-template-columns: 200px repeat(${P.length}, minmax(0, 1fr))`;
  const head = `<div class="grid" style="${cols}"><div class="bg-primary"></div>${P.map((p) => `<div class="bg-primary px-[8px] py-[10px] text-center text-body font-bold text-on-primary">${esc(p)}</div>`).join("")}</div>`;
  const lanes = L.map((lane, r) => {
    const used = new Set();
    const bars = lane.items.map((it) => {
      const s = idx(it.start),
        e = idx(it.end);
      for (let k = s; k <= e; k++) {
        if (used.has(k)) throw new Error(`roadmap: ${lane.name} の棒が重なっている`);
        used.add(k);
      }
      const look = it.highlight ? "bg-primary border-primary text-on-primary" : `bg-canvas ${LN.border} text-ink`;
      return `<div class="z-10 mx-[4px] flex h-[44px] items-center justify-center self-center rounded-panel border-2 px-[8px] text-center text-body font-bold ${look}" style="grid-column: ${s + 2} / ${e + 3}; grid-row: 1">${esc(it.label)}</div>`;
    });
    const bg = r % 2 ? "bg-panel" : "bg-canvas";
    const grid = P.map((_, k) => `<div class="border-l border-line" style="grid-column: ${k + 2}; grid-row: 1"></div>`).join("");
    return `<div class="grid min-h-0 flex-1 ${bg}" style="${cols}">
  <div class="flex items-center px-[16px] text-heading font-bold text-ink" style="grid-column: 1; grid-row: 1">${esc(lane.name)}</div>
  ${grid}${bars.join("")}
</div>`;
  });
  return `<div class="flex h-full w-full flex-col" data-kind="roadmap">${head}<div class="flex min-h-0 flex-1 flex-col">${lanes.join("\n")}</div></div>`;
}
