// デッキの名前（deck-id）を変える（slide-intake/scripts/rename-deck.mjs）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { SKILLS, tempDeck, rootOf } from "./helpers.mjs";

const { renameDeck, replaceDeckId } = await import(path.join(SKILLS, "slide-intake/scripts/rename-deck.mjs"));
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const FROM = "2026-10-17-report-automation";
const TO = "2026-10-24-report-automation";
const deckId = (file) => fs.readFileSync(file, "utf8").match(/^deck_id: (.*)$/m)[1];

test("rename-deck：フォルダと、各ファイルの先頭の設定の deck_id を変える", () => {
  const dir = tempDeck();
  fs.writeFileSync(path.join(dir, "approval-request.yaml"), "target: brief.md\n");
  const r = renameDeck(dir, TO);
  assert.equal(r.ok, true, r.errors.join("\n"));
  const dest = path.join(path.dirname(dir), TO);
  assert.equal(fs.existsSync(dir), false);
  for (const f of ["brief.md", "outline.md", "reference/research.md"]) assert.equal(deckId(path.join(dest, f)), TO, f);
  assert.equal(fs.existsSync(path.join(dest, "approval-request.yaml")), false);
  assert.ok(fs.existsSync(path.join(dest, "assets")));
});

test("rename-deck：先頭の設定の外にある deck_id の文字は変えない", () => {
  const text = `---\ndeck_id: ${FROM}\n---\n\n本文の deck_id: ${FROM}\n`;
  assert.equal(replaceDeckId(text, FROM, TO), `---\ndeck_id: ${TO}\n---\n\n本文の deck_id: ${FROM}\n`);
});

test("rename-deck：承認の記録があれば何も変えずに止める", () => {
  const dir = tempDeck();
  fs.writeFileSync(path.join(dir, "approvals.yaml"), "approvals: []\n");
  const r = renameDeck(dir, TO);
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /承認の記録がある/);
  assert.ok(fs.existsSync(dir));
  assert.equal(deckId(path.join(dir, "brief.md")), FROM);
});

test("rename-deck：deck-id の形が違う、行き先がもうあるときは止める", () => {
  const dir = tempDeck();
  assert.match(renameDeck(dir, "report").errors.join("\n"), /YYYY-MM-DD/);
  fs.mkdirSync(path.join(path.dirname(dir), TO));
  assert.match(renameDeck(dir, TO).errors.join("\n"), /もうある/);
  assert.ok(fs.existsSync(dir));
});

test("rename-deck：git の管理下なら git mv で動かし、ブランチ feature/<deck-id> の名前も変える", () => {
  const dir = tempDeck();
  const root = rootOf(dir);
  git(root, "init", "-q", "-b", "develop");
  git(root, "config", "user.name", "tester");
  git(root, "config", "user.email", "tester@example.com");
  git(root, "commit", "-q", "--allow-empty", "-m", "init");
  git(root, "switch", "-q", "-c", `feature/${FROM}`);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "deck");
  const r = renameDeck(dir, TO);
  assert.equal(r.ok, true, r.errors.join("\n"));
  assert.equal(git(root, "symbolic-ref", "--short", "HEAD"), `feature/${TO}`);
  assert.equal(git(root, "ls-files", "--", `decks/${FROM}`), "");
  assert.match(git(root, "status", "--porcelain"), new RegExp(`^R. decks/${FROM}/brief.md -> decks/${TO}/brief.md`, "m"));
});
