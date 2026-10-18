import { esc, check, R, O, optional, LINE, rounded } from "./_util.mjs";

// flowchart：流れ図。一列の流れから、枝分かれ・合流・戻りのある図まで、Mermaid を使わずに描く。
// （以前の flow を統合した。箱を格子に置き、矢印は縦横の線を角の丸い折れ線でつなぐ）
//
// 書き方は2通り。
// 1) 一列の流れ（簡単な書き方）：nodes を並べるだけ。col・row と edges を書かなければ、順に自動でつなぐ。
//    data: { nodes: [{ label, caption?, type? }], direction?: "right" | "down", wrap?: 1行の箱の数 }
//    - direction: "right"（既定。左から右）／"down"（上から下。caption は箱の右に書く）
//    - wrap: 1行の箱の数。超えたら、行の右端の箱から矢印を折り曲げて次の行の左端の箱へつなぎ、次の行も左から右へ進む
// 2) 枝分かれ・合流・戻りのある図：箱に id・col（列）・row（行）を付け、edges でつなぎ方を書く。
//    data: { nodes: [{ id, label, col, row, caption?, type? }], edges: [{ from, to, label? }] }
//
// 共通：type: process（白地。既定）／store（置き場所。淡い青の地）／decision（判断。丸い箱）
//       highlight?: [id または label]、radius?（矢印の曲がり角の半径。既定 8）
//       caption は箱の下（down のときは右）に書く短い説明（2行まで）。
// opt:  { width, height }（置く枠の大きさ。既定は 1172×440）
// 矢印の通り方：
//   - 右の列へ：箱の右から出て、2つの列の間で上下に折れ、相手の箱の左に入る（枝分かれ・合流）
//   - 下の行の左の列へ（折り返し）：箱の下から出て、2つの行の間で左へ折れ、相手の箱の上に入る
//   - 同じ行で左の列へ：まっすぐ左へ
//   - 同じ列：上下にまっすぐ
//   - 上の行の左の列へ（戻り・ループ）：箱の下から出て、図のいちばん下を通り、相手の箱の下に入る
// 矢印に書く文字（label）は、最後の線の途中に白い縁取りを付けて書く。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = {
  nodes: [{ label: R, caption: O, type: O, id: O, col: O, row: O }],
  edges: optional([{ from: R, to: R, label: O }]),
  direction: O,
  wrap: O,
  highlight: O,
  radius: O,
};

