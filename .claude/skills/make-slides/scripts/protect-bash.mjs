#!/usr/bin/env node
// 書き込みの検査の hook（PreToolUse・Bash）：ハーネスのファイルと承認の記録を、Bash 経由で書き換えさせない（要求文書 9.1、Q6。構築順序10）。
// settings.json の Edit のルールは、Bash の「>」や sed などには効くが、node -e や python3 -c の中の書き込みには効かない（公式ドキュメント）。
// その穴を、コマンドの文字列から分かる範囲で埋める。すり抜けは残るので、ターンの終わりに protect-check.mjs が変更を見つける。
// - approvals.yaml を書きうるコマンド → 止める（deny）。承認の記録は hook（approve-hook.mjs）だけが書く
// - .claude/ と CLAUDE.md を書きうるコマンド → 人間に確認する（ask）。ハーネスを直すときは人間が許可する
// 「書きうる」とみなすもの：リダイレクトの先、ファイルを変えるコマンド（cp・mv・rm・tee・sed -i など）の引数、
// 対象のパスを含むその場のスクリプト（node -e、python3 -c、ヒアドキュメント）
// 設定は .claude/settings.json の hooks.PreToolUse。
import fs from "fs";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const cmd = String(input.tool_input?.command ?? "");
if (!cmd) process.exit(0);

const RECORD = /approvals\.yaml/;
const HARNESS = /(^|[\s"'=/])(\.claude\/|CLAUDE\.md)/;
const kind = (s) => (RECORD.test(s) ? "record" : HARNESS.test(s) ? "harness" : null);

const found = [];
// リダイレクトの先（2>&1 などは除く）
for (const m of cmd.matchAll(/(?:^|[^0-9&<])\d?>>?\s*([^\s;|&<>]+)/g)) {
  const k = kind(` ${m[1]}`);
  if (k) found.push([k, `リダイレクトの先 ${m[1]}`]);
}
// ファイルを変えるコマンド
for (const seg of cmd.split(/&&|\|\||[;|\n]/)) {
  const words = seg.trim().split(/\s+/);
  const name = (words[0] ?? "").split("/").pop();
  const writes = ["cp", "mv", "rm", "ln", "tee", "touch", "truncate", "install", "chmod", "rsync", "dd"].includes(name)
    || (name === "sed" && words.some((w) => /^-[a-zA-Z]*i/.test(w)))
    || (name === "perl" && words.some((w) => /^-[a-zA-Z]*i/.test(w)))
    || (name === "git" && ["checkout", "restore", "reset", "rm", "mv", "apply", "stash"].includes(words[1]));
  if (!writes) continue;
  for (const w of words.slice(1)) {
    const k = kind(` ${w}`);
    if (k) found.push([k, `${name} の引数 ${w}`]);
  }
}
// その場のスクリプト
if (/\b(node|deno|bun)\s+(-e|--eval|-p|--print)\b|\bpython3?\s+-c\b|\bruby\s+-e\b|<<-?\s*['"]?\w+/.test(cmd)) {
  const k = kind(cmd);
  if (k) found.push([k, "その場のスクリプトが対象のパスを含む"]);
}
if (!found.length) process.exit(0);

const record = found.some(([k]) => k === "record");
const reason = record
  ? `approvals.yaml は承認の hook だけが書く。AI は Bash でも書かない（${found.map((f) => f[1]).join("、")}）`
  : `ハーネスのファイル（.claude/、CLAUDE.md）を変えうるコマンド。スライド作成中は変えない。ハーネスを直す作業なら、人間が許可する（${found.map((f) => f[1]).join("、")}）`;
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: record ? "deny" : "ask", permissionDecisionReason: reason } }));
