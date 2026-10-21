// スライドの型と図の型の決まり、寸法。ここが正で、文書（layout-catalog.md・outline-template.md）には書き写さない
// 書ける項目と上限を見るには：node .claude/skills/html-build/scripts/schema.mjs [型の名前]
// 使う側：check-outline.mjs（書式チェック）、layouts.mjs（組版）、inspect.mjs・pdf.mjs（検査と PDF）、schema.mjs（一覧の表示）
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- 寸法（px） ----
// スライドの大きさ。base.html の --slide-w・--slide-h と @page も同じ値にしている
export const SLIDE = { width: 1280, height: 720 };
// 余白と列の幅は theme.css の --spacing-* から読む（theme.css を変えれば、組版と検査がそろって変わる）
const css = fs.readFileSync(path.join(HB, "theme.css"), "utf8");
const spacing = (name) => {
  const m = css.match(new RegExp(`--spacing-${name}:\\s*(\\d+)px`));
  if (!m) throw new Error(`theme.css に --spacing-${name} がない`);
  return Number(m[1]);
};
export const SPACE = {
  x: spacing("slide-x"),
  top: spacing("slide-top"),
  bottom: spacing("slide-bottom"),
  titleGap: spacing("title-gap"),
  column: spacing("column"),
};

// ---- 図の型（components/<kind>.mjs。項目は各部品の schema） ----
export const KINDS = [
  "kpi",
  "bar",
  "hbar",
  "table",
  "stacked-bar",
  "line",
  "area",
  "combo",
  "donut",
  "scatter",
  "steps",
  "flowchart",
  "timeline",
  "roadmap",
  "matrix",
  "pyramid",
  "tree",
  "compare",
  "heatmap",
  "venn",
  "sequence",
  "er",
  "map",
  "math",
  "code",
  "image",
  "canvas",
  "dirtree",
  "cards",
  "cycle",
  "layers",
  "hub",
  "nested",
  "flow-notes",
];

// ---- スライドの型 ----
// required・optional：書ける項目。visual：図（diagram・diagrams・html のどれか1つ）が必須。lead：説明文が必須（要らないなら lead: false）
// text：1行の文字数の目安（全角）。lines：改行して何行まで書けるか（書いていない項目は1行。text はその1行の目安）。list：箇条書きの [最少, 最多, 1項目の文字数の目安, 下の階層を書けるか]。数は1つ目の階層で数え、項目のすぐあとの並びは下の階層（SUB_ITEMS まで）
// numbered：true で1つ目の階層を数字の箇条書きにする（body のある型）
// columns：{ heading, items } の枠（項目の名前、箇条書きの数、1項目と小見出しの文字数）
// grid：{ heading, text, icon? } をちょうど count 個（icon は phosphor:<名前> か先頭の assets の SVG。番号の丸の代わりに出す）。checks：{ text, done } を min〜max 個
// author：{ org, name } の文字数の目安。chapters：目次に載せられる章の数
// 文字数は目安で、超えると注意。最後はビルド後の検査で、実際の行数をブラウザで測る
const BODY = ["breadcrumb", "source"];
// 説明文（lead）：字数の目安は target（全角）。short 未満は注意（lead_short に理由を書けば出さない）。
// 幅は base（target の上限が lines 行に収まる幅。1行に2字の余裕）を基本に、lines 行に収まるまで max まで広げる。px は文字の大きさ（outline.mjs の leadWidth）
export const LEAD = { target: [140, 160], short: 100, max: 1172, lines: 3, px: 16 };
LEAD.base = (Math.ceil(LEAD.target[1] / LEAD.lines) + 2) * LEAD.px; // 896
// 太字（components.md 4.2）：1項目に perItem か所、1枚に perSlide か所まで（超えると注意）。説明文（lead）の強調は数えない（下の LEAD_BOLD）
export const BOLD = { perItem: 1, perSlide: 3 };
// 説明文（lead）の強調（components.md 4.2）：primary の青の太字。max か所まで（書くときの目安は good か所。0 でもよい）。
// 1か所は全角 chars 字まで、強調の字数の合計は lead の ratio まで（超えると注意。語句ではなく文を囲むと強調にならないため）
export const LEAD_BOLD = { max: 3, good: 2, chars: 20, ratio: 0.25 };
export const SUB_ITEMS = 4; // 下の階層の項目の数の上限（1つの項目につき）
// 図を主役にする（design-reference/principles.md 5章）：箇条書きの型が、本文のあるスライド（lead のある型）の ratio を超えたら注意。
// 箇条書きの1つ目の階層の項目が全角 minItem 字未満なら注意（書くときの目安は全角 goodItem 字以上）
export const BULLETS = { layouts: ["title-body", "text-diagram", "two-column", "do-dont"], ratio: 0.3, minItem: 12, goodItem: 25 };
// 型と部品の偏り：同じスライドの型・同じ図の型が run 枚続いたら注意。1つの図の型が、図のあるスライドの ratio を超えたら注意（図のあるスライドが min 枚以上のとき）
export const VARIETY = { run: 3, ratio: 0.4, min: 5 };
const COLUMN = { items: [1, 4], heading: 20 };
export const LAYOUTS = {
  title: {
    required: ["title", "date"],
    optional: ["subtitle", "author"],
    text: { title: 22, subtitle: 50, date: 20 },
    lines: { title: 2 },
    author: { org: 40, name: 20 },
  },
  toc: { required: [], optional: ["title"], text: { title: 30 }, chapters: 12 },
  section: {
    required: ["title"],
    optional: ["description", "topics"],
    text: { title: 16, description: 120 },
    lines: { title: 2 },
    list: { topics: [3, 6, 20] },
  },
  "title-body": { required: ["title", "body"], optional: [...BODY, "numbered"], lead: true, text: { title: 30 }, list: { body: [1, 5, 110, true] } },
  "text-diagram": {
    required: ["title", "body"],
    visual: true,
    optional: [...BODY, "caption", "numbered"],
    lead: true,
    text: { title: 30 },
    list: { body: [1, 4, 68, true] },
  },
  "title-diagram": { required: ["title"], visual: true, optional: [...BODY, "caption"], lead: true, text: { title: 30 } },
  "two-column": {
    required: ["title", "left", "right"],
    optional: BODY,
    lead: true,
    text: { title: 30 },
    columns: { keys: ["left", "right"], ...COLUMN, each: 40 },
  },
  "do-dont": { required: ["title", "do", "dont"], optional: BODY, lead: true, text: { title: 30 }, columns: { keys: ["do", "dont"], ...COLUMN, each: 34 } },
  "grid-4": { required: ["title", "items"], optional: BODY, lead: true, text: { title: 30 }, grid: { count: 4, heading: 15, text: 75 } },
  checklist: { required: ["title", "items"], optional: BODY, lead: true, text: { title: 30 }, checks: { min: 1, max: 8, text: 24 } },
  closing: { required: [], optional: ["contact", "email"], text: { contact: 50, email: 50 } },
};
// どの型にも書ける項目。idea・match は図（diagram・diagrams・html）のあるスライドに書く（slide-outline の手順 5）
// id：スライドの安定した名前（例：tdd-intro）。番号（## S41）が変わっても、承認のときのスライドと対応づけるのに使う
export const COMMON = ["layout", "id", "notes", "claims", "html", "idea", "match"];
export const SLIDE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// match：idea の絵を部品で描けるか。そのまま＝部品を使う。意味が欠ける・描けない＝独自に描く（「：」のあとに理由）
export const MATCHES = ["そのまま", "意味が欠ける", "描けない"];
// 図を書く項目（visual の型だけ）
export const VISUAL = ["diagram", "diagrams"];

