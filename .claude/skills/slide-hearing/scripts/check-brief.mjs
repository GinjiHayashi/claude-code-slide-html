#!/usr/bin/env node
// brief.md のチェック：空の項目（まだ聞いていない）と、書式の誤りを出す。ヒアリングで聞く項目はここから決める。
// 使い方：node .claude/skills/slide-hearing/scripts/check-brief.mjs decks/<deck-id>/brief.md
// - 書式は slide-hearing/brief-template.md。空＝まだ聞いていない、「なし」＝聞いて不要とわかった
// - 資料（reference/）の検査も行う：inputs/ の資料がすべて md になっているか、AI の読み取りが終わっているかなど（slide-intake/reference-format.md）
// - 戻り値：{ errors（書式の誤り）, missing（空の項目）, questions（「確認したいこと」に書かれた行）, meta, sections }
// - 終了コード：0＝すべて埋まっている、1＝空の項目か確認したいことがある、2＝書式の誤り
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { DECK_ID, empty, frontMatter, isMain } from "../../../lib/common.mjs";
import { checkReference } from "../../slide-intake/scripts/reference.mjs";

export const META = ["deck_id", "title", "subtitle", "date", "author", "contact", "pdf", "max_subagents", "factcheck"];
// ファクトチェックの時期（make-slides の gate.mjs・status.mjs が使う）。1つ目が既定
export const FACTCHECK_TIMING = ["最後に1回", "構成のあとと最後の2回"];
// 調査とファクトチェックで1回に呼ぶサブエージェントの数の上限（research-standards・slide-factcheck が使う）
export const MAX_SUBAGENTS = { min: 1, max: 10, default: 3 };
// 並びは questions.md の表の順・brief-template.md の見出しの順
export const SECTIONS = [
  "目的・この資料で決めたいこと",
  "聞き手と前提知識",
  "伝えたい結論（1文）",
  "発表時間・枚数の目安",
  "調査が必要な項目",
  "必ず入れる要素・入れない要素",
  "構成の進め方",
];
export const PLAN = ["決まっている", "たたき台がある", "相談して決めたい"];
// 信頼して使う資料（fact-checker が、原本と照らさずに「確かめた」と扱う資料）。1行に1つ、資料の ID（R-001）を先頭に書く
export const TRUSTED = "信頼して使う資料";
const NONE = "なし";

