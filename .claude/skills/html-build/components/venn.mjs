import { esc, check, R, O, optional, LINE } from "./_util.mjs";

let seq = 0; // 1つのデッキに venn が複数あっても clipPath の id が重ならないようにする

// venn：2〜3つの集合の重なり。
// data: {
//   sets: [{ label, items? }]（items はその集合だけに入るもの）,
//   overlaps?: [{ sets: [集合の番号（0から）], items }]（重なりに入るもの）,
//   highlight?: true（すべての集合が重なる部分を淡い青で塗る）
// }
// opt: { width, height }（既定は 1172×440）
// - 円は白地に枠。重なりは塗らず、highlight のときだけ全部が重なる部分を塗る（色を混ぜない）。
// - 集合の名前は円の外に、各部分の項目は部分の中に書く。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { sets: [{ label: R, items: O }], overlaps: optional([{ sets: R, items: O }]), highlight: O };

export default function venn(data, opt = {}) {
  check("venn", data, schema);
  const S = data.sets, n = S.length;
  if (n < 2 || n > 3) throw new Error("venn: sets は2〜3");
  const LN = LINE;
  const W = opt.width ?? 1172, H = opt.height ?? 440;
  const mid = W / 2;
  let C, r;
  if (n === 2) {
    r = Math.min(190, H / 2 - 20);
    C = [[mid - r * 0.62, H / 2], [mid + r * 0.62, H / 2]];
  } else {
    r = Math.min(150, (H - 20) / 2.95); // 中心どうしの距離を半径の 1.1 倍にし、3つが重なる部分に文字が入るようにする
    const top = r + 10;
    C = [[mid - r * 0.55, top], [mid + r * 0.55, top], [mid, top + r * 0.95]];
  }
  const key = (a) => [...a].sort().join("-");
  const ov = Object.fromEntries((data.overlaps ?? []).map((o) => [key(o.sets), o.items ?? []]));
  // 各部分の文字の位置：その部分の中で、どの円の線からもいちばん遠い点（格子で探す）
  const at = {};
  const best = {};
  for (let y = 0; y <= H; y += 3) {
    for (let x = 0; x <= W; x += 3) {
      const d = C.map(([cx, cy]) => Math.hypot(x - cx, y - cy));
      const inside = d.map((v, i) => (v < r ? i : -1)).filter((i) => i >= 0);
      if (!inside.length) continue;
      const k = inside.join("-"), m = Math.min(...d.map((v) => Math.abs(v - r)));
      if (!best[k] || m > best[k]) { best[k] = m; at[k] = [x, y]; }
    }
  }
  const size = n === 2 ? "text-body" : "text-caption";
  const lh = n === 2 ? 24 : 18;
  const block = (k, items, bold) => {
    if (!items?.length) return "";
    const [x, y] = at[k];
    const y0 = y - ((items.length - 1) * lh) / 2;
    return items.map((t, i) => `<text class="fill-ink ${size} ${bold ? "font-bold" : ""}" x="${x.toFixed(1)}" y="${(y0 + i * lh).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(t)}</text>`).join("");
  };
  const all = key(S.map((_, i) => i));
  const uid = `venn${++seq}`;
  // 全部が重なる部分：円を順に切り抜いて重ねる
  const clips = C.map(([x, y], i) => `<clipPath id="${uid}-c${i}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>`).join("");
  let hiShape = "";
  if (data.highlight) {
    hiShape = `<circle class="fill-blue-200" cx="${C[0][0]}" cy="${C[0][1]}" r="${r}"/>`;
    for (let i = 1; i < n; i++) hiShape = `<g clip-path="url(#${uid}-c${i})">${hiShape}</g>`;
  }
  const circles = C.map(([x, y]) => `<circle class="fill-none ${LN.stroke}" stroke-width="2.5" cx="${x}" cy="${y}" r="${r}"/>`).join("");
  // 集合の名前：2つなら上、3つなら上の2つは外側の上、下の1つは右下
  const labels = S.map((s, i) => {
    const [x, y] = C[i];
    let lx, ly, anchor;
    if (n === 2) { lx = x + (i ? r * 0.35 : -r * 0.35); ly = y - r - 16; anchor = i ? "start" : "end"; }
    else if (i < 2) { lx = x + (i ? r * 0.75 : -r * 0.75); ly = y - r * 0.8; anchor = i ? "start" : "end"; }
    else { lx = x + r * 0.85; ly = y + r * 0.85; anchor = "start"; }
    return `<text class="fill-ink text-heading font-bold" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle">${esc(s.label)}</text>`;
  }).join("");
  const texts = S.map((s, i) => block(String(i), s.items)).join("") +
    Object.keys(at).filter((k) => k.includes("-") && k.split("-").length <= n).map((k) => block(k, ov[k], k === all && data.highlight)).join("");
  return `<div class="mx-auto" style="width:${W}px;height:${H}px" data-kind="venn">
<svg data-origin="generated" class="block overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ベン図"><defs>${clips}</defs>${hiShape}${circles}${labels}${texts}</svg>
</div>`;
}
