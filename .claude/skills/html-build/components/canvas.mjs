import { esc, check, R, O, LINE, rounded } from "./_util.mjs";
import { loadAsset, inlineSvg } from "./_asset.mjs";

// canvas：自由図。一覧の型では idea の絵が描けないとき（match が「意味が欠ける」「描けない」）に、形を格子の上に並べて描く。
// 座標は px ではなく格子のマス目で書く（枠を grid の列×行に分ける）。色は役割（tone）で書き、部品が theme.css のトークンに直す。
//
// data: { grid?: [列, 行]（既定 [12, 6]）, shapes: [形] }
// 形（type ごとに使う項目）：
//   area    … 囲み。at（左上）・size（幅, 高さ）・text?（左上の見出し）・icon?（見出しの左の小さなアイコン）
//              tone?（plain＝点線の枠／soft＝淡い青の面／focus＝青の点線で注目させる／card＝実線の枠の白いカード。既定 plain）
//   frame   … 画面の枠。at・size・shape?（browser／phone。既定 browser）・text?（browser はアドレスの欄、phone は上の帯の文字）
//              中身は、ほかの形を枠の上に重ねて描く（枠は囲みと同じく、いちばん下に描く）
//   box     … 箱。at（左上）・size?（既定 [2, 1]）・text・caption?（箱の下の説明）・icon?（文字の左の小さなアイコン）
//              tone?（plain＝白地に枠／primary＝青地に白い文字／soft＝淡い青の地／muted＝灰色。既定 plain）
//              shape?（rect／pill／cylinder＝データベース／document＝書類（角の折れと罫線）／stack＝重なった束。既定 rect）
//              align?（center＝形の中／above＝形の上／below＝形の下。文字を書く場所。既定 center）
//              text_size?（body＝16px／heading＝20px。書かなければ、図の中の箱と chevron で1つにそろえる：
//              形の中に字を書く箱がすべて高さ56px以上・幅160px以上なら heading、そうでなければ body）
//              箱の高さは、格子の1行が許す範囲で、字の大きさに合わせた最小の高さ（body 64px・heading 72px）まで広げる
//   chevron … 太い矢印の形の箱（工程）。at・size?（既定 [2, 1]）・text・tone?・text_size?（box と同じ）
//   dot     … 点。at（中心）・text?（点の横の文字）・align?（right／left／above／below。既定 below）・tone?（ink／primary／muted。既定 ink）
//   badge   … 番号の丸。text（数字や1〜2字）・tone?（primary／ink／muted。既定 primary）・size?（small＝直径24px。既定は32px）
//              置き方は3つ：on（形の id）と corner（tl／tr／bl／br。既定 tl）で、形の外に角と端をそろえて置く。
//              on と inside: true で、形の中の左（corner が tr・br なら右）に、縦は中央にそろえ、端から一定のすき間で置く
//              （形の文字は番号の分だけ内側に寄る）。または at（中心）で自由に置く
//   line    … 線。from・to（形の id か [x, y]）・via?（曲がる点の並び [[x, y], …]）・curve?（true で via を通る曲線）
//              arrow?（end／both／none。既定 end）・dash?（true で点線）・tone?（ink／primary／muted）・text?（線の途中の文字）
//   brace   … 中括弧。from・to（[x, y]。縦か横にまっすぐ）・text?（括弧の外の文字）・align?（括弧の向き：right／left／above／below。既定 right）
//   note    … 吹き出し（白地に枠）。at（左上）・size?（既定 [3, 1]）・text・to?（指す先の [x, y] か id）
//   text    … 文字だけ。at（左上）・size?（幅, 高さ。既定 [3, 1]）・text・style?（heading／body／caption／kpi。既定 body）
//              align?（left／center／right。既定 left）・tone?（ink／primary／muted）
//   icon    … アイコンだけを大きく置く（64px）。at（中心）・icon（phosphor:<名前>）・tone?（ink／navy／muted／white。既定 ink）
//   arrow   … 太い矢印（塗った面の小さな矢印。44px の正方形に収まる）。近くの形の間に置いてつなぐ。
//              at（中心）・direction?（right／left／up／down。既定 right）・tone?（ink／primary／muted。既定 ink）
//   chart   … ほかの図の部品（bar・line・donut など）を、格子の範囲に入れる。at・size・chart（{ kind, …その部品のデータ }）
//              ほかの形と組み合わせて1つの図にするときに使う（canvas の中に canvas は入れない）
//   cubes   … 立方体の並び（リスト・行列）。at・size・count（[列, 行]。1行ならリスト）・filled?（色を付ける立方体の並び：数なら
//              その列ぜんぶ、[列, 行] ならその1つ。どちらも 1 から数える）・text?（正面の文字の並び。左上から順に）
//              labels?（番号などの文字の並び。行が2つ以上なら各行の左、1行なら各列の下）
//              tone?（primary／navy。既定 primary）・dash?（true で点線の空の立方体。ないことを表す）
//   plot    … 小さな折れ線のグラフ（ほかの形と組み合わせる図の中で使う）。at・size・values（数の並び。null は欠け）
//              labels?（横軸の文字。values と同じ順で、"" は書かない）・max?（縦軸の上限。既定は values から決める）・text?（縦軸の名前）
//   ring    … 注目の丸（点や数値を囲む）。on（plot の id）と point（何番目の値か。1 から）か、at（中心）・tone?（error／primary。既定 error）
//              ring に id を付けると、line や note の相手にできる（吹き出しや箱から、グラフの点へ線を引く）
//   people  … 人の数の絵。at・size・count（人の数。1〜100）・filled?（色を付ける人の数）・text?（下に添える文字）・tone?（primary／navy。既定 primary）
// - アイコンの大きさは2つだけ：単体（icon）は 64px、文字の横（box・area の icon）は 24px。色は黒・紺・灰色・白だけ
//   （箱の中のアイコンは文字と同じ色）。
// - 線は、相手が箱や点なら、その縁で止まる（中心どうしを結ぶ向きで、via があれば最初と最後の曲がる点に向けて）。
// - 形はすべて格子の中に収める（はみ出すとエラー）。1つの図に形は40まで。
// opt: { width, height, deck }（置く枠の大きさ。既定は 1172×440）

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意。type ごとの項目は部品が確かめる）
export const schema = {
  grid: O,
  shapes: [
    {
      type: R,
      id: O,
      at: O,
      size: O,
      text: O,
      caption: O,
      icon: O,
      tone: O,
      shape: O,
      align: O,
      style: O,
      from: O,
      to: O,
      via: O,
      curve: O,
      arrow: O,
      dash: O,
      on: O,
      corner: O,
      inside: O,
      count: O,
      filled: O,
      chart: O,
      direction: O,
      values: O,
      labels: O,
      max: O,
      point: O,
      text_size: O,
    },
  ],
};

