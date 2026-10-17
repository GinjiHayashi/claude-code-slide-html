import { esc, need } from "./_util.mjs";

// flow：物やデータの流れを、箱と矢印で一列に示す。2〜8個。分岐や合流があるなら mermaid を使う。
// data: { nodes: [{ label, caption?, type?: "store" | "process" }], highlight?: [label], direction?, wrap? }
// - type: store（置き場所。白地に濃い枠）／process（処理。薄いグレーの地に枠）。書かなければ process。
// - 箱には必ず枠を付ける（地の色だけだと境目がわかりにくいため）。highlight の箱は primary の地に白い文字。
// - caption は短い説明。横向きでは箱の下、縦向きでは箱の右に書く。
// - direction: "right"（既定。左から右）／"down"（上から下）。
// - wrap: 1行に置く箱の数。超えたら端で下に折り返し、次の行は右から左へ進む（矢印が短くつながる「蛇行」の形）。
// - 箱の文字は文節で折り返す（word-break: auto-phrase。base.html で指定済み）。

const ARROW = {
  right: `<svg class="shrink-0" width="40" height="24" viewBox="0 0 40 24" aria-hidden="true"><path class="fill-none stroke-gray-600" stroke-width="3" d="M2 12H34M26 4l8 8-8 8"/></svg>`,
  left: `<svg class="shrink-0" width="40" height="24" viewBox="0 0 40 24" aria-hidden="true"><path class="fill-none stroke-gray-600" stroke-width="3" d="M38 12H6M14 4l-8 8 8 8"/></svg>`,
  down: `<svg class="shrink-0" width="24" height="40" viewBox="0 0 24 40" aria-hidden="true"><path class="fill-none stroke-gray-600" stroke-width="3" d="M12 2V34M4 26l8 8 8-8"/></svg>`,
};

export default function flow(data) {
  need("flow", data, ["nodes"]);
  const N = data.nodes;
  if (N.length < 2 || N.length > 8) throw new Error("flow: nodes は2〜8");
  const hi = new Set(data.highlight ?? []);
  const anyCap = N.some((n) => n.caption);
  const look = (n) =>
    hi.has(n.label) ? "bg-primary text-on-primary border-primary"
    : n.type === "store" ? "bg-canvas text-ink border-gray-600"
    : "bg-panel text-ink border-gray-400";

  if (data.direction === "down") {
    const items = N.map((n, i) => {
      const box = `<div class="flex h-[56px] w-[320px] shrink-0 items-center justify-center rounded-panel border-2 px-[12px] text-center text-heading font-bold ${look(n)}">${esc(n.label)}</div>`;
      const cap = anyCap ? `<div class="min-w-0 flex-1 text-body text-label">${esc(n.caption ?? "")}</div>` : "";
      const arrow = i < N.length - 1 ? `<div class="flex w-[320px] justify-center">${ARROW.down.replace('height="40"', 'height="28"').replace('viewBox="0 0 24 40"', 'viewBox="0 6 24 30"')}</div>` : "";
      return `<div class="flex items-center gap-[24px]">${box}${cap}</div>${arrow}`;
    });
    return `<div class="flex h-full w-full flex-col justify-center" data-kind="flow">${items.join("")}</div>`;
  }

  const per = Math.min(data.wrap ?? N.length, N.length);
  const rows = [];
  for (let i = 0; i < N.length; i += per) rows.push(N.slice(i, i + per));
  const H = rows.length > 1 ? "h-[72px]" : "h-[96px]"; // 折り返すときは箱を低くして縦に収める
  const cell = (n) =>
    n
      ? `<div class="flex min-w-0 flex-1 flex-col">
  <div class="flex ${H} items-center justify-center rounded-panel border-2 px-[12px] text-center text-heading font-bold ${look(n)}">${esc(n.label)}</div>
  ${anyCap ? `<div class="mt-[8px] min-h-[40px] text-center text-caption text-label">${esc(n.caption ?? "")}</div>` : ""}
</div>`
      : `<div class="min-w-0 flex-1"></div>`;
  const gap = (dir, show) => `<div class="flex ${H} w-[40px] shrink-0 items-center">${show ? ARROW[dir] : ""}</div>`;
  const html = rows.map((row, r) => {
    const rtl = r % 2 === 1;
    const cells = [...row, ...Array(per - row.length).fill(null)];
    const ordered = rtl ? [...cells].reverse() : cells;
    const parts = ordered.map((n, i) => {
      if (i === 0) return cell(n);
      const a = ordered[i - 1], b = n;
      return gap(rtl ? "left" : "right", a && b) + cell(n);
    });
    let turn = "";
    if (r < rows.length - 1) {
      // 折り返し：行の端（偶数行は右端、奇数行は左端）の箱の下に、下向きの矢印を置く
      const slots = Array(per).fill(`<div class="min-w-0 flex-1"></div>`);
      slots[rtl ? 0 : per - 1] = `<div class="flex min-w-0 flex-1 justify-center">${ARROW.down}</div>`;
      turn = `<div class="flex w-full gap-[0px] py-[4px]">${slots.join(`<div class="w-[40px] shrink-0"></div>`)}</div>`;
    }
    return `<div class="flex w-full items-start">${parts.join("")}</div>${turn}`;
  });
  return `<div class="flex h-full w-full flex-col justify-center" data-kind="flow">${html.join("")}</div>`;
}
