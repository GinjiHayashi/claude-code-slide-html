import { esc, check, R, O, optional, LINE, within } from "./_util.mjs";

// cycle：3〜6個の箱が一周する循環。始まりがわかるよう、箱の文字の頭に番号の小さい丸を付ける。
// data: { items: [{ label, caption?, arrow? }], shape?, title?, tone?, highlight?, numbered?, exit?, back? }
// - shape：ring（輪。既定）／row（横に並べ、最後の箱の下から最初の箱の下へ戻る線を引く）
//   ring は箱を楕円の上に時計回りに置く（4つなら四角の角、3つなら逆三角、5・6つなら五角・六角）。1つ目は左上
// - arrow：その箱から次の箱への矢印に添える短い文字（例：失敗あり）
// - caption：箱の下の説明（row のときだけ。2行まで）
// - back：row の戻る線の下に添える文字（例：小刻みにくり返す）
// - exit：輪から抜け出す先。{ from（何番目の箱から。1から）, label（抜け出す先の箱）, text?（矢印に添える文字） }
//   抜け出す先の箱は輪の右に置き、from の箱から右へ矢印を引く（ring のときだけ。from は輪の右側の箱にする）
// - highlight：目立たせる箱（何番目か、の並び。1から）。抜け出す先の箱はいつも目立たせる
// - tone：輪の色。ink（既定）／primary（線を青に。良い循環など）／muted（箱と線を灰色に。悪い循環など）
// - title：見出し。2つの輪を左右に並べて比べるときは、diagrams に cycle を2つ書き、それぞれに title を付ける
// - frame：true で輪を囲みに入れ、見出しを囲みの左上に書く（tone が primary なら淡い青の面、ほかは灰色の点線の枠）
// - numbered：false で番号の丸を付けない（既定は付ける）
// - 抜け出す先の箱があるときは、輪の箱と抜け出す先の箱を横に等間隔に並べる
// - 輪の上下の段のあいだは 96px までにして、枠の上下の中央に置く（左右の間隔とは別に決める）
// opt: { width, height }（置く枠の大きさ。既定は 1172×440）

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = {
  items: [{ label: R, caption: O, arrow: O }],
  shape: O,
  title: O,
  tone: O,
  highlight: O,
  numbered: O,
  exit: optional({ from: R, label: R, text: O }),
  back: O,
  frame: O,
};

const TONES = {
  ink: { box: `bg-canvas text-ink ${LINE.border}`, stroke: LINE.stroke, fill: LINE.fill, num: "bg-primary text-on-primary" },
  primary: { box: `bg-canvas text-ink ${LINE.border}`, stroke: "stroke-primary", fill: "fill-primary", num: "bg-primary text-on-primary" },
  muted: { box: "bg-panel text-label border-gray-400", stroke: "stroke-gray-400", fill: "fill-gray-400", num: "bg-gray-400 text-on-primary" },
};
const HI = { box: "bg-primary text-on-primary border-primary", num: "bg-canvas text-primary" };
// 囲み（frame）の見た目と見出しの色。自由図の area の plain・soft と同じ
const FRAME = {
  ink: { look: "border-dashed border-gray-400", head: "text-label" },
  muted: { look: "border-dashed border-gray-400", head: "text-label" },
  primary: { look: "bg-highlight border-transparent", head: "text-ink" },
};
const BH = 72, // 箱の高さ（1行の字にゆとりのある高さ）
  TITLE_H = 40, // 見出しの高さ
  PADF = 24, // 囲みの中のすき間
  GAP_V = 96, // 輪の上下の段の箱のあいだ（これより広げない。左右の間隔とは別に決める）
  BACK_V = 48, // row の戻る線の縦の長さ
  f1 = (v) => v.toFixed(1);

// 箱（中心 c、幅 w、高さ h）の縁の点のうち、点 p へ向かう線が出る点
const edge = ([cx, cy], w, h, [px, py]) => {
  const dx = px - cx,
    dy = py - cy;
  const k = Math.min(dx ? w / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity);
  return [cx + dx * k, cy + dy * k];
};
// 矢印（線と先の三角）。pts は折れ線の点
const arrow = (pts, c, gap = 4) => {
  const [p, q] = pts.slice(-2);
  const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
  const end = [q[0] - gap * Math.cos(ang), q[1] - gap * Math.sin(ang)];
  const all = [...pts.slice(0, -1), end];
  const s = 13;
  const tri = [end, [end[0] - s * Math.cos(ang - 0.5), end[1] - s * Math.sin(ang - 0.5)], [end[0] - s * Math.cos(ang + 0.5), end[1] - s * Math.sin(ang + 0.5)]];
  return `<path class="fill-none ${c.stroke}" stroke-width="2.5" stroke-linejoin="round" d="M${all.map(([x, y]) => `${f1(x)},${f1(y)}`).join("L")}"/><polygon class="${c.fill}" points="${tri.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}"/>`;
};
// 線の途中の文字（白い縁取り）
const label = (x, y, text, anchor = "middle") =>
  `<text class="fill-ink stroke-canvas text-body font-bold" stroke-width="6" paint-order="stroke" x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" dominant-baseline="central">${esc(text)}</text>`;

