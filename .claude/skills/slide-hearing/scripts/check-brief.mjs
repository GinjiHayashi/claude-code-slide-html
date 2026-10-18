#!/usr/bin/env node
// brief.md のチェック：空の項目（まだ聞いていない）と、書式の誤りを出す。ヒアリングで聞く項目はここから決める。
// 使い方：node .claude/skills/slide-hearing/scripts/check-brief.mjs decks/<deck-id>/brief.md
// - 書式は slide-hearing/brief-template.md。空＝まだ聞いていない、「なし」＝聞いて不要とわかった
// - デッキのフォルダに inputs/ があれば、その中のファイルがすべて「入力の一覧」の表に書かれているかも確かめる（漏れた資料は構成に使われないため）
// - 戻り値：{ errors（書式の誤り）, missing（空の項目）, questions（「確認したいこと」に書かれた行）, meta, sections }
// - 終了コード：0＝すべて埋まっている、1＝空の項目か確認したいことがある、2＝書式の誤り
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const HB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "html-build");
const YAML = createRequire(path.join(HB, "package.json"))("yaml");

export const META = ["deck_id", "title", "subtitle", "date", "author", "contact", "pdf"];
// 並びは questions.md の表の順・brief-template.md の見出しの順
export const SECTIONS = ["目的・この資料で決めたいこと", "聞き手と前提知識", "伝えたい結論（1文）", "発表時間・枚数の目安", "調査が必要な項目", "必ず入れる要素・入れない要素", "構成の進め方"];
export const PLAN = ["決まっている", "たたき台がある", "相談して決めたい"];
const NONE = "なし";
const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

export function checkBrief(text) {
  const errors = [], missing = [], missingMeta = [];
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  let meta = {};
  if (!m) errors.push("先頭に --- で囲んだ設定（deck_id など）がない");
  else {
    try { meta = YAML.parse(m[1]) ?? {}; } catch (e) { errors.push(`先頭の設定が YAML として読めない：${e.message.split("\n")[0]}`); }
  }
  for (const k of Object.keys(meta)) if (!META.includes(k)) errors.push(`先頭の設定に知らない項目「${k}」がある`);
  if (!empty(meta.deck_id) && !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(meta.deck_id)) errors.push(`deck_id は YYYY-MM-DD-<短い英語名>（小文字・数字・ハイフン）：${meta.deck_id}`);
  if (meta.date === NONE) errors.push("date は必須（表紙の日付）。「なし」にはできない");
  for (const [k, keys] of [["author", ["org", "name"]], ["contact", ["text", "email"]]]) {
    const v = meta[k];
    if (empty(v) || v === NONE) continue;
    if (typeof v !== "object" || Array.isArray(v)) { errors.push(`${k} は ${keys.join("・")} を書くか「なし」`); continue; }
    for (const x of Object.keys(v)) if (!keys.includes(x)) errors.push(`${k} に知らない項目「${x}」がある（${keys.join("・")}）`);
    for (const x of keys) if (v[x] === NONE) errors.push(`${k}.${x} に「なし」は書かない。出さない方は項目ごと消す（${k} 全体を出さないなら ${k}: なし）`);
    if (keys.every((x) => empty(v[x]))) missingMeta.push(k);
  }
  for (const k of META) if (empty(meta[k])) missingMeta.push(k);
  if (!empty(meta.pdf) && typeof meta.pdf !== "boolean") errors.push("pdf は true か false");

  // 本文：見出しごとの文章。（ ）だけの説明書きは空とみなす
  const body = m ? text.slice(m[0].length) : text;
  const sections = {};
  for (const part of body.split(/^(?=## )/m)) {
    const h = part.match(/^## (.+)\n?/);
    if (h) sections[h[1].trim()] = part.slice(h[0].length).replace(/^（[^）]*）$/gm, "").trim();
  }
  // 空の項目は、ヒアリングで聞く順（questions.md の表の順：本文の見出し → 先頭の設定）に並べる
  for (const s of SECTIONS) {
    if (!(s in sections)) errors.push(`見出し「## ${s}」がない`);
    else if (!sections[s]) missing.push(s);
  }
  // deck_id は聞かずに AI が付けるので最後（questions.md の表の順）
  missing.push(...[...META.slice(1), META[0]].filter((k) => missingMeta.includes(k)));
  const plan = sections["構成の進め方"];
  if (plan && !PLAN.some((p) => plan.replace(/^[-*]\s*/, "").startsWith(p))) errors.push(`「構成の進め方」の1行目は ${PLAN.join("・")} のどれかで始める`);
  const questions = (sections["確認したいこと"] ?? "").split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
  return { errors, missing, questions, meta, sections };
}

// inputs/ のファイルと「入力の一覧」の表を突き合わせる。表の1列目に inputs/ からのパスを書く
export function checkInputs(sections, deckDir) {
  const errors = [];
  const dir = path.join(deckDir, "inputs");
  if (!fs.existsSync(dir)) return errors;
  if (!("入力の一覧" in sections)) return ["見出し「## 入力の一覧」がない"];
  const files = fs.readdirSync(dir, { recursive: true })
    .map((f) => `inputs/${String(f).split(path.sep).join("/")}`)
    .filter((f) => !f.split("/").some((x) => x.startsWith(".")) && fs.statSync(path.join(deckDir, f)).isFile());
  const listed = sections["入力の一覧"].split("\n").filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().replace(/^\|/, "").split("|")[0].trim().replace(/^`|`$/g, ""))
    .filter((c) => c.startsWith("inputs/"));
  for (const f of files) if (!listed.includes(f)) errors.push(`${f} が「入力の一覧」にない（読んで中身と使う工程を書く）`);
  for (const f of listed) if (!files.includes(f)) errors.push(`「入力の一覧」の ${f} が inputs/ にない`);
  return errors;
}

// コマンドとして呼ばれたとき
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const file = process.argv[2];
  if (!file) { console.error("使い方：node check-brief.mjs decks/<deck-id>/brief.md"); process.exit(2); }
  const r = checkBrief(fs.readFileSync(file, "utf8"));
  r.errors.push(...checkInputs(r.sections, path.dirname(file)));
  for (const e of r.errors) console.log(`エラー  ${e}`);
  for (const k of r.missing) console.log(`空      ${k}`);
  for (const q of r.questions) console.log(`確認    ${q}`);
  console.log(`エラー ${r.errors.length}件、空の項目 ${r.missing.length}件、確認したいこと ${r.questions.length}件`);
  process.exit(r.errors.length ? 2 : r.missing.length || r.questions.length ? 1 : 0);
}
