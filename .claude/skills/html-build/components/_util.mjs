// 部品で共通に使う小さな関数。
// 部品は「データを受け取り HTML の文字列を返す」関数にする。
// Tailwind はソースの文字列からクラス名を拾うため、クラス名は組み立てずに完全な形で書く。

/** HTML に埋め込む文字を安全にする */
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 文中の書き方を HTML にする：**語句** → 太字（components.md 4.2）、`コード` → 文中のコード（4.3）。コードの中の ** は太字にしない */
export const inline = (s) =>
  String(s ?? "")
    .split(/(`[^`]+`)/)
    .map((p, i) => (i % 2 ? `<code>${esc(p.slice(1, -1))}</code>` : esc(p).replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')))
    .join("");

/** 数値を3桁区切りにする。数値でなければそのまま返す */
export const num = (v) => (typeof v === "number" ? v.toLocaleString("ja-JP") : esc(v));

// ---- data の決まり（各部品の schema）----
// 項目の名前に、決まりを書く。R：必須、O：任意（中身は部品が確かめる）。
// [決まり]：並び（各要素をその決まりで確かめる）。{ … }：まとまり。どちらも optional(…) で任意にする。
// 書式チェックは部品を呼んで確かめるので、ここで知らない項目（書き間違い）もエラーにする。
export const R = { req: true },
  O = { req: false };
export const optional = (spec) => ({ req: false, spec });
const norm = (spec) => {
  if (spec === R || spec === O) return spec;
  if (spec.spec !== undefined) return { ...norm(spec.spec), req: false };
  if (Array.isArray(spec)) return { req: true, list: norm(spec[0]) };
  return { req: true, keys: spec };
};
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** data が schema に合うかを確かめ、合わなければ止める（必須の項目がない、知らない項目がある、形が違う） */
export function check(kind, data, schema, where = "") {
  if (!isObj(data)) throw new Error(`${kind}: ${where || "data"} は { 項目: 値 } の形にする`);
  for (const k of Object.keys(data)) if (!(k in schema)) throw new Error(`${kind}: 知らない項目 ${where}${k}（書けるもの：${Object.keys(schema).join("・")}）`);
  for (const [k, spec] of Object.entries(schema)) {
    const v = data[k],
      n = norm(spec),
      at = `${where}${k}`;
    if (v === undefined || v === null) {
      if (n.req) throw new Error(`${kind}: 必須の項目 ${at} がない`);
      continue;
    }
    if (n.keys) {
      if (!isObj(v)) throw new Error(`${kind}: ${at} は { ${Object.keys(n.keys).join(", ")} } の形にする`);
      check(kind, v, n.keys, `${at}.`);
    }
    if (n.list) {
      if (!Array.isArray(v)) throw new Error(`${kind}: ${at} は並び（- で始まる行）にする`);
      if (n.list.keys) v.forEach((x, i) => check(kind, x, n.list.keys, `${at}[${i + 1}].`));
    }
  }
}

/** schema を人が読める1行にする（schema.mjs と書式チェックの説明に使う） */
export function describe(schema) {
  const one = (n) => (n.keys ? `{ ${describe(n.keys)} }` : n.list ? `[${one(n.list)}]` : "");
  return Object.entries(schema)
    .map(([k, spec]) => {
      const n = norm(spec),
        d = one(n);
      return `${k}${n.req ? "" : "?"}${d ? `: ${d}` : ""}`;
    })
    .join(", ");
}

/** 強調表示（outline.md に書いた値をそのまま出す。部品は計算しない） */
export const callout = (c) =>
  c
    ? `<div class="flex w-[240px] shrink-0 flex-col justify-center gap-[8px] border-l-[4px] border-primary pl-[24px]">
  <div class="text-kpi font-bold text-primary">${esc(c.value)}</div>
  <div class="text-body text-label">${esc(c.label)}</div>
</div>`
    : "";

/** 単位の表示（図の左上） */
export const unitLabel = (unit) => (unit ? `<div class="text-caption text-label">単位：${esc(unit)}</div>` : "");

// ---- 複数の系列の色（多くて5つ。charts.md 4章）----
// 1つの色相（青）の濃淡を基本にし、5つ目は灰色。クラス名は Tailwind が拾えるよう完全な形で書く。
// on は、その色の面の上に数値を書くときの文字色（白地との差が小さい淡い色には黒い文字）。
export const SERIES = [
  { bg: "bg-blue-900", fill: "fill-blue-900", stroke: "stroke-blue-900", text: "text-blue-900", on: "text-on-primary", onFill: "fill-on-primary" },
  { bg: "bg-blue-600", fill: "fill-blue-600", stroke: "stroke-blue-600", text: "text-blue-600", on: "text-on-primary", onFill: "fill-on-primary" },
  { bg: "bg-blue-400", fill: "fill-blue-400", stroke: "stroke-blue-400", text: "text-blue-900", on: "text-ink", onFill: "fill-ink" },
  { bg: "bg-blue-200", fill: "fill-blue-200", stroke: "stroke-blue-200", text: "text-blue-900", on: "text-ink", onFill: "fill-ink" },
  { bg: "bg-gray-400", fill: "fill-gray-400", stroke: "stroke-gray-400", text: "text-gray-800", on: "text-ink", onFill: "fill-ink" },
];

// 折れ線の印の形（色だけで区別しないため。colors.md 4章）
export const marker = (shape, x, y, cls) => {
  const r = 5;
  if (shape === 1) return `<rect class="${cls}" x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}"/>`;
  if (shape === 2) return `<path class="${cls}" d="M${x},${y - r - 1}L${x + r + 1},${y + r}L${x - r - 1},${y + r}Z"/>`;
  if (shape === 3) return `<path class="${cls}" d="M${x},${y - r - 1}L${x + r + 1},${y}L${x},${y + r + 1}L${x - r - 1},${y}Z"/>`;
  return `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
};

/** SVG の大きさ。置く枠の大きさを親（スライドの型）から受け取る。callout があればその分だけ狭くする */
export const svgSize = (data, opt = {}) => {
  const w = (opt.width ?? 1172) - (data.callout ? 272 : 0);
  const h = opt.height ?? 440;
  return { w, h };
};

// ---- 箱の枠と矢印の色（構造・概念の図で共通）。Light Blue 1200 #00234B ----
export const LINE = { border: "border-lightblue-1200", stroke: "stroke-lightblue-1200", fill: "fill-lightblue-1200", bg: "bg-lightblue-1200" };

/** 折れ線（点の並び）を SVG の path にする。角は半径 r で丸める（前後の線の半分より大きくはしない）。flowchart・tree で共通 */
export function rounded(p, r = 8) {
  const f = (n) => n.toFixed(1);
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [x0, y0] = p[i - 1],
      [x1, y1] = p[i],
      [x2, y2] = p[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0),
      l2 = Math.hypot(x2 - x1, y2 - y1);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (k <= 0) {
      d += `L${f(x1)},${f(y1)}`;
      continue;
    }
    const ax = x1 - ((x1 - x0) / l1) * k,
      ay = y1 - ((y1 - y0) / l1) * k;
    const bx = x1 + ((x2 - x1) / l2) * k,
      by = y1 + ((y2 - y1) / l2) * k;
    d += `L${f(ax)},${f(ay)}Q${f(x1)},${f(y1)} ${f(bx)},${f(by)}`;
  }
  const [lx, ly] = p.at(-1);
  return d + `L${f(lx)},${f(ly)}`;
}

// ---- 量の大小を青の濃淡で示す色（heatmap・map で共通）----
// 薄い方から5段階。濃い2段は白い文字。
export const SEQ = [
  { bg: "bg-blue-50", fill: "fill-blue-50", text: "text-ink" },
  { bg: "bg-blue-200", fill: "fill-blue-200", text: "text-ink" },
  { bg: "bg-blue-400", fill: "fill-blue-400", text: "text-ink" },
  { bg: "bg-blue-600", fill: "fill-blue-600", text: "text-on-primary" },
  { bg: "bg-blue-900", fill: "fill-blue-900", text: "text-on-primary" },
];
const PICK = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };

/** 値の並びを、最小から最大まで等しい幅で n 段階に分ける。shades（色）、step（値→段階）、legend（凡例の項目の HTML）を返す */
export function seqStep(values, n = 5) {
  if (!PICK[n]) throw new Error("steps は3〜5");
  const shades = PICK[n].map((i) => SEQ[i]);
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const w = (hi - lo) / n || 1;
  const step = (v) => Math.min(n - 1, Math.floor((v - lo) / w));
  const legend = shades
    .map((s, k) => {
      const a = lo + w * k,
        b = k === n - 1 ? hi : lo + w * (k + 1);
      return `<div class="flex items-center gap-[6px]"><span class="inline-block h-[16px] w-[24px] border border-line ${s.bg}"></span><span class="text-caption text-label">${num(Math.round(a))}〜${num(Math.round(b))}</span></div>`;
    })
    .join("");
  return { shades, step, legend };
}
