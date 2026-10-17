import { esc, need } from "./_util.mjs";

// flow：物やデータの流れを、箱と矢印で左から右へ一列に示す。2〜6個。分岐や合流があるなら mermaid を使う。
// data: { nodes: [{ label, caption?, type?: "store" | "process", icon? }], highlight?: [label] }
// - type: store（置き場所。白地に枠）／process（処理。薄いグレーの地）。書かなければ process。
// - highlight の箱は primary の地に白い文字。
// - caption は箱の下に書く短い説明（2行まで）。
// - 箱の文字は文節で折り返す（word-break: auto-phrase。base.html で指定済み）。

const arrow = `<svg class="shrink-0" width="40" height="24" viewBox="0 0 40 24" aria-hidden="true"><path class="fill-none stroke-gray-600" stroke-width="3" d="M2 12H34M26 4l8 8-8 8"/></svg>`;

export default function flow(data) {
  need("flow", data, ["nodes"]);
  const N = data.nodes;
  if (N.length < 2 || N.length > 6) throw new Error("flow: nodes は2〜6");
  const hi = new Set(data.highlight ?? []);
  const anyCap = N.some((n) => n.caption);
  const parts = N.map((n) => {
    const box = hi.has(n.label)
      ? "bg-primary text-on-primary border-primary"
      : n.type === "store"
        ? "bg-canvas text-ink border-gray-600"
        : "bg-panel text-ink border-panel";
    const cap = anyCap ? `<div class="mt-[12px] min-h-[48px] text-center text-caption text-label">${esc(n.caption ?? "")}</div>` : "";
    return `<div class="flex min-w-0 max-w-[220px] flex-1 flex-col">
  <div class="flex h-[96px] items-center justify-center rounded-panel border-2 px-[12px] text-center text-heading font-bold ${box}">${esc(n.label)}</div>
  ${cap}
</div>`;
  });
  const row = parts.join(`<div class="flex h-[96px] shrink-0 items-center">${arrow}</div>`);
  return `<div class="flex h-full w-full items-center justify-center" data-kind="flow">
<div class="flex w-full items-start justify-center gap-[12px]">${row}</div>
</div>`;
}
