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
];

// ---- スライドの型 ----
// required・optional：書ける項目。visual：図（diagram・diagrams・html のどれか1つ）が必須。lead：説明文が必須（要らないなら lead: false）
// text：1行の文字数の目安（全角）。list：箇条書きの [最少, 最多, 1項目の文字数の目安]
// columns：{ heading, items } の枠（項目の名前、箇条書きの数、1項目と小見出しの文字数）
// grid：{ heading, text } をちょうど count 個。checks：{ text, done } を min〜max 個
// author：{ org, name } の文字数の目安。chapters：目次に載せられる章の数
// 文字数は目安で、超えると注意。最後はビルド後の検査で、実際の行数をブラウザで測る
const BODY = ["breadcrumb", "source"];
const COLUMN = { items: [1, 4], heading: 20 };
export const LAYOUTS = {
  title: { required: ["title", "date"], optional: ["subtitle", "author"], text: { title: 44, subtitle: 50, date: 20 }, author: { org: 40, name: 20 } },
  toc: { required: [], optional: ["title"], text: { title: 30 }, chapters: 12 },
  section: { required: ["title"], optional: ["description", "topics"], text: { title: 16, description: 120 }, list: { topics: [3, 6, 20] } },
  "title-body": { required: ["title", "body"], optional: BODY, lead: true, text: { title: 30 }, list: { body: [1, 5, 110] } },
  "text-diagram": { required: ["title", "body"], visual: true, optional: [...BODY, "caption"], lead: true, text: { title: 30 }, list: { body: [1, 4, 68] } },
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
// どの型にも書ける項目
export const COMMON = ["layout", "notes", "claims", "html"];
// 図を書く項目（visual の型だけ）
export const VISUAL = ["diagram", "diagrams"];

// 型に書ける項目のすべて
export const allowedFields = (L) => new Set([...COMMON, ...L.required, ...L.optional, ...(L.visual ? VISUAL : []), ...(L.lead ? ["lead"] : [])]);

// 型の決まりを1行で書く（schema.mjs が表示に使う）
export function describeLayout(name) {
  const L = LAYOUTS[name];
  const limit = (k) => {
    if (L.text?.[k]) return `${k}（${L.text[k]}字）`;
    if (L.list?.[k]) {
      const [a, b, c] = L.list[k];
      return `${k}（箇条書き ${a}〜${b}項目、各${c}字）`;
    }
    if (L.columns?.keys.includes(k))
      return `${k}（{ heading?: ${L.columns.heading}字, items: 箇条書き ${L.columns.items[0]}〜${L.columns.items[1]}項目、各${L.columns.each}字 }）`;
    if (k === "items" && L.grid) return `items（ちょうど${L.grid.count}つ。各 { heading: ${L.grid.heading}字, text: ${L.grid.text}字 }）`;
    if (k === "items" && L.checks) return `items（${L.checks.min}〜${L.checks.max}項目。各 { text: ${L.checks.text}字, done: true か false }）`;
    if (k === "author") return `author（{ org?: ${L.author.org}字, name?: ${L.author.name}字 }）`;
    return k;
  };
  const req = [...L.required.map(limit), ...(L.visual ? ["diagram・diagrams・html のどれか"] : []), ...(L.lead ? ["lead（要らないなら false）"] : [])];
  const extra = L.chapters ? `｜章は${L.chapters}まで` : "";
  return `必須：${req.join(", ") || "なし"}｜任意：${[...L.optional.map(limit), "notes", "claims", ...(L.visual ? [] : ["html"])].join(", ")}${extra}`;
}
