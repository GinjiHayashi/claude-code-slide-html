// テストで共通に使うもの
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SKILLS = path.join(ROOT, ".claude", "skills");
export const SAMPLE = path.join(ROOT, "examples", "sample-deck");

// 見本のデッキを一時フォルダの decks/<deck-id>/ に写す（テストが見本を書き換えないように）。戻り値はデッキのフォルダ
export function tempDeck(id = "2026-10-17-report-automation", files = ["brief.md", "outline.md", "research.md"]) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-")), "decks", id);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(SAMPLE, f), path.join(dir, f));
  return dir;
}

// デッキのフォルダから見たリポジトリの根（decks/ の親）
export const rootOf = (deckDir) => path.dirname(path.dirname(deckDir));
