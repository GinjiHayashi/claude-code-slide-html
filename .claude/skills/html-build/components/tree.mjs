import { esc, check, R, O, optional, LINE, rounded } from "./_util.mjs";

// tree：階層（組織、分類）。3階層まで、1つの親の子は5まで。
// data: {
//   root: 名前（文字）または { label },
//   children: [{ label, children?: [{ label }] }],
//   direction?: "down" | "right", highlight?: [label]
// }
// opt: { width, height }（既定は 1172×440）
// - down（既定）：上に root、その下に子を横に並べ、孫は子の下に縦に積む（横幅を使い切らないため）。
// - right：左に root、右へ子・孫と広げる。孫が多い分類の木に向く。
// - 線は矢印にせず、縦横の線を直角に折れる線でつなぐ（tree だけの例外。ほかの図は半径 8 で丸める）。箱は白地に枠、highlight の箱は primary の塗りに白文字。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { root: R, children: [{ label: R, children: optional([{ label: R, children: O }]) }], direction: O, highlight: O };

export default function tree(data, opt = {}) {
  check("tree", data, schema);
  const LN = LINE;
  const W = opt.width ?? 1172, H = opt.height ?? 440;
  const root = { label: typeof data.root === "string" ? data.root : data.root.label, children: data.children };
  const depthCheck = (n, depth) => {
    const c = n.children ?? [];
    if (depth >= 2 && c.length) throw new Error("tree: 3階層まで");
    if (c.length > 5) throw new Error(`tree: ${n.label} の子は5まで`);
    c.forEach((k) => depthCheck(k, depth + 1));
  };
  depthCheck(root, 0);
  if (!root.children.length) throw new Error("tree: children が空");
  const hi = new Set(data.highlight ?? []);
  const box = (n, x, y, w, h, small) => {
    const look = hi.has(n.label) ? "bg-primary text-on-primary border-primary" : `bg-canvas text-ink ${LN.border}`;
    return `<div class="absolute flex items-center justify-center rounded-panel border-2 px-[8px] text-center font-bold ${small ? "text-body" : "text-heading"} ${look}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${esc(n.label)}</div>`;
  };
  const line = (pts) => `<path class="fill-none ${LN.stroke}" stroke-width="2" stroke-linejoin="round" d="${rounded(pts, 0)}"/>`;
  const boxes = [], lines = [];

  if (data.direction === "right") {
    // 葉を上から順に並べ、親は子の真ん中に置く
    const depth = root.children.some((c) => c.children?.length) ? 3 : 2;
    const colW = W / depth, bw = Math.min(260, colW - 64);
    const leaves = [];
    const walk = (n, d) => ((n.children ?? []).length ? n.children.forEach((c) => walk(c, d + 1)) : leaves.push(n));
    walk(root, 0);
    // 葉どうしの間は gap、親が変わるところはさらに group だけ空ける
    const parentOf = new Map();
    const link = (n) => (n.children ?? []).forEach((k) => (parentOf.set(k, n), link(k)));
    link(root);
    const gap = 20, group = 16;
    const breaks = leaves.filter((l, i) => i && parentOf.get(l) !== parentOf.get(leaves[i - 1])).length;
    const bh = Math.min(48, (H - gap * (leaves.length - 1) - group * breaks) / leaves.length);
    const leafY = new Map();
    let y = 0;
    leaves.forEach((l, i) => {
      if (i) y += gap + (parentOf.get(l) !== parentOf.get(leaves[i - 1]) ? group : 0);
      leafY.set(l, y + bh / 2);
      y += bh;
    });
    const top = (H - y) / 2; // 全体を縦の中央に置く
    const P = new Map();
    const place = (n, d) => {
      const c = n.children ?? [];
      c.forEach((k) => place(k, d + 1));
      const cy = c.length ? (P.get(c[0]).cy + P.get(c.at(-1)).cy) / 2 : top + leafY.get(n);
      P.set(n, { x: d * colW, y: cy - bh / 2, cy });
    };
    place(root, 0);
    for (const [n, p] of P) {
      boxes.push(box(n, p.x, p.y, bw, bh, bh < 48));
      const kids = n.children ?? [];
      if (!kids.length) continue;
      // 親から分かれ目までの線は1本だけ引き、そこから子ごとに折れ線を引く（分かれ目に丸みの重なりを作らない）
      const sx = p.x + bw, mx = sx + (P.get(kids[0]).x - sx) / 2;
      lines.push(line([[sx, p.cy], [mx, p.cy]]));
      for (const k of kids) {
        const q = P.get(k);
        lines.push(line([[mx, p.cy], [mx, q.cy], [q.x, q.cy]]));
      }
    }
  } else {
    // 上に root、2段目を横に並べ、孫は子の下に縦に積む
    const C = root.children, n = C.length;
    const rw = 280, rh = 56, y2 = rh + 48, h2 = 56;
    const cw = W / n, bw = Math.min(240, cw - 32);
    const rx = (W - rw) / 2;
    boxes.push(box(root, rx, 0, rw, rh));
    const busY = rh + 24;
    lines.push(line([[W / 2, rh], [W / 2, busY]])); // root から分かれ目までは1本
    C.forEach((c, i) => {
      const x = i * cw + (cw - bw) / 2, cx = x + bw / 2;
      boxes.push(box(c, x, y2, bw, h2));
      lines.push(line([[W / 2, busY], [cx, busY], [cx, y2]]));
      const g = c.children ?? [];
      // 孫どうしの間は 20（入りきらないときだけ詰める）
      const gh = 40, start = y2 + h2 + 20, gx = x + 28, gw = bw - 28;
      const gap = g.length > 1 ? Math.min(20, (H - start - g.length * gh) / (g.length - 1)) : 0;
      g.forEach((k, j) => {
        const gy = start + j * (gh + gap);
        if (gap < 8 || gy + gh > H + 0.5) throw new Error("tree: 孫が多すぎて収まらない（direction: right を使う）");
        boxes.push(box(k, gx, gy, gw, gh, true));
        lines.push(line([[x + 14, y2 + h2], [x + 14, gy + gh / 2], [gx, gy + gh / 2]]));
      });
    });
  }
  return `<div class="relative mx-auto" style="width:${W}px;height:${H}px" data-kind="tree">
<svg data-origin="generated" class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${lines.join("")}</svg>
${boxes.join("")}
</div>`;
}