// 文と見た目（承認のあとの変更で、ファクトチェックをやり直すかを決める分け方。make-slides/scripts/approvals.mjs）
// - 見た目：LOOK の項目（とその中身）と、真偽値（true・false）。並び・大きさ・色・形・アイコン・強調・図の型など
// - 文：ほかの文字列と数値のすべて（title・lead・本文・図の中の字・データの数値・notes・source・claims など）
// - 文の比べ方：太字とコードの印（** と `）、空白と改行は除いて比べる（改行の位置や太字だけの直しは文の変更にしない）
// - 迷う項目は文に入れる（やり直しが1回増えるだけで済む。見た目に入れると、確かめていない文が通るため）
export const LOOK = [
  // スライド
  ..."layout id idea match lead_short numbered".split(" "),
  // 図の型・置き方・大きさ
  ..."kind type at size grid col row via curve corner inside on wrap radius direction".split(" "),
  // 見た目の選び方
  ..."tone shape icon style align text_size frame highlight dash fit sort legend lang".split(" "),
];

// 型に書ける項目のすべて
export const allowedFields = (L) => new Set([...COMMON, ...L.required, ...L.optional, ...(L.visual ? VISUAL : []), ...(L.lead ? ["lead", "lead_short"] : [])]);

// 型の決まりを1行で書く（schema.mjs が表示に使う）
export function describeLayout(name) {
  const L = LAYOUTS[name];
  const limit = (k) => {
    if (L.text?.[k]) return L.lines?.[k] ? `${k}（${L.lines[k]}行まで、1行${L.text[k]}字）` : `${k}（${L.text[k]}字）`;
    if (L.list?.[k]) {
      const [a, b, c, nest] = L.list[k];
      return `${k}（箇条書き ${a}〜${b}項目、各${c}字${nest ? `、下の階層は1項目に${SUB_ITEMS}つまで` : ""}）`;
    }
    if (L.columns?.keys.includes(k))
      return `${k}（{ heading?: ${L.columns.heading}字, items: 箇条書き ${L.columns.items[0]}〜${L.columns.items[1]}項目、各${L.columns.each}字 }）`;
    if (k === "items" && L.grid)
      return `items（ちょうど${L.grid.count}つ。各 { heading: ${L.grid.heading}字, text: ${L.grid.text}字, icon?: phosphor:<名前> か assets の SVG }）`;
    if (k === "items" && L.checks) return `items（${L.checks.min}〜${L.checks.max}項目。各 { text: ${L.checks.text}字, done: true か false }）`;
    if (k === "author") return `author（{ org?: ${L.author.org}字, name?: ${L.author.name}字 }）`;
    return k;
  };
  const req = [
    ...L.required.map(limit),
    ...(L.visual ? ["diagram・diagrams・html のどれか"] : []),
    ...(L.lead ? ["lead（要らないなら false。短くするなら lead_short に理由）"] : []),
  ];
  const extra = L.chapters ? `｜章は${L.chapters}まで` : "";
  return `必須：${req.join(", ") || "なし"}｜任意：${[...L.optional.map(limit), "notes", "claims", ...(L.visual ? [] : ["html"]), "idea", "match"].join(", ")}${extra}`;
}