export const FIELDS = {
  area: { req: ["at", "size"], opt: ["text", "icon", "tone", "id"] },
  frame: { req: ["at", "size"], opt: ["shape", "text", "id"] },
  box: { req: ["at", "text"], opt: ["size", "caption", "icon", "tone", "shape", "align", "text_size", "id"] },
  chevron: { req: ["at", "text"], opt: ["size", "tone", "text_size", "id"] },
  dot: { req: ["at"], opt: ["text", "align", "tone", "id"] },
  badge: { req: ["text"], opt: ["at", "on", "corner", "inside", "tone", "size", "id"] },
  line: { req: ["from", "to"], opt: ["via", "curve", "arrow", "dash", "tone", "text"] },
  brace: { req: ["from", "to"], opt: ["text", "align"] },
  note: { req: ["at", "text"], opt: ["size", "to", "id"] },
  text: { req: ["at", "text"], opt: ["size", "style", "align", "tone", "id"] },
  icon: { req: ["at", "icon"], opt: ["tone", "id"] },
  people: { req: ["at", "size", "count"], opt: ["filled", "text", "tone", "id"] },
  arrow: { req: ["at"], opt: ["direction", "tone", "id"] },
  chart: { req: ["at", "size", "chart"], opt: ["id"] },
  cubes: { req: ["at", "size", "count"], opt: ["filled", "text", "labels", "tone", "dash", "id"] },
  plot: { req: ["at", "size", "values"], opt: ["labels", "max", "text", "id"] },
  ring: { req: [], opt: ["at", "on", "point", "tone", "id"] },
};
const TONES = {
  area: ["plain", "soft", "focus", "card"],
  box: ["plain", "primary", "soft", "muted"],
  chevron: ["plain", "primary", "soft", "muted"],
  dot: ["ink", "primary", "muted"],
  badge: ["primary", "ink", "muted"],
  line: ["ink", "primary", "muted"],
  text: ["ink", "primary", "muted"],
  icon: ["ink", "navy", "muted", "white"],
  people: ["primary", "navy"],
  arrow: ["ink", "primary", "muted"],
  cubes: ["primary", "navy"],
  ring: ["error", "primary"],
};
const SHAPES = { box: ["rect", "pill", "cylinder", "document", "stack"], frame: ["browser", "phone"] };
const SIDES = ["right", "left", "above", "below"];
const CORNERS = ["tl", "tr", "bl", "br"];
// 線・点・文字の色（クラス名は Tailwind が拾えるよう完全な形で書く）
const INK = {
  ink: { stroke: LINE.stroke, fill: LINE.fill, text: "text-ink" },
  primary: { stroke: "stroke-primary", fill: "fill-primary", text: "text-primary" },
  muted: { stroke: "stroke-gray-400", fill: "fill-gray-400", text: "text-label" },
};
// アイコンの色：黒・紺・灰色・白だけ
const ICON_TEXT = { ink: "text-ink", navy: "text-lightblue-1200", muted: "text-label", white: "text-on-primary" };
// 箱の色：HTML の箱（rect・pill）と、SVG で描く形（cylinder・書類・stack・chevron）
const BOX = {
  plain: { div: `bg-canvas text-ink ${LINE.border}`, fill: "fill-canvas", stroke: LINE.stroke, text: "text-ink", rule: "stroke-line" },
  primary: {
    div: "bg-primary text-on-primary border-primary",
    fill: "fill-primary",
    stroke: "stroke-primary",
    text: "text-on-primary",
    rule: "stroke-blue-400",
  },
  soft: { div: `bg-highlight text-ink ${LINE.border}`, fill: "fill-highlight", stroke: LINE.stroke, text: "text-ink", rule: "stroke-blue-200" },
  muted: { div: "bg-panel text-label border-gray-400", fill: "fill-panel", stroke: "stroke-gray-400", text: "text-label", rule: "stroke-line" },
};
// 色を付ける人
const MARK = {
  primary: { fill: "fill-primary", bg: "bg-primary", stroke: "stroke-primary", text: "text-on-primary" },
  navy: { fill: LINE.fill, bg: LINE.bg, stroke: LINE.stroke, text: "text-on-primary" },
};
// 箱の字の大きさ（text_size）と、その字のときの箱の最小の高さ
const TEXT_SIZE = { body: { cls: "text-body", minH: 64 }, heading: { cls: "text-heading", minH: 72 } };
const STYLE = { heading: "text-heading font-bold", body: "text-body", caption: "text-caption", kpi: "text-kpi font-bold" };
const ALIGN = { left: "justify-start text-left", center: "justify-center text-center", right: "justify-end text-right" };
const DOT_R = 12,
  ICON_BIG = 64,
  ICON_SMALL = 24,
  BADGE = 32,
  BADGE_S = 24, // badge の size: small
  NB_GAP = 12, // 形の中の番号の丸と、形の端のすき間
  ARROW = 44, // 面の矢印の大きさ（正方形の辺）
  RING = 18, // 注目の丸の半径
  TAIL = 32, // 吹き出しのしっぽの長さの上限
  LABEL_H = 36, // 形の上・下に書く文字の高さ
  PAD = 8; // 箱と格子の線のすき間
const badgeD = (s) => (s.size === "small" ? BADGE_S : BADGE); // 番号の丸の直径
const badgeText = (s) => (s.size === "small" ? "text-caption" : "text-body");
const f1 = (v) => v.toFixed(1);
// 縦軸の上限：最大の値を、1・2・2.5・5・10 × 10^n のどれかに切り上げる
const niceMax = (v) => {
  if (v <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * e).find((m) => m >= v);
};
const pts = (list) => list.map(([a, b]) => `${f1(a)},${f1(b)}`).join(" ");

// 角を折った紙の輪郭（d）と折り目（fold）。k は折れの大きさ
const page = (x, y, w, h, k) => ({
  d: `M${f1(x)},${f1(y)}H${f1(x + w - k)}L${f1(x + w)},${f1(y + k)}V${f1(y + h)}H${f1(x)}Z`,
  fold: `M${f1(x + w - k)},${f1(y)}V${f1(y + k)}H${f1(x + w)}`,
});

// n 個のものを幅 w・高さ h に並べるとき、1つの大きさ（u。縦は u×ratio）が最大になる列の数
function arrange(n, w, h, ratio, max) {
  let best = { cols: 1, u: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const u = Math.min(w / cols, h / (Math.ceil(n / cols) * ratio), max);
    if (u > best.u + 0.01) best = { cols, u };
  }
  return { ...best, rows: Math.ceil(n / best.cols) };
}

/** shapes の chart に書いた図の型（先に読み込んでおき、opt.comps で渡す） */
export const chartKinds = (data) => [...new Set((data?.shapes ?? []).filter((s) => s?.type === "chart" && s.chart?.kind).map((s) => s.chart.kind))];