export function checkBrief(text) {
  const errors = [],
    missing = [],
    missingMeta = [];
  const m = frontMatter(text);
  let meta = {};
  if (!m) errors.push("先頭に --- で囲んだ設定（deck_id など）がない");
  else {
    try {
      meta = YAML.parse(m[1]) ?? {};
    } catch (e) {
      errors.push(`先頭の設定が YAML として読めない：${e.message.split("\n")[0]}`);
    }
  }
  for (const k of Object.keys(meta)) if (!META.includes(k)) errors.push(`先頭の設定に知らない項目「${k}」がある`);
  if (!empty(meta.deck_id) && !DECK_ID.test(meta.deck_id)) errors.push(`deck_id は YYYY-MM-DD-<短い英語名>（小文字・数字・ハイフン）：${meta.deck_id}`);
  if (meta.date === NONE) errors.push("date は必須（表紙の日付）。「なし」にはできない");
  for (const [k, keys] of [
    ["author", ["org", "name"]],
    ["contact", ["text", "email"]],
  ]) {
    const v = meta[k];
    if (empty(v) || v === NONE) continue;
    if (typeof v !== "object" || Array.isArray(v)) {
      errors.push(`${k} は ${keys.join("・")} を書くか「なし」`);
      continue;
    }
    for (const x of Object.keys(v)) if (!keys.includes(x)) errors.push(`${k} に知らない項目「${x}」がある（${keys.join("・")}）`);
    for (const x of keys) if (v[x] === NONE) errors.push(`${k}.${x} に「なし」は書かない。出さない方は項目ごと消す（${k} 全体を出さないなら ${k}: なし）`);
    if (keys.every((x) => empty(v[x]))) missingMeta.push(k);
  }
  for (const k of META) if (empty(meta[k])) missingMeta.push(k);
  if (!empty(meta.pdf) && typeof meta.pdf !== "boolean") errors.push("pdf は true か false");
  const n = meta.max_subagents;
  if (!empty(n) && !(Number.isInteger(n) && n >= MAX_SUBAGENTS.min && n <= MAX_SUBAGENTS.max))
    errors.push(`max_subagents は ${MAX_SUBAGENTS.min}〜${MAX_SUBAGENTS.max} の整数（既定は ${MAX_SUBAGENTS.default}）`);

  if (!empty(meta.factcheck) && !FACTCHECK_TIMING.includes(meta.factcheck))
    errors.push(`factcheck は ${FACTCHECK_TIMING.join("・")} のどちらか（既定は ${FACTCHECK_TIMING[0]}）`);

  // 本文：見出しごとの文章。（ ）だけの説明書きは空とみなす
  const body = m ? text.slice(m[0].length) : text;
  const sections = {};
  for (const part of body.split(/^(?=## )/m)) {
    const h = part.match(/^## (.+)\n?/);
    if (h)
      sections[h[1].trim()] = part
        .slice(h[0].length)
        .replace(/^（[^）]*）$/gm, "")
        .trim();
  }
  // 空の項目は、ヒアリングで聞く順（questions.md の表の順：本文の見出し → 先頭の設定）に並べる
  for (const s of SECTIONS) {
    if (!(s in sections)) errors.push(`見出し「## ${s}」がない`);
    else if (!sections[s]) missing.push(s);
  }
  // 信頼して使う資料：見出しは任意（前からのデッキにはない）。見出しがあって空なら、まだ聞いていない
  if (TRUSTED in sections && !sections[TRUSTED]) missing.push(TRUSTED);
  // deck_id は聞かずに AI が付けるので最後（questions.md の表の順）
  missing.push(...[...META.slice(1), META[0]].filter((k) => missingMeta.includes(k)));
  const plan = sections["構成の進め方"];
  if (plan && !PLAN.some((p) => plan.replace(/^[-*]\s*/, "").startsWith(p))) errors.push(`「構成の進め方」の1行目は ${PLAN.join("・")} のどれかで始める`);
  const questions = (sections["確認したいこと"] ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  return { errors, missing, questions, meta, sections };
}

// 信頼して使う資料（各行の先頭の R-001。前からのデッキは inputs/…）
export const trusted = (sections) =>
  (sections[TRUSTED] ?? "")
    .split("\n")
    .map(
      (l) =>
        l
          .replace(/^[-*]\s*/, "")
          .trim()
          .replace(/^`/, "")
          .split(/[`\s：:（(]/)[0],
    )
    .filter((f) => /^R-\d{3,}$/.test(f) || f.startsWith("inputs/"));

// 資料：reference/ の検査（slide-intake/scripts/reference.mjs）と、「信頼して使う資料」の ID が reference/ にあるか。
// 資料の一覧は reference/index.md（前の「入力の一覧」の表は使わない。あっても見ない）
export function checkSources(sections, deckDir) {
  const r = checkReference(deckDir);
  const errors = r.errors.map((e) => `資料：${e}`);
  const ids = new Set(r.status.sources.map((s) => s.meta.id));
  const srcs = new Set(r.status.sources.map((s) => s.meta.source));
  for (const f of trusted(sections)) {
    if (f.startsWith("R-") && !ids.has(f)) errors.push(`「${TRUSTED}」の ${f} が reference/ の資料にない`);
    if (f.startsWith("inputs/") && !srcs.has(f) && !fs.existsSync(path.join(deckDir, f)))
      errors.push(`「${TRUSTED}」の ${f} が inputs/ にない（R-001 の形で書く）`);
  }
  return errors;
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("使い方：node check-brief.mjs decks/<deck-id>/brief.md");
    process.exit(2);
  }
  const r = checkBrief(fs.readFileSync(file, "utf8"));
  r.errors.push(...checkSources(r.sections, path.dirname(file)));
  for (const e of r.errors) console.log(`エラー  ${e}`);
  for (const k of r.missing) console.log(`空      ${k}`);
  for (const q of r.questions) console.log(`確認    ${q}`);
  console.log(`エラー ${r.errors.length}件、空の項目 ${r.missing.length}件、確認したいこと ${r.questions.length}件`);
  process.exit(r.errors.length ? 2 : r.missing.length || r.questions.length ? 1 : 0);
}
