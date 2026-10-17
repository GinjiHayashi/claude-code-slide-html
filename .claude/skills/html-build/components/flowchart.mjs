import { esc, need, lineOf } from "./_util.mjs";

// flowchart（試作）：枝分かれ・合流・戻りのある流れ図を、Mermaid を使わずに描く。
// 箱を格子（列 col・行 row）に置き、矢印は縦横の線だけで折り曲げてつなぐ。
// data: {
//   nodes: [{ id, label, col, row, type?: "process" | "store" | "decision" }],
//   edges: [{ from, to, label? }],
//   highlight?: [id], line?
// }
// opt:  { width, height }（置く枠の大きさ。既定は 1172×440）
// 矢印の通り方：
//   - 右の列へ：箱の右から出て、2つの列の間で上下に折れ、相手の箱の左に入る（枝分かれ・合流）
//   - 同じ列：上下にまっすぐ
//   - 左の列へ（戻り）：箱の下から出て、図のいちばん下を通り、相手の箱の下に入る
// 矢印に書く文字（label）は、最後の線の途中に白い縁取りを付けて書く。

export default function flowchart(data, opt = {}) {
  need("flowchart", data, ["nodes", "edges"]);
  const N = data.nodes, E = data.edges;
  if (N.length < 2 || N.length > 12) throw new Error("flowchart: nodes は2〜12");
  const LN = lineOf(data);
  const W = opt.width ?? 1172, H = opt.height ?? 440;
  const cols = Math.max(...N.map((n) => n.col)) + 1;
  const rows = Math.max(...N.map((n) => n.row)) + 1;
  const back = E.some((e) => byId(e.to).col < byId(e.from).col);
  const cw = W / cols, ch = (H - (back ? 48 : 0)) / rows;
  const bw = Math.min(200, cw - 72), bh = Math.min(64, ch - 32);
  const pos = Object.fromEntries(
    N.map((n) => {
      const x = n.col * cw + (cw - bw) / 2, y = n.row * ch + (ch - bh) / 2;
      return [n.id, { x, y, cx: x + bw / 2, cy: y + bh / 2 }];
    }),
  );
  const hi = new Set(data.highlight ?? []);
  function byId(id) {
    const n = N.find((n) => n.id === id);
    if (!n) throw new Error(`flowchart: ${id} という箱がない`);
    return n;
  }

  const boxes = N.map((n) => {
    const p = pos[n.id];
    const look = hi.has(n.id) ? "bg-primary text-on-primary border-primary"
      : n.type === "store" ? `bg-highlight text-ink ${LN.border}`
      : `bg-canvas text-ink ${LN.border}`;
    const shape = n.type === "decision" ? "rounded-full" : "rounded-panel";
    return `<div class="absolute flex items-center justify-center border-2 px-[8px] text-center text-body font-bold ${shape} ${look}" style="left:${p.x}px;top:${p.y}px;width:${bw}px;height:${bh}px">${esc(n.label)}</div>`;
  }).join("");

  const loopY = H - 20;
  const edges = E.map((e) => {
    const a = pos[e.from], b = pos[e.to], A = byId(e.from), B = byId(e.to);
    let pts;
    if (B.col > A.col) {
      const sx = a.x + bw, ex = b.x, mx = sx + (ex - sx) / 2;
      pts = a.cy === b.cy ? [[sx, a.cy], [ex, b.cy]] : [[sx, a.cy], [mx, a.cy], [mx, b.cy], [ex, b.cy]];
    } else if (B.col === A.col) {
      pts = B.row > A.row ? [[a.cx, a.y + bh], [b.cx, b.y]] : [[a.cx, a.y], [b.cx, b.y + bh]];
    } else {
      pts = [[a.cx, a.y + bh], [a.cx, loopY], [b.cx, loopY], [b.cx, b.y + bh]];
    }
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    // 矢印の先：最後の線の向きに合わせた三角
    const [[px, py], [qx, qy]] = pts.slice(-2);
    const ang = Math.atan2(qy - py, qx - px), s = 13;
    const tri = [[qx, qy], [qx - s * Math.cos(ang - 0.5), qy - s * Math.sin(ang - 0.5)], [qx - s * Math.cos(ang + 0.5), qy - s * Math.sin(ang + 0.5)]]
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    let lab = "";
    if (e.label) {
      const [[lx1, ly1], [lx2, ly2]] = pts.length > 2 ? pts.slice(-3, -1) : pts;
      const lx = (lx1 + lx2) / 2, ly = (ly1 + ly2) / 2;
      lab = `<text class="fill-ink stroke-canvas text-caption font-bold" stroke-width="6" paint-order="stroke" x="${lx.toFixed(1)}" y="${(ly - (ly1 === ly2 ? 8 : 0)).toFixed(1)}" text-anchor="${ly1 === ly2 ? "middle" : "start"}" dx="${ly1 === ly2 ? 0 : 8}" dominant-baseline="${ly1 === ly2 ? "auto" : "middle"}">${esc(e.label)}</text>`;
    }
    return `<path class="fill-none ${LN.stroke}" stroke-width="2.5" stroke-linejoin="round" d="${d}"/><polygon class="${LN.fill}" points="${tri}"/>${lab}`;
  }).join("");

  return `<div class="relative mx-auto" style="width:${W}px;height:${H}px" data-kind="flowchart">
<svg class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${edges}</svg>
${boxes}
</div>`;
}
