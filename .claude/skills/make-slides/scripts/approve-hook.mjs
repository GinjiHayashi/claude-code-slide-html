#!/usr/bin/env node
// 承認の hook（UserPromptSubmit）：人間がプロンプトに次の1行だけを打つと、approvals.yaml に承認を記録する（要求文書 4章）。
//   承認 outline.md
//   承認 2026-10-17-report outline.md factcheck.md   ← デッキが複数あるときは deck-id を付ける
// - 対象：brief.md、outline.md、factcheck.md、deck.html。記録するのは、その時点のファイルの sha256
// - AI の自己申告ではなく、Claude Code が渡すプロンプトの文字だけを見て記録する。プロンプト全体がこの形のときだけ反応する
// - 記録したら、その内容を AI に伝える（additionalContext）。うまくいかないときはプロンプトを止めて、理由を人間に見せる
// - 承認者は git config user.name
// 設定は .claude/settings.json の hooks.UserPromptSubmit。
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { TARGETS, recordApproval } from "./approvals.mjs";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const prompt = String(input.prompt ?? "").trim();
const m = prompt.match(/^承認[ 　]+(.+)$/);
if (!m) process.exit(0); // 承認のプロンプトでなければ何もしない

const block = (reason) => { console.log(JSON.stringify({ decision: "block", reason })); process.exit(0); };
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const decks = path.join(root, "decks");
const words = m[1].split(/[ 　]+/);
let deckId = null;
if (!TARGETS.includes(words[0])) deckId = words.shift();
const targets = words;
if (!targets.length || targets.some((t) => !TARGETS.includes(t))) block(`承認できるのは ${TARGETS.join("、")} です。例：承認 outline.md`);

const has = (id) => targets.every((t) => fs.existsSync(path.join(decks, id, t)));
if (!deckId) {
  const cands = fs.existsSync(decks) ? fs.readdirSync(decks).filter((d) => fs.statSync(path.join(decks, d)).isDirectory() && has(d)) : [];
  if (cands.length !== 1) block(cands.length ? `どのデッキかわかりません。deck-id を付けてください（例：承認 ${cands[0]} ${targets.join(" ")}）。候補：${cands.join("、")}` : `decks/ に ${targets.join("・")} のあるデッキがありません`);
  deckId = cands[0];
}
if (!has(deckId)) block(`decks/${deckId}/ に ${targets.join("・")} がありません`);

let by = "";
try { by = execFileSync("git", ["-C", root, "config", "user.name"], { encoding: "utf8" }).trim(); } catch {}
if (!by) block("承認者がわかりません。git config user.name を設定してください");

const lines = targets.map((t) => {
  const { entry, changed } = recordApproval(path.join(decks, deckId), t, {
    approved_by: by, approved_at: new Date().toISOString(), via: "prompt", session_id: input.session_id ?? null, prompt_id: input.prompt_id ?? null,
  });
  return `- decks/${deckId}/${t}（sha256 ${entry.sha256.slice(0, 12)}…、承認者 ${by}）：${changed}`;
});
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: `承認の hook が approvals.yaml に記録した（人間のプロンプトによる承認）：\n${lines.join("\n")}\n記録した内容を人間に一言で伝え、次の工程に進むかを確かめる。`,
  },
}));
