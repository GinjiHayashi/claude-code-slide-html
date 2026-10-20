#!/usr/bin/env node
// 承認の hook（UserPromptSubmit）：承認の依頼（approval-request.yaml）が出ているときに、人間の答えを判定して記録する。
// - 判定は approvals.mjs の judge()（決まった語で判定。AI は使わない）。承認になるのは「OK」「承認します」など短い同意の語だけの答え
//   - 承認：依頼のときから変わっていない対象を approvals.yaml に、答えの原文ごと記録する。依頼は消す
//   - 承認ではない（直す・待つ・疑問など）：記録せず、依頼を消す
//   - 判断できない：記録せず、依頼を残す（AI がもう一度聞く。聞き直す文は決まった文。make-slides の「承認の頼み方」）
//   - PR のマージの依頼（target: merge）は、ファイルの sha256 ではなく、依頼のときの PR の番号・マージ先・head のコミットを記録する。
//     マージは merge.mjs が、この記録と今の PR を突き合わせて行う
// - 結果は AI に伝える（additionalContext）。承認者は git config user.name
// - 依頼は同時に1つのデッキだけ（request.mjs がほかのデッキの依頼を消す）。複数残っていたら、いちばん新しい依頼だけを見て、ほかは消す
//   （「OK」の一言が、別のデッキの古い依頼まで承認してしまわないように）
// - 予約したタスクやサブエージェントの報告など、Claude Code が自分で始めるターンにも hook は動く。それらは「<」で始まる
//   タグに包まれて届くので、「<」で始まるプロンプトは見ない（推測。公式ドキュメントに形の記載はない）
// 設定は .claude/settings.json の hooks.UserPromptSubmit。
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { REQUEST, readRequest, recordApproval, recordMerge, judge, sha256 } from "./approvals.mjs";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const prompt = String(input.prompt ?? "").trim();
if (!prompt || prompt.startsWith("<")) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const decks = path.join(root, "decks");
if (!fs.existsSync(decks)) process.exit(0);
let pending = fs
  .readdirSync(decks)
  .map((d) => path.join(decks, d))
  .filter((d) => fs.existsSync(path.join(d, REQUEST)));
if (!pending.length) process.exit(0);
const lines = [];
if (pending.length > 1) {
  pending.sort((a, b) => String(readRequest(b).requested_at).localeCompare(String(readRequest(a).requested_at)));
  for (const dir of pending.slice(1)) {
    fs.rmSync(path.join(dir, REQUEST));
    lines.push(`decks/${path.basename(dir)}：古い承認の依頼が残っていたので消した（記録していない）。必要なら依頼し直す`);
  }
  pending = pending.slice(0, 1);
}

let by = "";
try {
  by = execFileSync("git", ["-C", root, "config", "user.name"], { encoding: "utf8" }).trim();
} catch {}
const verdict = judge(prompt);
for (const dir of pending) {
  const id = path.basename(dir);
  const req = readRequest(dir);
  if (verdict === "unclear") {
    lines.push(
      `decks/${id}：答えが承認かどうか判断できないので記録しなかった。依頼は残した。答えに別の依頼があれば先に片付け、そのあと人間にこの文のまま伝えて聞き直す：「ほかの言葉が混じっていたので、承認として記録されませんでした。承認なら『承認』だけを送ってください」`,
    );
    continue;
  }
  fs.rmSync(path.join(dir, REQUEST));
  if (verdict === "reject") {
    lines.push(`decks/${id}：答えは承認ではないと判定した（直す・待つ・疑問の言葉がある）。記録せず、依頼を消した`);
    continue;
  }
  if (!by) {
    lines.push(`decks/${id}：承認者がわからない（git config user.name が空）。記録しなかった`);
    continue;
  }
  for (const t of req.targets) {
    if (t.target === "merge") {
      recordMerge(dir, t, { approved_by: by, approved_at: new Date().toISOString(), answer: prompt.slice(0, 200), session_id: input.session_id ?? null });
      lines.push(
        `decks/${id}：PR #${t.pr} の ${t.base} へのマージの承認を記録した（head ${String(t.head_sha).slice(0, 7)}、承認者 ${by}）。merge.mjs decks/${id} ${t.pr} でマージする`,
      );
      continue;
    }
    const f = path.join(dir, t.target);
    if (!fs.existsSync(f) || sha256(fs.readFileSync(f)) !== t.sha256) {
      lines.push(`decks/${id}/${t.target}：依頼のあとに変わったので記録しなかった。依頼し直す`);
      continue;
    }
    const { entry, changed } = recordApproval(dir, t.target, {
      approved_by: by,
      approved_at: new Date().toISOString(),
      answer: prompt.slice(0, 200),
      session_id: input.session_id ?? null,
      prompt_id: input.prompt_id ?? null,
    });
    lines.push(`decks/${id}/${t.target}：承認を記録した（sha256 ${entry.sha256.slice(0, 12)}…、承認者 ${by}、${changed}）`);
  }
}
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: `承認の hook の結果：\n${lines.join("\n")}` } }));
