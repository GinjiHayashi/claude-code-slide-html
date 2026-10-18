#!/usr/bin/env node
// 書き込みの検査の hook（PreToolUse・Edit / Write / NotebookEdit）：スライド作成中は、ハーネスのファイル（.claude/、CLAUDE.md）を変える前に人間に確認する（ask）。
// ハーネスの開発中（common.mjs の harnessDev）は確認を出さない。settings.json の ask のルールでは開発中かどうかを分けられないので、hook で行う。
// approvals.yaml と .claude/settings.json は、開発中も settings.json の deny で止める（この hook では見ない）。
// 設定は .claude/settings.json の hooks.PreToolUse。
import fs from "fs";
import path from "path";
import { harnessDev } from "../../../lib/common.mjs";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const file = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? "");
if (!file) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");
if (!(rel === "CLAUDE.md" || rel.startsWith(".claude/"))) process.exit(0);
if (harnessDev(root)) process.exit(0);

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: `ハーネスのファイル（${rel}）を変える操作。スライド作成中は変えない。ハーネスを直す作業なら、人間が許可する`,
    },
  }),
);