export default function flowchart(data, opt = {}) {
  check("flowchart", data, schema);
  const auto = data.nodes.every((n) => n.col === undefined && n.row === undefined);
  const down = auto && data.direction === "down";
  const N = data.nodes.map((n, i) => {
    const id = n.id ?? n.label;
    if (!auto) return { ...n, id };
    if (down) return { ...n, id, col: 0, row: i };
    const per = data.wrap ?? data.nodes.length;
    const row = Math.floor(i / per),
      k = i % per;
    return { ...n, id, row, col: k };
  });
  const E = data.edges ?? (auto ? N.slice(1).map((n, i) => ({ from: N[i].id, to: n.id })) : null);
  if (!E) throw new Error("flowchart: col・row を書いたときは edges も書く");
  if (N.length < 2 || N.length > 12) throw new Error("flowchart: nodes は2〜12");
  const LN = LINE;
  const W = opt.width ?? 1172,
    H = opt.height ?? 440;
  const cols = Math.max(...N.map((n) => n.col)) + 1;
  const rows = Math.max(...N.map((n) => n.row)) + 1;
  const anyCap = N.some((n) => n.caption);
  const back = E.some((e) => byId(e.to).col < byId(e.from).col && byId(e.to).row < byId(e.from).row);
  const capH = anyCap && !down ? 44 : 0; // 箱の下の説明の高さ
  const cw = W / cols,
    ch = (H - (back ? 48 : 0)) / rows;
  const bw = down ? 320 : Math.min(220, cw - 56);
  const bh = Math.min(down ? 56 : rows === 1 ? 96 : 72, ch - capH - 24);
  const pos = Object.fromEntries(
    N.map((n) => {
      const x = down ? (anyCap ? 0 : (W - bw) / 2) : n.col * cw + (cw - bw) / 2;
      const y = n.row * ch + (ch - bh - capH) / 2;
      return [n.id, { x, y, cx: x + bw / 2, cy: y + bh / 2 }];
    }),
  );
  const hi = new Set(data.highlight ?? []);
  const isHi = (n) => hi.has(n.id) || hi.has(n.label);
  function byId(id) {
    const n = N.find((n) => n.id === id);
    if (!n) throw new Error(`flowchart: ${id} という箱がない`);
    return n;
  }

  const boxes = N.map((n) => {
    const p = pos[n.id];
    const look = isHi(n)
      ? "bg-primary text-on-primary border-primary"
      : n.type === "store"
        ? `bg-highlight text-ink ${LN.border}`
        : `bg-canvas text-ink ${LN.border}`;
    const shape = n.type === "decision" ? "rounded-full" : "rounded-panel";
    const big = bh >= 72 && bw >= 180 ? "text-heading" : "text-body"; // 箱が小さいときは文字も小さくして収める
    const box = `<div class="absolute flex items-center justify-center border-2 px-[8px] text-center ${big} font-bold ${shape} ${look}" style="left:${p.x}px;top:${p.y}px;width:${bw}px;height:${bh}px">${esc(n.label)}</div>`;
    if (!n.caption) return box;
    const cap = down
      ? `<div class="absolute flex items-center text-body text-label" style="left:${p.x + bw + 24}px;top:${p.y}px;width:${W - bw - 24}px;height:${bh}px">${esc(n.caption)}</div>`
      : `<div class="absolute text-center text-caption text-label" style="left:${p.x - 12}px;top:${p.y + bh + 8}px;width:${bw + 24}px">${esc(n.caption)}</div>`;
    return box + cap;
  }).join("");

  const loopY = H - 20;
  const edges = E.map((e) => {
    const a = pos[e.from],
      b = pos[e.to],
      A = byId(e.from),
      B = byId(e.to);
    let pts;
    if (B.col > A.col) {
      const sx = a.x + bw,
        ex = b.x,
        mx = sx + (ex - sx) / 2;
      pts =
        a.cy === b.cy
          ? [
              [sx, a.cy],
              [ex, b.cy],
            ]
          : [
              [sx, a.cy],
              [mx, a.cy],
              [mx, b.cy],
              [ex, b.cy],
            ];
    } else if (B.row > A.row) {
      // 折り返し：行と行の間（説明があればその下）で左へ折れる
      const top = a.y + bh + capH,
        gy = top + (b.y - top) / 2;
      if (capH) {
        // 箱の下に説明があるときは、説明に重ならないよう箱の右から出て回り込む
        const rx = a.x + bw + Math.min(20, (cw - bw) / 2 - 4);
        pts = [
          [a.x + bw, a.cy],
          [rx, a.cy],
          [rx, gy],
          [b.cx, gy],
          [b.cx, b.y],
        ];
      } else {
        pts = [
          [a.cx, a.y + bh],
          [a.cx, gy],
          [b.cx, gy],
          [b.cx, b.y],
        ];
      }
    } else if (B.row === A.row) {
      pts = [
        [a.x, a.cy],
        [b.x + bw, b.cy],
      ]; // 折り返した行：まっすぐ左へ
    } else if (B.col === A.col) {
      pts =
        B.row > A.row
          ? [
              [a.cx, a.y + bh],
              [b.cx, b.y],
            ]
          : [
              [a.cx, a.y],
              [b.cx, b.y + bh],
            ];
    } else {
      pts = [
        [a.cx, a.y + bh],
        [a.cx, loopY],
        [b.cx, loopY],
        [b.cx, b.y + bh],
      ];
    }
    const d = rounded(pts, data.radius ?? 8);
    // 矢印の先：最後の線の向きに合わせた三角
    const [[px, py], [qx, qy]] = pts.slice(-2);
    const ang = Math.atan2(qy - py, qx - px),
      s = 13;
    const tri = [
      [qx, qy],
      [qx - s * Math.cos(ang - 0.5), qy - s * Math.sin(ang - 0.5)],
      [qx - s * Math.cos(ang + 0.5), qy - s * Math.sin(ang + 0.5)],
    ]
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    let lab = "";
    if (e.label) {
      const [[lx1, ly1], [lx2, ly2]] = pts.length > 2 ? pts.slice(-3, -1) : pts;
      const lx = (lx1 + lx2) / 2,
        ly = (ly1 + ly2) / 2;
      lab = `<text class="fill-ink stroke-canvas text-caption font-bold" stroke-width="6" paint-order="stroke" x="${lx.toFixed(1)}" y="${(ly - (ly1 === ly2 ? 8 : 0)).toFixed(1)}" text-anchor="${ly1 === ly2 ? "middle" : "start"}" dx="${ly1 === ly2 ? 0 : 8}" dominant-baseline="${ly1 === ly2 ? "auto" : "middle"}">${esc(e.label)}</text>`;
    }
    return `<path class="fill-none ${LN.stroke}" stroke-width="2.5" stroke-linejoin="round" d="${d}"/><polygon class="${LN.fill}" points="${tri}"/>${lab}`;
  }).join("");

  return `<div class="relative mx-auto" style="width:${W}px;height:${H}px" data-kind="flowchart">
<svg data-origin="generated" class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${edges}</svg>
${boxes}
</div>`;
}
