#!/usr/bin/env node
// 構成を見せるときの「タイトルだけの一覧」と「問いの連鎖」（structure-framework.md 4章・6章）
// 使い方：node .claude/skills/slide-outline/scripts/story.mjs decks/<deck-id>
// - 1行に1枚：番号、型、答える問い（question）、タイトル、新出（new）、使う（uses）。概念は知識マップの名前を添える
// - 見出しだけを順に読んで話が通るか、問いが前のスライドから自然に出るかは、人が見る（AI は判定しない。CLAUDE.md 原則6）
// - 終了コード：0（読めないときだけ 2）
import fs from "fs";
import path from "path";
import { readOutline } from "../../html-build/scripts/outline.mjs";
import { isMain } from "../../../lib/common.mjs";
import { KNOWLEDGE, parseKnowledge } from "./check-knowledge.mjs";

const one = (v) =>
  String(v ?? "")
    .replace(/\s*\n\s*/g, " ")
    .trim();

export function story(deckDir) {
  const o = readOutline(path.join(deckDir, "outline.md"));
  const km = path.join(deckDir, KNOWLEDGE);
  const names = new Map(fs.existsSync(km) ? parseKnowledge(fs.readFileSync(km, "utf8")).nodes.map((n) => [n.id, n.name]) : []);
  const ks = (v) => (Array.isArray(v) ? v.map((id) => (names.has(id) ? `${id} ${names.get(id)}` : id)).join("、") : "");
  return o.slides.map((s) => ({
    id: s.id,
    layout: s.fields.layout,
    question: one(s.fields.question),
    title: one(s.fields.title),
    new: ks(s.fields.new),
    uses: ks(s.fields.uses),
  }));
}

if (isMain(import.meta.url)) {
  const deckDir = process.argv[2];
  if (!deckDir) {
    console.error("使い方：node story.mjs decks/<deck-id>");
    process.exit(2);
  }
  let rows;
  try {
    rows = story(deckDir);
  } catch (e) {
    console.error(`エラー：${e.message}`);
    process.exit(2);
  }
  console.log("問いの連鎖（見出しだけを順に読んで話が通るか、問いが前のスライドから自然に出るかを人が見る）\n");
  console.log("| 番号 | 型 | 答える問い | タイトル | 新出 | 使う |");
  console.log("|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.id} | ${r.layout ?? ""} | ${r.question || "-"} | ${r.title || "-"} | ${r.new || "-"} | ${r.uses || "-"} |`);
}