export default function canvas(data, opt = {}) {
  check("canvas", data, schema);
  const [cols, rows] = data.grid ?? [12, 6];
  if (![cols, rows].every((n) => Number.isInteger(n) && n >= 2 && n <= 24)) throw new Error("canvas: grid は [列, 行] の形で、どちらも2〜24の整数");
  const S = data.shapes;
  if (S.length < 1 || S.length > 40) throw new Error("canvas: shapes は1〜40");
  const W = opt.width ?? 1172,
    H = opt.height ?? 440;
  const cw = W / cols,
    ch = H / rows;
  const px = ([x, y]) => [x * cw, y * ch];
  const icon = (s, size) => inlineSvg(loadAsset("canvas", s.icon, opt.deck), s.icon, size);

  // 項目と範囲を確かめる
  const ids = {};
  const pair = (v, what, i) => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number"))
      throw new Error(`canvas: shapes[${i + 1}] の ${what} は [x, y] の形の数にする`);
    return v;
  };
  const inside = ([x, y], [w, h], i) => {
    if (x < 0 || y < 0 || x + w > cols || y + h > rows) throw new Error(`canvas: shapes[${i + 1}] が格子（${cols}×${rows}）の外に出ている`);
  };
  const oneOf = (s, k, list, i) => {
    if (s[k] !== undefined && !list.includes(s[k])) throw new Error(`canvas: shapes[${i + 1}] の ${k} は ${list.join("・")} のどれか`);
  };
  const int = (v, lo, hi, what, i) => {
    if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`canvas: shapes[${i + 1}] の ${what} は ${lo}〜${hi} の整数`);
  };
  S.forEach((s, i) => {
    const F = FIELDS[s.type];
    if (!F) throw new Error(`canvas: shapes[${i + 1}] の type「${s.type}」は ${Object.keys(FIELDS).join("・")} のどれか`);
    for (const k of F.req)
      if (s[k] === undefined || s[k] === null || s[k] === "") throw new Error(`canvas: shapes[${i + 1}]（${s.type}）に必須の項目 ${k} がない`);
    for (const k of Object.keys(s))
      if (k !== "type" && !F.req.includes(k) && !F.opt.includes(k))
        throw new Error(`canvas: shapes[${i + 1}]（${s.type}）に ${k} は書けない（書けるもの：${[...F.req, ...F.opt].join("・")}）`);
    if (TONES[s.type]) oneOf(s, "tone", TONES[s.type], i);
    if (SHAPES[s.type]) oneOf(s, "shape", SHAPES[s.type], i);
    if (s.at) pair(s.at, "at", i);
    if (s.size && s.type !== "badge" && pair(s.size, "size", i).some((n) => n <= 0)) throw new Error(`canvas: shapes[${i + 1}] の size は正の数にする`);
    // 線・括弧・吹き出しの先の [x, y]（id で指すものは除く）も格子の中に置く
    for (const k of ["from", "to"]) if (["line", "brace", "note"].includes(s.type) && Array.isArray(s[k])) inside(pair(s[k], k, i), [0, 0], i);
    if (s.type === "line") for (const p of s.via ?? []) inside(pair(p, "via の点", i), [0, 0], i);
    if (!["dot", "icon", "badge", "line", "brace", "ring", "arrow"].includes(s.type))
      inside(s.at, s.size ?? (["text", "note"].includes(s.type) ? [3, 1] : [2, 1]), i);
    if (["dot", "icon"].includes(s.type) || (s.type === "badge" && s.at)) inside(s.at, [0, 0], i);
    if (s.type === "box") oneOf(s, "align", ["center", "above", "below"], i);
    if (s.type === "dot" || s.type === "brace") oneOf(s, "align", SIDES, i);
    if (s.type === "text") oneOf(s, "style", Object.keys(STYLE), i), oneOf(s, "align", Object.keys(ALIGN), i);
    if (s.type === "line") oneOf(s, "arrow", ["end", "both", "none"], i);
    if (s.type === "box" || s.type === "chevron") oneOf(s, "text_size", Object.keys(TEXT_SIZE), i);
    if (s.type === "badge") {
      oneOf(s, "size", ["small"], i);
      if (!s.at === !s.on) throw new Error(`canvas: shapes[${i + 1}] の badge は、at か on のどちらか1つで置く`);
      if (s.at && (s.corner !== undefined || s.inside !== undefined)) throw new Error(`canvas: shapes[${i + 1}] の corner・inside は on と一緒に書く`);
      oneOf(s, "corner", CORNERS, i);
      if (s.inside !== undefined && s.inside !== true) throw new Error(`canvas: shapes[${i + 1}] の inside は true だけ書ける`);
    }
    if (s.type === "arrow") oneOf(s, "direction", ["right", "left", "up", "down"], i), inside(s.at, [0, 0], i);
    if (s.type === "chart") {
      if (!s.chart || typeof s.chart !== "object" || !s.chart.kind)
        throw new Error(`canvas: shapes[${i + 1}] の chart は { kind: 図の型, …データ } の形にする`);
      if (s.chart.kind === "canvas") throw new Error(`canvas: shapes[${i + 1}] の chart に canvas は入れられない`);
      if (!opt.comps?.[s.chart.kind]) throw new Error(`canvas: shapes[${i + 1}] の chart の図の型「${s.chart.kind}」を読み込めていない`);
    }
    if (s.type === "cubes") {
      pair(s.count, "count", i);
      s.count.forEach((n) => int(n, 1, 24, "count の列・行", i));
      if (s.filled !== undefined && !Array.isArray(s.filled))
        throw new Error(`canvas: shapes[${i + 1}] の cubes の filled は並びで書く（列なら [2]、1つなら [[2, 1]]）`);
      for (const f of s.filled ?? [])
        if (typeof f === "number") int(f, 1, s.count[0], "filled の列", i);
        else pair(f, "filled の [列, 行]", i), int(f[0], 1, s.count[0], "filled の列", i), int(f[1], 1, s.count[1], "filled の行", i);
      if (s.text !== undefined && (!Array.isArray(s.text) || s.text.length > s.count[0] * s.count[1]))
        throw new Error(`canvas: shapes[${i + 1}] の cubes の text は、立方体の数（${s.count[0] * s.count[1]}）までの文字の並び`);
      if (s.labels !== undefined && (!Array.isArray(s.labels) || s.labels.length !== (s.count[1] > 1 ? s.count[1] : s.count[0])))
        throw new Error(`canvas: shapes[${i + 1}] の cubes の labels は、行が2つ以上なら行の数、1行なら列の数だけ書く`);
    }
    if (s.type === "plot") {
      if (!Array.isArray(s.values) || s.values.length < 2 || s.values.length > 100 || !s.values.every((v) => v === null || typeof v === "number"))
        throw new Error(`canvas: shapes[${i + 1}] の plot の values は2〜100個の数の並び（欠けは null）`);
      if (s.labels !== undefined && (!Array.isArray(s.labels) || s.labels.length > s.values.length))
        throw new Error(`canvas: shapes[${i + 1}] の plot の labels は、values までの数の文字の並び`);
      if (s.max !== undefined && !(typeof s.max === "number" && s.max > 0)) throw new Error(`canvas: shapes[${i + 1}] の plot の max は正の数`);
    }
    if (s.type === "ring" && !s.at === !s.on) throw new Error(`canvas: shapes[${i + 1}] の ring は、at か on（と point）のどちらかで置く`);
    if (s.type === "ring" && s.at) inside(s.at, [0, 0], i);
    if (s.type === "people") {
      int(s.count, 1, 100, "count", i);
      if (s.filled !== undefined) int(s.filled, 0, s.count, "filled", i);
    }
    if (s.type === "brace") {
      const [a, b] = [pair(s.from, "from", i), pair(s.to, "to", i)];
      if (a[0] !== b[0] && a[1] !== b[1]) throw new Error(`canvas: shapes[${i + 1}] の brace は縦か横にまっすぐ（from と to の x か y をそろえる）`);
    }
    if (s.id !== undefined) {
      if (ids[s.id]) throw new Error(`canvas: id「${s.id}」が2回使われている`);
      ids[s.id] = s;
    }
  });

  // 形の中に置く番号の丸（形の id → 番号の丸）。箱を描くときに一緒に描く
  const inner = {};
  S.forEach((s, i) => {
    if (s.type !== "badge" || !s.inside) return;
    const t = ids[s.on];
    if (!t || !["box", "chevron"].includes(t.type)) throw new Error(`canvas: shapes[${i + 1}] の inside は、箱（box・chevron）の id を on に書く`);
    if (inner[s.on]) throw new Error(`canvas: shapes[${i + 1}]：形「${s.on}」の中の番号の丸は1つまで`);
    inner[s.on] = { ...s, i };
  });

  // 小さな折れ線のグラフの寸法と点の位置
  const plotFrame = (s) => {
    const [x, y] = px(s.at),
      [w, h] = px(s.size);
    const top = y + (s.text ? 28 : 8),
      left = x + 48,
      bottom = y + h - (s.labels ? 28 : 8),
      right = x + w - 8;
    const hi = Math.max(...s.values.filter((v) => v !== null), 0);
    const max = s.max ?? niceMax(hi);
    const X = (k) => left + ((right - left) * k) / (s.values.length - 1),
      Y = (v) => bottom - ((bottom - top) * v) / max;
    return { top, left, bottom, right, max, X, Y };
  };
  const ringAt = (s) => {
    if (s.at) return px(s.at);
    const t = ids[s.on];
    if (!t || t.type !== "plot") throw new Error(`canvas: ring の on「${s.on}」は plot の id にする`);
    if (!Number.isInteger(s.point) || s.point < 1 || s.point > t.values.length || t.values[s.point - 1] === null)
      throw new Error(`canvas: ring の point は 1〜${t.values.length} の、値のある番号`);
    const g = plotFrame(t);
    return [g.X(s.point - 1), g.Y(t.values[s.point - 1])];
  };

  // 形の見えている範囲（px の [x, y, w, h]）。箱は格子の線から PAD だけ内側で、上・下に文字を書くときはその分を除く
  // 箱と chevron の字の大きさ。書かなければ、形の中に字を書くものすべてで1つにそろえる
  const inText = S.filter((s) => (s.type === "box" || s.type === "chevron") && s.align !== "above" && s.align !== "below");
  const fitsHeading = inText.every((s) => {
    const [w, h] = px(s.size ?? [2, 1]);
    return h - 2 * PAD >= 56 && w - 2 * PAD >= 160;
  });
  const textSize = (s) => s.text_size ?? (fitsHeading ? "heading" : "body");
  const bounds = (s) => {
    if (s.type === "ring") {
      const [x, y] = ringAt(s);
      return [x - RING, y - RING, 2 * RING, 2 * RING];
    }
    if (["dot", "icon", "arrow"].includes(s.type)) {
      const [x, y] = px(s.at),
        r = s.type === "dot" ? DOT_R : s.type === "arrow" ? ARROW / 2 : ICON_BIG / 2;
      return [x - r, y - r, 2 * r, 2 * r];
    }
    const [x, y] = px(s.at),
      [w, h] = px(s.size ?? (["text", "note"].includes(s.type) ? [3, 1] : [2, 1]));
    if (["area", "frame", "text", "people", "cubes", "plot", "chart"].includes(s.type)) return [x, y, w, h];
    const b = [x + PAD, y + PAD, w - 2 * PAD, h - 2 * PAD];
    if ((s.type === "box" || s.type === "chevron") && s.align !== "above" && s.align !== "below") {
      // 1行の字でも窮屈にならないよう、字の大きさに合わせた最小の高さまで広げる（格子の行の高さを超えない）
      const mh = Math.min(TEXT_SIZE[textSize(s)].minH, h);
      if (b[3] < mh) return [b[0], y + (h - mh) / 2, b[2], mh];
    }
    if (s.align === "above") return [b[0], b[1] + LABEL_H, b[2], b[3] - LABEL_H];
    if (s.align === "below") return [b[0], b[1], b[2], b[3] - LABEL_H];
    return b;
  };
  // 番号の丸の中心
  const badgeAt = (s, i) => {
    if (s.at) return px(s.at);
    const t = ids[s.on];
    if (!t) throw new Error(`canvas: shapes[${i + 1}] の badge の on「${s.on}」という id の形がない`);
    const [x, y, w, h] = bounds(t);
    const c = s.corner ?? "tl",
      r = badgeD(s) / 2,
      g = 6;
    const left = c[1] === "l",
      top = c[0] === "t";
    // 外：形の上（下）に置き、左（右）の端を形の角にそろえる
    return [left ? x + r : x + w - r, top ? y - g - r : y + h + g + r];
  };

  // 線の端：相手が箱・点なら、その縁の点にする。toward は線の向かう先（px）
  const center = (s, i) => {
    if (s.type === "badge") return badgeAt(s, i);
    if (s.type === "ring") return ringAt(s);
    const [x, y, w, h] = bounds(s);
    return [x + w / 2, y + h / 2];
  };
  const RADIUS = { dot: DOT_R + 2, icon: ICON_BIG / 2 + 4, ring: RING + 2 };
  const end = (ref, toward, i) => {
    if (Array.isArray(ref)) return px(pair(ref, "from・to", i));
    const s = ids[ref];
    if (!s) throw new Error(`canvas: shapes[${i + 1}] の線の相手「${ref}」という id の形がない`);
    const c = center(s, i);
    const [dx, dy] = [toward[0] - c[0], toward[1] - c[1]];
    if (!dx && !dy) return c;
    const rr = s.type === "badge" ? badgeD(s) / 2 + 2 : RADIUS[s.type];
    if (rr) {
      const l = Math.hypot(dx, dy);
      return [c[0] + (dx / l) * rr, c[1] + (dy / l) * rr];
    }
    const [, , bw, bh] = bounds(s);
    const [w, h] = [bw / 2, bh / 2];
    const k = s.shape === "pill" ? 1 / Math.hypot(dx / w, dy / h) : Math.min(dx ? w / Math.abs(dx) : Infinity, dy ? h / Math.abs(dy) : Infinity);
    return [c[0] + dx * k, c[1] + dy * k];
  };
  const refPoint = (ref, i) => {
    if (Array.isArray(ref)) return px(pair(ref, "from・to", i));
    if (!ids[ref]) throw new Error(`canvas: shapes[${i + 1}] の線の相手「${ref}」という id の形がない`);
    return center(ids[ref], i);
  };
  const head = ([x0, y0], [qx, qy], s = 13) => {
    const ang = Math.atan2(qy - y0, qx - x0);
    return pts([
      [qx, qy],
      [qx - s * Math.cos(ang - 0.5), qy - s * Math.sin(ang - 0.5)],
      [qx - s * Math.cos(ang + 0.5), qy - s * Math.sin(ang + 0.5)],
    ]);
  };
  // 線や括弧に添える文字（白い縁取り）
  const label = (x, y, text, anchor = "middle", baseline = "auto") =>
    `<text class="fill-ink stroke-canvas text-body font-bold" stroke-width="6" paint-order="stroke" x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${esc(text)}</text>`;
  const box = (x, y, w, h, cls, inner, style = "") =>
    `<div class="absolute ${cls}" style="left:${f1(x)}px;top:${f1(y)}px;width:${f1(w)}px;height:${f1(h)}px${style}">${inner}</div>`;

  const back = [],
    svg = [],
    front = [],
    html = [];
  S.forEach((s, i) => {
    const tone = s.tone ?? TONES[s.type]?.[0];
    if (s.type === "area") {
      const [x, y, w, h] = bounds(s);
      const look = {
        plain: "border-dashed border-gray-400",
        soft: "bg-highlight border-transparent",
        focus: "border-dashed border-primary",
        card: `bg-canvas ${LINE.border}`,
      }[tone];
      const head = s.text
        ? `<div class="flex items-center gap-[8px] px-[12px] py-[8px] text-body font-bold ${tone === "focus" ? "text-primary" : tone === "card" ? "text-ink" : "text-label"}">${s.icon ? `<span class="flex">${icon(s, ICON_SMALL)}</span>` : ""}${esc(s.text)}</div>`
        : "";
      back.push(box(x, y, w, h, `rounded-panel border-2 ${look}`, head));
    } else if (s.type === "frame") {
      const [x, y, w, h] = bounds(s);
      if ((s.shape ?? "browser") === "browser") {
        const dots = `<span class="flex gap-[6px]">${'<span class="h-[10px] w-[10px] rounded-full bg-gray-400"></span>'.repeat(3)}</span>`;
        const bar = `<div class="flex h-[40px] items-center gap-[12px] border-b-2 ${LINE.border} bg-panel px-[12px]">${dots}${s.text ? `<span class="flex-1 truncate rounded-full bg-canvas px-[12px] text-caption text-label">${esc(s.text)}</span>` : ""}</div>`;
        back.push(box(x, y, w, h, `overflow-hidden rounded-panel border-2 ${LINE.border} bg-canvas`, bar));
      } else {
        const notch = `<div class="mx-auto mt-[10px] h-[8px] w-[56px] rounded-full bg-gray-400"></div>`;
        const band = s.text
          ? `<div class="mt-[8px] border-y-2 ${LINE.border} bg-panel py-[4px] text-center text-caption font-bold text-ink">${esc(s.text)}</div>`
          : "";
        const home = `<div class="absolute bottom-[8px] left-1/2 h-[5px] w-[64px] -translate-x-1/2 rounded-full bg-gray-400"></div>`;
        back.push(box(x, y, w, h, `overflow-hidden rounded-[28px] border-[3px] ${LINE.border} bg-canvas`, notch + band + home));
      }
    } else if (s.type === "box" || s.type === "chevron") {
      const [x0, y0] = px(s.at),
        [w0, h0] = px(s.size ?? [2, 1]);
      const [x, y, w, h] = bounds(s);
      const c = BOX[tone];
      const shape = s.type === "chevron" ? "chevron" : (s.shape ?? "rect");
      const out = s.align === "above" || s.align === "below";
      const big = out ? "text-body" : TEXT_SIZE[textSize(s)].cls;
      const ic = s.icon ? `<span class="flex shrink-0">${icon(s, ICON_SMALL)}</span>` : "";
      const inside = `${ic}<span>${esc(s.text)}</span>`;
      const st = `class="${c.fill} ${c.stroke}" stroke-width="2" stroke-linejoin="round"`;
      let pad = [0, 0, 0, 0]; // 文字が線に重ならないためのすき間（上・右・下・左）
      const nb = inner[s.id]; // 形の中の番号の丸
      const nbRight = nb && nb.corner?.[1] === "r";
      const nbPad = nb ? `;padding-${nbRight ? "right" : "left"}:${badgeD(nb) + 2 * NB_GAP}px` : "";
      if (shape === "rect" || shape === "pill") {
        html.push(
          box(
            x,
            y,
            w,
            h,
            `flex items-center justify-center gap-[8px] border-2 px-[12px] text-center ${big} font-bold ${shape === "pill" ? "rounded-full" : "rounded-panel"} ${c.div}`,
            out ? "" : inside,
            nbPad,
          ),
        );
        if (shape === "pill") pad = [0, h / 4, 0, h / 4];
      } else {
        if (shape === "cylinder") {
          const e = Math.max(8, Math.min(w * 0.1, h / 5, 28));
          svg.push(
            `<path ${st} d="M${f1(x)},${f1(y + e)}A${f1(w / 2)},${f1(e)} 0 0 1 ${f1(x + w)},${f1(y + e)}V${f1(y + h - e)}A${f1(w / 2)},${f1(e)} 0 0 1 ${f1(x)},${f1(y + h - e)}Z"/><path class="fill-none ${c.stroke}" stroke-width="2" d="M${f1(x)},${f1(y + e)}A${f1(w / 2)},${f1(e)} 0 0 0 ${f1(x + w)},${f1(y + e)}"/>`,
          );
          pad = [2 * e, 0, e, 0];
        } else if (shape === "document") {
          // 角を折った紙に罫線。文字は上、罫線は下
          const k = Math.min(22, w / 5, h / 3),
            p = page(x, y, w, h, k);
          svg.push(`<path ${st} d="${p.d}"/><path class="fill-none ${c.stroke}" stroke-width="2" stroke-linejoin="round" d="${p.fold}"/>`);
          const n = h >= 120 ? 3 : 2,
            top = y + h * (out ? 0.3 : 0.55);
          const gap = (y + h - 14 - top) / n;
          for (let j = 0; j < n; j++) {
            const ly = top + gap * (j + 0.5),
              lw = j === n - 1 ? (w - 32) * 0.6 : w - 32;
            svg.push(`<path class="fill-none ${c.rule}" stroke-width="3" stroke-linecap="round" d="M${f1(x + 16)},${f1(ly)}H${f1(x + 16 + lw)}"/>`);
          }
          pad = [k / 2, 8, h * 0.45, 8];
        } else if (shape === "stack") {
          const o = 8;
          for (const d of [2 * o, o, 0])
            svg.push(`<rect ${st} x="${f1(x + d)}" y="${f1(y + 2 * o - d)}" width="${f1(w - 2 * o)}" height="${f1(h - 2 * o)}" rx="8"/>`);
          pad = [2 * o, 2 * o, 0, 0];
        } else if (shape === "chevron") {
          const k = Math.min(h / 2, 28);
          svg.push(
            `<path ${st} d="M${f1(x)},${f1(y)}H${f1(x + w - k)}L${f1(x + w)},${f1(y + h / 2)}L${f1(x + w - k)},${f1(y + h)}H${f1(x)}L${f1(x + k)},${f1(y + h / 2)}Z"/>`,
          );
          pad = [0, k, 0, k];
        }
        if (!out)
          html.push(
            box(
              x + pad[3],
              y + pad[0],
              w - pad[1] - pad[3],
              h - pad[0] - pad[2],
              `flex items-center justify-center gap-[8px] px-[8px] text-center ${big} font-bold ${c.text}`,
              inside,
              nbPad,
            ),
          );
      }
      if (nb) {
        // 文字の入る範囲の縦の中央に、端から NB_GAP あけて置く
        const [ty, th] = [y + pad[0], h - pad[0] - pad[2]];
        const D = badgeD(nb);
        if (th < D + 8) throw new Error(`canvas: shapes[${nb.i + 1}] の番号の丸が形「${s.id}」に入らない（形の高さを大きくする）`);
        const bx = nbRight ? x + w - pad[1] - NB_GAP - D : x + pad[3] + NB_GAP;
        const bg = {
          primary: tone === "primary" ? "bg-canvas text-primary" : "bg-primary text-on-primary",
          ink: `${LINE.bg} text-on-primary`,
          muted: "bg-gray-400 text-on-primary",
        }[nb.tone ?? "primary"];
        html.push(box(bx, ty + (th - D) / 2, D, D, `flex items-center justify-center rounded-full ${badgeText(nb)} font-bold ${bg}`, esc(nb.text)));
      }
      if (out) {
        // 形の上か下に文字を書く（文字は黒。アイコンも同じ色）
        const ly = s.align === "above" ? y0 + PAD : y + h + 4;
        html.push(box(x0, ly, w0, LABEL_H - 4, "flex items-center justify-center gap-[8px] text-center text-body font-bold text-ink", inside));
      }
      if (s.caption)
        html.push(
          `<div class="absolute text-center text-caption text-label" style="left:${x0}px;top:${f1(out ? y0 + h0 - PAD + 4 : y + h + 4)}px;width:${w0}px">${esc(s.caption)}</div>`,
        );
    } else if (s.type === "dot") {
      const [x, y] = px(s.at),
        c = INK[tone];
      front.push(`<circle class="${c.fill} stroke-canvas" stroke-width="3" cx="${f1(x)}" cy="${f1(y)}" r="${DOT_R}"/>`);
      if (s.text) {
        const w = cw * 2.4,
          wc = Math.min(w, 2 * Math.min(x, W - x)); // 上下に書くときは、枠の端で切れないよう幅を狭める
        const at = {
          below: `left:${x - wc / 2}px;top:${y + DOT_R + 6}px;width:${wc}px;text-align:center`,
          above: `left:${x - wc / 2}px;top:${y - DOT_R - 34}px;width:${wc}px;text-align:center`,
          right: `left:${x + DOT_R + 8}px;top:${y - 14}px;width:${w}px`,
          left: `left:${x - DOT_R - 8 - w}px;top:${y - 14}px;width:${w}px;text-align:right`,
        }[s.align ?? "below"];
        html.push(`<div class="absolute text-body font-bold ${c.text}" style="${at}">${esc(s.text)}</div>`);
      }
    } else if (s.type === "badge") {
      if (s.inside) return; // 箱と一緒に描いた
      const [x, y] = badgeAt(s, i),
        D = badgeD(s);
      if (x - D / 2 < 0 || y - D / 2 < 0 || x + D / 2 > W || y + D / 2 > H)
        throw new Error(`canvas: shapes[${i + 1}] の badge が枠の外に出る（corner を変えるか、inside: true にする）`);
      const bg = { primary: "bg-primary", ink: LINE.bg, muted: "bg-gray-400" }[tone];
      html.push(box(x - D / 2, y - D / 2, D, D, `flex items-center justify-center rounded-full ${badgeText(s)} font-bold text-on-primary ${bg}`, esc(s.text)));
    } else if (s.type === "line") {
      const c = INK[tone];
      const via = (s.via ?? []).map((p) => px(pair(p, "via の点", i)));
      if (s.curve && via.length !== 1) throw new Error(`canvas: shapes[${i + 1}] の curve は via に点を1つだけ書く（曲線が引き寄せられる点）`);
      const a = end(s.from, via[0] ?? refPoint(s.to, i), i);
      const b = end(s.to, via.at(-1) ?? refPoint(s.from, i), i);
      const P = [a, ...via, b];
      const arrow = s.arrow ?? "end";
      const dash = s.dash ? ' stroke-dasharray="6 5"' : "";
      const d = s.curve ? `M${f1(a[0])},${f1(a[1])}Q${f1(via[0][0])},${f1(via[0][1])} ${f1(b[0])},${f1(b[1])}` : rounded(P, 8);
      svg.push(`<path class="fill-none ${c.stroke}" stroke-width="2.5" stroke-linejoin="round"${dash} d="${d}"/>`);
      if (arrow !== "none") svg.push(`<polygon class="${c.fill}" points="${head(P.at(-2), P.at(-1))}"/>`);
      if (arrow === "both") svg.push(`<polygon class="${c.fill}" points="${head(P[1], P[0])}"/>`);
      if (s.text) {
        if (s.curve) {
          // 曲線の真ん中（t=0.5）
          const [mx, my] = [0.25 * a[0] + 0.5 * via[0][0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * via[0][1] + 0.25 * b[1]];
          front.push(label(mx, my, s.text, "middle", "central"));
        } else {
          // いちばん長い区間の中ほどに書く
          const len = (j) => Math.hypot(P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]);
          let k = 0;
          for (let j = 1; j < P.length - 1; j++) if (len(j) > len(k)) k = j;
          const [[x1, y1], [x2, y2]] = [P[k], P[k + 1]];
          const flat = Math.abs(y2 - y1) < Math.abs(x2 - x1);
          front.push(flat ? label((x1 + x2) / 2, (y1 + y2) / 2 - 10, s.text) : label((x1 + x2) / 2 + 10, (y1 + y2) / 2, s.text, "start", "central"));
        }
      }
    } else if (s.type === "brace") {
      const [a, b] = [px(s.from), px(s.to)];
      const side = s.align ?? "right";
      const out = side === "right" || side === "below" ? 1 : -1; // 括弧のとがりの向き
      const k = 12; // 括弧の深さ
      let d, t;
      if (a[0] === b[0]) {
        const [x, y1, y2] = [a[0], Math.min(a[1], b[1]), Math.max(a[1], b[1])],
          m = (y1 + y2) / 2;
        d = `M${f1(x)},${f1(y1)}Q${f1(x + out * k)},${f1(y1)} ${f1(x + out * k)},${f1(y1 + k)}V${f1(m - k)}Q${f1(x + out * k)},${f1(m)} ${f1(x + 2 * out * k)},${f1(m)}Q${f1(x + out * k)},${f1(m)} ${f1(x + out * k)},${f1(m + k)}V${f1(y2 - k)}Q${f1(x + out * k)},${f1(y2)} ${f1(x)},${f1(y2)}`;
        t = s.text ? label(x + 2 * out * k + out * 8, m, s.text, out > 0 ? "start" : "end", "central") : "";
      } else {
        const [y, x1, x2] = [a[1], Math.min(a[0], b[0]), Math.max(a[0], b[0])],
          m = (x1 + x2) / 2;
        d = `M${f1(x1)},${f1(y)}Q${f1(x1)},${f1(y + out * k)} ${f1(x1 + k)},${f1(y + out * k)}H${f1(m - k)}Q${f1(m)},${f1(y + out * k)} ${f1(m)},${f1(y + 2 * out * k)}Q${f1(m)},${f1(y + out * k)} ${f1(m + k)},${f1(y + out * k)}H${f1(x2 - k)}Q${f1(x2)},${f1(y + out * k)} ${f1(x2)},${f1(y)}`;
        t = s.text ? label(m, y + 2 * out * k + out * 16, s.text, "middle", "central") : "";
      }
      svg.push(`<path class="fill-none ${LINE.stroke}" stroke-width="2" d="${d}"/>`);
      if (t) front.push(t);
    } else if (s.type === "note") {
      const [x, y, w, h] = bounds(s);
      svg.push(`<rect class="fill-canvas ${LINE.stroke}" stroke-width="2" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="8"/>`);
      if (s.to !== undefined) {
        // しっぽ：吹き出しの中心から指す先へ向かう線が、枠と交わるところから出す
        const c = [x + w / 2, y + h / 2];
        let t = Array.isArray(s.to) ? px(pair(s.to, "to", i)) : end(s.to, c, i);
        const [dx, dy] = [t[0] - c[0], t[1] - c[1]];
        const kx = dx ? w / 2 / Math.abs(dx) : Infinity,
          ky = dy ? h / 2 / Math.abs(dy) : Infinity;
        const n = 10,
          r = 8 + n;
        let base;
        if (kx < ky) {
          // 左か右の辺
          const ex = c[0] + Math.sign(dx) * (w / 2),
            ey = Math.min(Math.max(c[1] + dy * kx, y + r), y + h - r);
          base = [
            [ex, ey - n],
            [ex, ey + n],
          ];
        } else {
          const ey = c[1] + Math.sign(dy) * (h / 2),
            ex = Math.min(Math.max(c[0] + dx * ky, x + r), x + w - r);
          base = [
            [ex - n, ey],
            [ex + n, ey],
          ];
        }
        // しっぽは長くしすぎない（指す先が遠いときは、向きだけ合わせて TAIL で止める）
        const m = [(base[0][0] + base[1][0]) / 2, (base[0][1] + base[1][1]) / 2],
          l = Math.hypot(t[0] - m[0], t[1] - m[1]);
        if (l > TAIL) t = [m[0] + ((t[0] - m[0]) / l) * TAIL, m[1] + ((t[1] - m[1]) / l) * TAIL];
        // 面で枠の線を消してから、しっぽの2辺だけに線を引く
        const inward = base.map(([bx, by]) => [bx - Math.sign(t[0] - bx) * (kx < ky ? 2 : 0), by - Math.sign(t[1] - by) * (kx < ky ? 0 : 2)]);
        svg.push(`<polygon class="fill-canvas" points="${pts([inward[0], t, inward[1]])}"/>`);
        svg.push(`<polyline class="fill-none ${LINE.stroke}" stroke-width="2" stroke-linejoin="round" points="${pts([base[0], t, base[1]])}"/>`);
      }
      html.push(box(x, y, w, h, "flex items-center px-[16px] text-body font-bold text-ink", `<span>${esc(s.text)}</span>`));
    } else if (s.type === "text") {
      const [x, y, w, h] = bounds(s);
      html.push(box(x, y, w, h, `flex items-center ${ALIGN[s.align ?? "left"]} ${STYLE[s.style ?? "body"]} ${INK[tone].text}`, `<span>${esc(s.text)}</span>`));
    } else if (s.type === "icon") {
      const [x, y] = px(s.at);
      html.push(`<span class="absolute flex ${ICON_TEXT[tone]}" style="left:${x - ICON_BIG / 2}px;top:${y - ICON_BIG / 2}px">${icon(s, ICON_BIG)}</span>`);
    } else if (s.type === "arrow") {
      // 塗った面の矢印。右向きの形（軸と矢じり）を、中心のまわりに回して向きを変える
      const [cx, cy] = px(s.at),
        S = ARROW;
      const R = [
        [-0.5, -0.22],
        [0.02, -0.22],
        [0.02, -0.42],
        [0.5, 0],
        [0.02, 0.42],
        [0.02, 0.22],
        [-0.5, 0.22],
      ];
      const rot = { right: ([u, v]) => [u, v], left: ([u, v]) => [-u, v], down: ([u, v]) => [v, u], up: ([u, v]) => [v, -u] }[s.direction ?? "right"];
      const fill = { ink: LINE.fill, primary: "fill-primary", muted: "fill-gray-400" }[tone];
      svg.push(`<polygon class="${fill}" stroke-linejoin="round" points="${pts(R.map(rot).map(([u, v]) => [cx + u * S, cy + v * S]))}"/>`);
    } else if (s.type === "chart") {
      // ほかの図の部品を、格子の範囲の大きさで描く
      const [x, y, w, h] = bounds(s);
      const { kind, ...d } = s.chart;
      html.push(box(x, y, w, h, "", opt.comps[kind](d, { width: Math.floor(w), height: Math.floor(h), deck: opt.deck })));
    } else if (s.type === "cubes") {
      // 立方体を斜め上から見た形で並べる。下の行から上の行へ、左の列から右の列へ描くと、隠れる面が正しく隠れる
      const [x, y, w, h] = bounds(s);
      const [nc, nr] = s.count;
      const D = 0.35; // 奥行き（立方体の辺に対する割合）
      const LB = s.labels ? (nr > 1 ? 56 : 32) : 0; // 番号の文字の場所（左の幅か、下の高さ）
      const u = Math.min((w - (nr > 1 ? LB : 0)) / (nc + D), (h - (nr > 1 ? 0 : LB)) / (nr + D), 96);
      const d = u * D,
        ox = x + (nr > 1 ? LB : 0) + (w - (nr > 1 ? LB : 0) - (nc * u + d)) / 2,
        oy = y + d + (h - (nr > 1 ? 0 : LB) - (nr * u + d)) / 2;
      (s.labels ?? []).forEach((t, k) =>
        html.push(
          nr > 1
            ? box(ox - LB, oy + k * u, LB - 8, u, "flex items-center justify-end font-mono text-body font-bold text-ink", esc(t))
            : box(ox + k * u, oy + u + 4, u, LB - 4, "flex items-center justify-center font-mono text-body font-bold text-ink", esc(t)),
        ),
      );
      const on = (c, r) => (s.filled ?? []).some((f) => (typeof f === "number" ? f === c + 1 : f[0] === c + 1 && f[1] === r + 1));
      const look = (hit) =>
        s.dash
          ? { front: "fill-none", top: "fill-none", side: "fill-none", stroke: LINE.stroke, extra: ' stroke-dasharray="6 4"' }
          : hit
            ? tone === "navy"
              ? { front: LINE.fill, top: "fill-blue-600", side: "fill-blue-1200", stroke: LINE.stroke, extra: "" }
              : { front: "fill-primary", top: "fill-blue-400", side: "fill-blue-1200", stroke: LINE.stroke, extra: "" }
            : { front: "fill-canvas", top: "fill-control", side: "fill-line", stroke: LINE.stroke, extra: "" };
      for (let r = nr - 1; r >= 0; r--)
        for (let c = 0; c < nc; c++) {
          const X = ox + c * u,
            Y = oy + r * u,
            L = look(on(c, r)),
            st = `${L.stroke}" stroke-width="1.5" stroke-linejoin="round"${L.extra}`;
          svg.push(
            `<polygon class="${L.top} ${st} points="${pts([
              [X, Y],
              [X + d, Y - d],
              [X + u + d, Y - d],
              [X + u, Y],
            ])}"/>` +
              `<polygon class="${L.side} ${st} points="${pts([
                [X + u, Y],
                [X + u + d, Y - d],
                [X + u + d, Y + u - d],
                [X + u, Y + u],
              ])}"/>` +
              `<rect class="${L.front} ${st} x="${f1(X)}" y="${f1(Y)}" width="${f1(u)}" height="${f1(u)}"/>`,
          );
          const t = s.text?.[r * nc + c];
          if (t)
            html.push(
              box(X, Y, u, u, `flex items-center justify-center text-center text-caption font-bold ${on(c, r) ? "text-on-primary" : "text-ink"}`, esc(t)),
            );
        }
    } else if (s.type === "plot") {
      const [x, y] = px(s.at),
        g = plotFrame(s);
      const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
      // 目盛りの数：値がきりのよい数になる 4・5・2 のどれか
      const n = [4, 5, 2].find((m) => Number.isInteger(((g.max / m) * (g.max >= 10 ? 1 : 10)).toFixed(6) * 1)) ?? 4;
      for (let k = 0; k <= n; k++) {
        const v = (g.max * k) / n,
          yy = g.Y(v);
        svg.push(`<path class="fill-none ${k ? "stroke-line" : LINE.stroke}" stroke-width="${k ? 1 : 1.5}" d="M${f1(g.left)},${f1(yy)}H${f1(g.right)}"/>`);
        front.push(`<text class="fill-label text-caption" x="${f1(g.left - 8)}" y="${f1(yy)}" text-anchor="end" dominant-baseline="central">${fmt(v)}</text>`);
      }
      svg.push(`<path class="fill-none ${LINE.stroke}" stroke-width="1.5" d="M${f1(g.left)},${f1(g.top)}V${f1(g.bottom)}"/>`);
      // 欠け（null）で線を切る
      const segs = [[]];
      s.values.forEach((v, k) => (v === null ? segs.push([]) : segs.at(-1).push([g.X(k), g.Y(v)])));
      for (const sg of segs.filter((q) => q.length > 1))
        svg.push(`<polyline class="fill-none stroke-primary" stroke-width="2.5" stroke-linejoin="round" points="${pts(sg)}"/>`);
      s.values.forEach((v, k) => v !== null && svg.push(`<circle class="fill-primary" cx="${f1(g.X(k))}" cy="${f1(g.Y(v))}" r="3"/>`));
      (s.labels ?? []).forEach(
        (t, k) => t && front.push(`<text class="fill-label text-caption" x="${f1(g.X(k))}" y="${f1(g.bottom + 18)}" text-anchor="middle">${esc(t)}</text>`),
      );
      if (s.text) front.push(`<text class="fill-label text-caption" x="${f1(x)}" y="${f1(y + 14)}">${esc(s.text)}</text>`);
    } else if (s.type === "ring") {
      const [cx, cy] = ringAt(s);
      front.push(
        `<circle class="fill-none ${tone === "error" ? "stroke-error" : "stroke-primary"}" stroke-width="3" cx="${f1(cx)}" cy="${f1(cy)}" r="${RING}"/>`,
      );
    } else if (s.type === "people") {
      const [x, y, w, h0] = bounds(s);
      const h = s.text ? h0 - LABEL_H : h0;
      const { cols: nc, rows: nr, u } = arrange(s.count, w, h, 1.25, 64);
      const ox = x + (w - nc * u) / 2,
        oy = y + (h - nr * u * 1.25) / 2;
      for (let j = 0; j < s.count; j++) {
        const cx = ox + (j % nc) * u + u / 2,
          top = oy + Math.floor(j / nc) * u * 1.25;
        const cls = j < (s.filled ?? s.count) ? MARK[tone].fill : "fill-line";
        const bw = u * 0.34,
          by = top + u * 0.86;
        svg.push(
          `<circle class="${cls}" cx="${f1(cx)}" cy="${f1(top + u * 0.3)}" r="${f1(u * 0.2)}"/><path class="${cls}" d="M${f1(cx - bw)},${f1(top + u * 1.15)}V${f1(by)}A${f1(bw)},${f1(bw * 0.9)} 0 0 1 ${f1(cx + bw)},${f1(by)}V${f1(top + u * 1.15)}Z"/>`,
        );
      }
      if (s.text) html.push(box(x, y + h, w, LABEL_H, "flex items-center justify-center text-center text-body font-bold text-ink", esc(s.text)));
    }
  });

  return `<div class="relative mx-auto" style="width:${W}px;height:${H}px" data-kind="canvas">
${back.join("")}
<svg data-origin="generated" class="absolute left-0 top-0 overflow-visible" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${svg.join("")}${front.join("")}</svg>
${html.join("")}
</div>`;
}