// 数の決まり（within で確かめ、schema.mjs が出す）
export const limits = { items: [3, 6] };

export default function cycle(data, opt = {}) {
  check("cycle", data, schema);
  const I = data.items;
  within("cycle", limits, "items", I.length);
  const shape = data.shape ?? "ring";
  if (!["ring", "row"].includes(shape)) throw new Error("cycle: shape は ring か row");
  const c = TONES[data.tone ?? "ink"];
  if (!c) throw new Error("cycle: tone は ink・primary・muted のどれか");
  if (shape === "ring" && I.some((it) => it.caption)) throw new Error("cycle: caption は shape: row のときだけ書ける");
  if (shape === "row" && data.exit) throw new Error("cycle: exit は shape: ring のときだけ書ける");
  if (![undefined, true, false].includes(data.numbered)) throw new Error("cycle: numbered は true か false");
  if (data.frame && shape === "row") throw new Error("cycle: frame は shape: ring のときだけ書ける");
  if (data.exit && !(Number.isInteger(data.exit.from) && data.exit.from >= 1 && data.exit.from <= I.length))
    throw new Error(`cycle: exit.from は 1〜${I.length} の整数`);
  const hi = new Set(data.highlight ?? []);
  const OW = opt.width ?? 1172,
    OH = opt.height ?? 440;
  // 囲みがあるときは、囲みの中（すき間と見出しの分を引いた範囲）に輪を置く
  const pad = data.frame ? PADF : 0;
  const W = OW - 2 * pad,
    H = OH - 2 * pad;
  const top = data.title ? TITLE_H : 0;

  // 箱の置き場所（中心）と大きさ
  let centers, bw, bh;
  const svg = [],
    html = [];
  if (shape === "ring") {
    // 抜け出す先があるときは、輪の左右の箱と抜け出す先の箱が横に等間隔になるよう、輪の幅を (W + 箱の幅) / 2 にする
    bw = data.exit ? Math.min(240, W * 0.24) : Math.min(260, W * 0.42);
    const ringW = data.exit ? (W + bw) / 2 : W;
    bh = BH;
    // 箱を楕円の上に時計回りに置き、いちばん外の箱が枠の端に来るように広げる（4つなら四角の角になる）
    const n = I.length,
      a0 = -Math.PI / 2 - Math.PI / n; // 1つ目が左上に来る向き
    const unit = I.map((_, k) => [Math.cos(a0 + (2 * Math.PI * k) / n), Math.sin(a0 + (2 * Math.PI * k) / n)]);
    const span = (v) => [Math.min(...v), Math.max(...v)];
    const [x0, x1] = span(unit.map((u) => u[0])),
      [y0, y1] = span(unit.map((u) => u[1]));
    // 囲みの中の3〜4つの輪は、箱を左右にも寄せて囲みの中央に置く（手作りの見本 A-1 の形。囲みの余白で、まとまりを見せる）
    const compact = data.frame && n <= 4 && !data.exit;
    // 上下は、段どうしの箱のあいだが GAP_V を超えないところまで広げ、枠の上下の中央に置く
    const ys = unit.map((u) => u[1]).sort((a, b) => a - b);
    const dMin = Math.min(
      ...ys
        .slice(1)
        .map((y, k) => y - ys[k])
        .filter((d) => d > 1e-6),
    ); // 段と段の間（いちばん狭いところ）
    const ringH = Math.min(H - top, bh + ((bh + GAP_V) * (y1 - y0)) / dMin);
    const oy = top + (H - top - ringH) / 2;
    // 同じ高さに並ぶ箱どうしが重ならないよう、箱の幅を狭める（5・6つの輪の上下の段など）
    const fy = (ringH - bh) / (y1 - y0),
      fx = 1 / (x1 - x0);
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(unit[p][1] - unit[q][1]) * fy >= bh + 16) continue;
        const d = Math.abs(unit[p][0] - unit[q][0]) * fx; // 箱の中心の間の、枠の幅（から箱の幅を引いた分）に対する割合
        bw = Math.min(bw, (ringW * d - 56) / (1 + d)); // あいだに 56px（矢印が見える長さ）をあける
      }
    const rw = compact ? Math.min(ringW, 2 * bw + 48) : ringW,
      ox = (ringW - rw) / 2;
    centers = unit.map(([ux, uy]) => [ox + bw / 2 + (ux - x0) * fx * (rw - bw), oy + bh / 2 + (uy - y0) * fy]);
    I.forEach((it, k) => {
      const a = centers[k],
        b = centers[(k + 1) % n];
      const s = edge(a, bw, bh, b),
        e = edge(b, bw, bh, a);
      svg.push(arrow([s, e], c));
      if (it.arrow) {
        const vertical = Math.abs(e[0] - s[0]) < Math.abs(e[1] - s[1]);
        svg.push(label((s[0] + e[0]) / 2 + (vertical ? 12 : 0), (s[1] + e[1]) / 2 - (vertical ? 0 : 14), it.arrow, vertical ? "start" : "middle"));
      }
    });
    if (data.exit) {
      const from = centers[data.exit.from - 1];
      const ex = [W - bw / 2, from[1]];
      if (from[0] < ringW / 2) throw new Error("cycle: exit.from は輪の右側の箱にする（抜け出す先は輪の右に置く）");
      const s = [from[0] + bw / 2, from[1]],
        e = [ex[0] - bw / 2, ex[1]];
      svg.push(arrow([s, e], { stroke: "stroke-primary", fill: "fill-primary" }));
      if (data.exit.text) svg.push(label((s[0] + e[0]) / 2, s[1] - 14, data.exit.text));
      html.push(box(ex, bw, bh, HI.box, "", esc(data.exit.label)));
    }
  } else {
    // 横に並べる：箱の下に説明、その下を戻る線が通る
    const n = I.length,
      gap = 56;
    bw = (W - gap * (n - 1)) / n;
    bh = BH;
    const capH = I.some((it) => it.caption) ? 56 : 0;
    const oy = top; // 上端は枠の上端にそろえる（左右に並べた図と上端がそろう）
    centers = I.map((_, k) => [bw / 2 + k * (bw + gap), oy + bh / 2]);
    I.forEach((it, k) => {
      if (k < n - 1) {
        const s = [centers[k][0] + bw / 2, centers[k][1]],
          e = [centers[k + 1][0] - bw / 2, centers[k + 1][1]];
        svg.push(arrow([s, e], c));
        if (it.arrow) svg.push(label((s[0] + e[0]) / 2, s[1] - 14, it.arrow));
      }
      if (it.caption)
        html.push(
          `<div class="absolute text-center text-body text-ink" style="left:${f1(centers[k][0] - bw / 2)}px;top:${f1(oy + bh + 8)}px;width:${f1(bw)}px">${esc(it.caption)}</div>`,
        );
    });
    const ys = oy + bh + (capH ? capH + 8 : 0),
      by = ys + BACK_V;
    const last = centers[n - 1],
      first = centers[0];
    svg.push(
      arrow(
        [
          [last[0], ys],
          [last[0], by],
          [first[0], by],
          [first[0], ys],
        ],
        c,
      ),
    );
    // 戻る線の文字は、線に重ねず線の下に置く
    if (data.back) svg.push(label((first[0] + last[0]) / 2, by + 22, data.back));
  }

  // 箱（番号の丸＋文字）
  I.forEach((it, k) => {
    const on = hi.has(k + 1);
    const num =
      data.numbered === false
        ? ""
        : `<span class="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-caption font-bold ${on ? HI.num : c.num}">${k + 1}</span>`;
    html.push(box(centers[k], bw, bh, on ? HI.box : c.box, num, esc(it.label)));
  });
  const F = FRAME[data.tone ?? "ink"];
  const head = data.title
    ? `<div class="absolute left-0 top-0 ${data.frame ? `px-[12px] py-[8px] text-body ${F.head}` : "text-heading text-ink"} font-bold">${esc(data.title)}</div>`
    : "";
  const inner = `<div class="absolute" style="left:${pad}px;top:${pad}px;width:${W}px;height:${H}px">
<svg data-origin="generated" class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${svg.join("")}</svg>
${html.join("\n")}
</div>`;
  return `<div class="relative mx-auto${data.frame ? ` rounded-panel border-2 ${F.look}` : ""}" style="width:${OW}px;height:${OH}px" data-kind="cycle">
${head}
${inner}
</div>`;
}

function box([cx, cy], w, h, look, num, text) {
  return `<div class="absolute flex items-center justify-center gap-[8px] rounded-panel border-2 px-[12px] text-center text-body font-bold ${look}" style="left:${f1(cx - w / 2)}px;top:${f1(cy - h / 2)}px;width:${f1(w)}px;height:${f1(h)}px">${num}<span>${text}</span></div>`;
}
