#!/usr/bin/env node
// 図の変更の指示（change）の反映を確かめる：AI が直してよいのは、change を書いたスライドの図だけ（make-slides/fixing.md）
// 使い方：
//   node .claude/skills/make-slides/scripts/edit-check.mjs start decks/<deck-id>   … 直す前。今の outline.md を写しておく
//   node .claude/skills/make-slides/scripts/edit-check.mjs end decks/<deck-id>     … 直したあと。写しと比べる
// - start：change が書かれたスライドを一覧にし、outline.md の写しを build/.edit-check.json に置く（一時ファイル。git の管理外）。
//   change の文を作業記録（worklog.jsonl の event: change）に残す。change がどこにもなければ止める
// - end：写しと今の outline.md を比べる。次はエラー（終了コード 2。写しは残すので、直して end をやり直す）
//   - スライドの数・並び（見出し）、先頭の設定が変わった
//   - change のないスライドが変わった（人間が書いた文も、AI は書き換えない）
//   - change のあるスライドで、図の項目（EDITABLE）以外が変わった。文も直す必要があるなら、先に人間に聞く
//   - change が空になっていない
//   合格なら、change のあったスライドの idea の前と後を出し、写しを消す。idea が前と同じなら注意（新しい絵の説明に書き換えたか）
// - 比べるのは項目の値（YAML として読んだもの）。項目の順・字下げ・コメントの違いは比べない
import fs from "fs";
import path from "path";
import { isMain } from "../../../lib/common.mjs";
import { parseOutline, width, plain } from "../../html-build/scripts/outline.mjs";
import { IDEA } from "../../html-build/scripts/spec.mjs";
import { appendWork } from "./worklog.mjs";

export const SNAPSHOT = "build/.edit-check.json";
// change のあるスライドで、AI が変えてよい項目（図と、図のイメージ）
export const EDITABLE = ["diagram", "diagrams", "html", "idea", "match", "change"];

// change が残っているスライド
export function pendingChanges(text) {
  return parseOutline(text)
    .slides.filter((s) => typeof s.fields.change === "string" && s.fields.change.trim())
    .map((s) => ({ slide: s.id, ...(typeof s.fields.id === "string" ? { id: s.fields.id } : {}), change: s.fields.change.trim() }));
}

// 項目の順によらない文字列（比べるため）
const stable = (v) =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
          .join(",")}}`
      : JSON.stringify(v ?? null);
const empty = (v) => v == null || (typeof v === "string" && !v.trim());

export function start(deckDir) {
  const text = fs.readFileSync(path.join(deckDir, "outline.md"), "utf8");
  const changes = pendingChanges(text);
  if (!changes.length) return { errors: ["change が書かれたスライドがない（直す指示がない）"], changes };
  const f = path.join(deckDir, SNAPSHOT);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ at: new Date().toISOString(), changes, outline: text }, null, 2) + "\n");
  appendWork(deckDir, { event: "change", slides: changes.map((c) => c.slide), changes: changes.map((c) => c.change) });
  return { errors: [], changes };
}

export function end(deckDir) {
  const f = path.join(deckDir, SNAPSHOT);
  if (!fs.existsSync(f)) return { errors: [`${SNAPSHOT} がない。直す前に start を実行する`], ideas: [], warnings: [] };
  const snap = JSON.parse(fs.readFileSync(f, "utf8"));
  const before = parseOutline(snap.outline);
  const after = parseOutline(fs.readFileSync(path.join(deckDir, "outline.md"), "utf8"));
  const errors = [],
    warnings = [],
    ideas = [];
  if (stable(before.meta) !== stable(after.meta)) errors.push("先頭の設定（deck_id・title・assets など）が変わった");
  const heads = (o) => o.slides.map((s) => s.id).join(",");
  if (heads(before) !== heads(after)) {
    errors.push(`スライドの数か並びが変わった（前：${before.slides.length}枚、今：${after.slides.length}枚）。change ではスライドを足す・消す・並べ替えない`);
    return { errors, warnings, ideas };
  }
  const targets = new Set(snap.changes.map((c) => c.slide));
  before.slides.forEach((b, i) => {
    const a = after.slides[i];
    const keys = [...new Set([...Object.keys(b.fields), ...Object.keys(a.fields)])];
    const diff = keys.filter((k) => stable(b.fields[k]) !== stable(a.fields[k]));
    if (!targets.has(b.id)) {
      if (diff.length) errors.push(`${b.id}：change のないスライドが変わった（${diff.join("・")}）。元に戻す`);
      return;
    }
    const other = diff.filter((k) => !EDITABLE.includes(k));
    if (other.length) errors.push(`${b.id}：図のほかの項目が変わった（${other.join("・")}）。文も直す必要があるなら、元に戻して人間に聞く`);
    if (!empty(a.fields.change)) errors.push(`${b.id}：change が空になっていない。図を直したら idea に統合し、change を空にする`);
    if (stable(b.fields.idea) === stable(a.fields.idea)) warnings.push(`${b.id}：idea が前と同じ。新しい絵の説明に書き換えたか確かめる`);
    else if (typeof a.fields.idea === "string") {
      const lines = a.fields.idea.replace(/\n+$/, "").split("\n").length;
      const n = width(plain(a.fields.idea));
      if (lines > IDEA.lines || n > IDEA.chars) warnings.push(`${b.id}：idea が長い（${lines}行、全角${n}字）。足さずに、今の絵の説明に書き換える`);
    }
    ideas.push({ slide: b.id, change: snap.changes.find((c) => c.slide === b.id)?.change, before: b.fields.idea ?? null, after: a.fields.idea ?? null });
  });
  if (!errors.length) fs.rmSync(f);
  return { errors, warnings, ideas };
}

if (isMain(import.meta.url)) {
  const [cmd, deckDir] = process.argv.slice(2);
  if (!["start", "end"].includes(cmd) || !deckDir) {
    console.error("使い方：node edit-check.mjs <start|end> decks/<deck-id>");
    process.exit(2);
  }
  let r;
  try {
    r = cmd === "start" ? start(deckDir) : end(deckDir);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (cmd === "start" && !r.errors.length) {
    console.log(`図の変更の指示：${r.changes.length}枚。直してよいのは、このスライドの図の項目（${EDITABLE.join("・")}）だけ`);
    for (const c of r.changes) console.log(`- ${c.slide}：${c.change}`);
  }
  if (cmd === "end") {
    for (const x of r.ideas ?? []) {
      console.log(`- ${x.slide}（指示：${x.change}）`);
      console.log(`  idea（前）：${x.before ?? "なし"}`);
      console.log(`  idea（後）：${x.after ?? "なし"}`);
    }
    for (const w of r.warnings) console.log(`注意：${w}`);
    if (!r.errors.length) console.log("合格：直したのは change のスライドの図だけ。写しを消した");
  }
  for (const e of r.errors) console.error(`エラー：${e}`);
  process.exit(r.errors.length ? 2 : 0);
}
