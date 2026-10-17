import { esc, need, lineOf, rounded } from "./_util.mjs";

// er：データの項目と関係（ER 図。試作）。表は6まで。
// data: {
//   entities: [{ name, fields: [{ name, key?: "PK" | "FK" }], col?, row? }],
//   relations: [{ from, to, card?: "1:N" など（両端に書く）, label? }],
//   highlight?: [表の名前], line?
// }
// opt: { width, height }（既定は 1172×440）
// - 表は見出しを塗り、項目を並べる。col・row を書かなければ、左上から3列で並べる。
// - 関係の線は縦横の角の丸い（半径 8）折れ線。両端に「1」「N」などの多重度を書く。

export default function er(data, opt = {}) {
  need("er", data, ["entities", "relations"]);
  const E = data.entities;
  if (E.length < 2 || E.length > 6) throw new Error("er: entities は2〜6");
  const LN = lineOf(data);
  const W = opt.width ?? 1172, H = opt.height ?? 440;
  const per = Math.min(3, E.length);
  const N = E.map((e, i) => ({ ...e, col: e.col ?? i % per, row: e.row ?? Math.floor(i / per) }));
  const cols = Math.max(...N.map((e) => e.col)) + 1, rows = Math.max(...N.map((e) => e.row)) + 1;
  const cw = W / cols, ch = H / rows, bw = Math.min(240, cw - 96);
  const hh = 36, fh = 28;
  const hi = new Set(data.highlight ?? []);
  const P = Object.fromEntries(N.map((e) => {
    const h = hh + e.fields.length * fh;
    if (h > ch - 16) throw new Error(`er: ${e.name} の項目が多すぎて収まらない`);
    const x = e.col * cw + (cw - bw) / 2, y = e.row * ch + (ch - h) / 2;
    return [e.name, { x, y, h, cx: x + bw / 2, cy: y + h / 2 }];
  }));
  const tables = N.map((e) => {
    const p = P[e.name], on = hi.has(e.name);
    const fields = e.fields.map((f) => `<div class="flex items-center gap-[8px] border-t border-line px-[12px] text-caption text-ink" style="height:${fh}px"><span class="w-[24px] shrink-0 font-bold ${f.key === "PK" ? "text-primary" : "text-label"}">${esc(f.key ?? "")}</span><span class="${f.key === "PK" ? "font-bold" : ""}">${esc(f.name)}</span></div>`).join("");
    return `<div class="absolute overflow-hidden rounded-panel border-2 bg-canvas ${on ? "border-primary" : LN.border}" style="left:${p.x}px;top:${p.y}px;width:${bw}px">
<div class="flex items-center px-[12px] text-body font-bold ${on ? "bg-primary text-on-primary" : "bg-highlight text-ink"}" style="height:${hh}px">${esc(e.name)}</div>${fields}</div>`;
  }).join("");
  const byName = (n) => N.find((e) => e.name === n) ?? (() => { throw new Error(`er: ${n} という表がない`); })();
  const lines = data.relations.map((r) => {
    let a = P[r.from], b = P[r.to];
    const A = byName(r.from), B = byName(r.to);
    let [ca, cb] = (r.card ?? "").split(":");
    let pts;
    if (A.col === B.col) {
      const [u, d, cu, cd] = A.row < B.row ? [a, b, ca, cb] : [b, a, cb, ca];
      pts = [[u.cx, u.y + u.h], [d.cx, d.y]];
      [ca, cb] = [cu, cd];
      return draw(pts, ca, cb, r.label, "v");
    }
    const [l, rt, cl, cr] = A.col < B.col ? [a, b, ca, cb] : [b, a, cb, ca];
    const sx = l.x + bw, ex = rt.x, mx = sx + (ex - sx) / 2;
    pts = l.cy === rt.cy ? [[sx, l.cy], [ex, rt.cy]] : [[sx, l.cy], [mx, l.cy], [mx, rt.cy], [ex, rt.cy]];
    return draw(pts, cl, cr, r.label, "h");
  }).join("");
  function draw(pts, c1, c2, label, dir) {
    const t = (txt, [x, y], k) => (txt ? `<text class="fill-ink text-caption font-bold" x="${(x + (dir === "h" ? k * 12 : 10)).toFixed(1)}" y="${(y + (dir === "h" ? -8 : k * 14)).toFixed(1)}" text-anchor="${dir === "h" ? (k > 0 ? "start" : "end") : "start"}" dominant-baseline="middle">${esc(txt)}</text>` : "");
    const [p0, p1] = [pts[0], pts.at(-1)];
    const m = pts.length > 2 ? [pts[1][0], (pts[1][1] + pts[2][1]) / 2] : [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const lab = label ? `<text class="fill-label stroke-canvas text-caption" stroke-width="6" paint-order="stroke" x="${m[0].toFixed(1)}" y="${(m[1] - 8).toFixed(1)}" text-anchor="middle">${esc(label)}</text>` : "";
    return `<path class="fill-none ${LN.stroke}" stroke-width="2" d="${rounded(pts, 8)}"/>${t(c1, p0, 1)}${t(c2, p1, -1)}${lab}`;
  }
  return `<div class="relative mx-auto" style="width:${W}px;height:${H}px" data-kind="er">
<svg class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${lines}</svg>
${tables}
</div>`;
}
