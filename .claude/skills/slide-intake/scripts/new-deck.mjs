#!/usr/bin/env node
// デッキのフォルダと、空の brief.md を作る（要求文書 6.2）。slide-intake の最初に一度だけ実行する。
// 使い方：node .claude/skills/slide-intake/scripts/new-deck.mjs <deck-id>
// - deck-id は YYYY-MM-DD-<短い英語名>（小文字・数字・ハイフン）。decks/<deck-id>/ と、その中の inputs/（人間が渡した元の資料）・build/（ビルドが作るもの）を作る
// - brief.md は deck_id だけを入れ、ほかの項目は空（＝まだ聞いていない）。項目と見出しは check-brief.mjs と同じ
// - すでにフォルダがあれば何もしない（上書きしない）
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { META, SECTIONS } from "../../slide-hearing/scripts/check-brief.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export function briefSkeleton(id) {
  const meta = META.map((k) => (k === "deck_id" ? `deck_id: ${id}` : `${k}:`)).join("\n");
  const body = [...SECTIONS, "構成で検討すること", "確認したいこと"].map((s) => `## ${s}\n`).join("\n");
  return `---\n${meta}\n---\n\n${body}\n## 入力の一覧\n\n| ファイル | 中身 | 使う工程 |\n|---|---|---|\n\n## 出どころ\n\n| 項目 | 出どころ |\n|---|---|\n`;
}

if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const id = process.argv[2];
  if (!id || !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(id)) {
    console.error("使い方：node new-deck.mjs <deck-id>（YYYY-MM-DD-<短い英語名>。小文字・数字・ハイフン）");
    process.exit(2);
  }
  const dir = path.join(ROOT, "decks", id);
  if (fs.existsSync(dir)) { console.error(`decks/${id} はもうある。上書きしない`); process.exit(1); }
  for (const sub of ["inputs", "build"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  fs.writeFileSync(path.join(dir, "brief.md"), briefSkeleton(id));
  console.log(`decks/${id}/brief.md と inputs/・build/ を作った。資料は inputs/ に置き、読んで brief.md を埋める（slide-intake の手順 2・3）`);
}
