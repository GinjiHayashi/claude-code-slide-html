#!/usr/bin/env node
// デッキのフォルダと、空の brief.md を作る。slide-intake の最初に一度だけ実行する。
// 使い方：node .claude/skills/slide-intake/scripts/new-deck.mjs <deck-id>
// - deck-id は YYYY-MM-DD-<短い英語名>（小文字・数字・ハイフン）。decks/<deck-id>/ と、その中の inputs/（人間が渡した元の資料。git の管理外）・reference/（資料の md と調査。reference-format.md）・
//   assets/（スライドに載せる画像）・build/（ビルドが作るもの）を作る
// - brief.md は deck_id だけを入れ、ほかの項目は空（＝まだ聞いていない）。項目と見出しは check-brief.mjs と同じ
// - すでにフォルダがあれば何も作らず、終了コード 1 で終わる（上書きしない。呼び出し元はそのフォルダを使う）
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { META, SECTIONS } from "../../slide-hearing/scripts/check-brief.mjs";
import { DECK_ID, isMain } from "../../../lib/common.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export function briefSkeleton(id) {
  const meta = META.map((k) => (k === "deck_id" ? `deck_id: ${id}` : `${k}:`)).join("\n");
  const body = [...SECTIONS, "構成で検討すること", "確認したいこと"].map((s) => `## ${s}\n`).join("\n");
  return `---\n${meta}\n---\n\n${body}\n## 出どころ\n\n| 項目 | 出どころ |\n|---|---|\n`;
}

if (isMain(import.meta.url)) {
  const id = process.argv[2];
  if (!id || !DECK_ID.test(id)) {
    console.error("使い方：node new-deck.mjs <deck-id>（YYYY-MM-DD-<短い英語名>。小文字・数字・ハイフン）");
    process.exit(2);
  }
  const dir = path.join(ROOT, "decks", id);
  if (fs.existsSync(dir)) {
    console.error(`decks/${id} はもうある。上書きしない`);
    process.exit(1);
  }
  for (const sub of ["inputs", "reference", "assets", "build"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  fs.writeFileSync(path.join(dir, "brief.md"), briefSkeleton(id));
  console.log(
    `decks/${id}/brief.md と inputs/・reference/・assets/・build/ を作った。資料は inputs/ に置き、reference.mjs で md にしてから brief.md を埋める（slide-intake の手順 2〜4）`,
  );
}
