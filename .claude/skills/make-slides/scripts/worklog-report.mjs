#!/usr/bin/env node
// 作業記録の集計：worklog.jsonl（worklog.mjs が足す）から、工程ごとの時間とやり取りの回数を表にする。ファイルには書かず、画面に出す
// 使い方：node .claude/skills/make-slides/scripts/worklog-report.mjs decks/<deck-id> [--json]
// - AI の作業時間：人間が書いてから（prompt）、AI が返事を終えるまで（stop）。人間が書いたときの工程に数える
// - 人の待ち時間：AI が返事を終えてから、人間が次に書くまで。返事を終えたときの工程に数える
// - 「承認の確認」（答え待ち）は、その前の工程に数える（どの工程の承認を待っていたかがわかるように）
// - 戻り：工程が前の工程に戻った回数（直すとき。make-slides の「直すとき」）
// - 承認の聞き直し：同じ対象の依頼の回数から、承認された回数を引いたもの（approvals.yaml と突き合わせる）
// - 時刻はすべて記録のとおり（UTC）。計算は引き算と足し算だけ
import path from "path";
import { isMain } from "../../../lib/common.mjs";
import { readWork } from "./worklog.mjs";
import { readApprovals } from "./approvals.mjs";

// status.mjs の工程の順（数字の小さい順）。「承認の確認」「完成」はここで扱う
const order = (stage) => (stage === "完成" ? 99 : (parseFloat(String(stage).replace(/^(\d+)([ab]?).*/, (_, n, s) => n + (s === "b" ? ".5" : ""))) ?? -1));

export function report(deckDir) {
  const rows = readWork(deckDir);
  // 「承認の確認」は直前の工程に寄せる
  let last;
  for (const r of rows) {
    if (!r.stage || r.stage === "承認の確認") r.stage = last ?? r.stage ?? "不明";
    else last = r.stage;
  }
  const stages = new Map();
  const get = (s) => {
    if (!stages.has(s)) stages.set(s, { stage: s, start: null, end: null, ai_ms: 0, wait_ms: 0, turns: 0, builds: 0, builds_ok: 0, subagents: 0 });
    return stages.get(s);
  };
  let prompt = null;
  let stop = null;
  let back = 0;
  let prev;
  const sessions = new Set();
  const harness = new Set();
  const tokens = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
  const requests = {};
  for (const r of rows) {
    const s = get(r.stage);
    s.start ??= r.at;
    s.end = r.at;
    if (prev !== undefined && order(r.stage) < order(prev)) back++;
    prev = r.stage;
    if (r.session) sessions.add(r.session);
    if (r.event === "session" && r.harness) harness.add(r.harness);
    if (r.event === "prompt") {
      if (stop) get(stop.stage).wait_ms += Date.parse(r.at) - Date.parse(stop.at);
      prompt = r;
      stop = null;
    } else if (r.event === "stop") {
      if (prompt) {
        const p = get(prompt.stage);
        p.ai_ms += Date.parse(r.at) - Date.parse(prompt.at);
        p.turns++;
      }
      for (const k of Object.keys(tokens)) tokens[k] += r.tokens?.[k] ?? 0;
      prompt = null;
      stop = r;
    } else if (r.event === "build") {
      s.builds++;
      if (r.ok) s.builds_ok++;
    } else if (r.event === "subagent") s.subagents++;
    else if (r.event === "request") for (const t of r.targets ?? []) requests[t] = (requests[t] ?? 0) + 1;
  }
  const approvals = readApprovals(deckDir);
  const approved = (t) => approvals.filter((a) => a.target === t).length;
  return {
    deck: path.basename(path.resolve(deckDir)),
    stages: [...stages.values()],
    back,
    sessions: sessions.size,
    harness: [...harness],
    tokens: tokens.input + tokens.output ? tokens : null,
    requests: Object.entries(requests).map(([target, n]) => ({ target, requests: n, approved: approved(target), reasked: Math.max(0, n - approved(target)) })),
  };
}

const min = (ms) => (ms ? `${Math.round(ms / 60000)}分` : "—");
const time = (iso) => (iso ? iso.replace("T", " ").slice(0, 16) : "—");

if (isMain(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("使い方：node worklog-report.mjs decks/<deck-id> [--json]");
    process.exit(2);
  }
  const r = report(dir);
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else if (!r.stages.length) console.log(`${r.deck}：作業記録（worklog.jsonl）がない`);
  else {
    console.log(`# 作業記録：${r.deck}\n`);
    console.log("| 工程 | 開始（UTC） | 終了（UTC） | AI の作業時間 | 人の待ち時間 | やり取り | ビルド（合格） | サブエージェント |");
    console.log("|---|---|---|---|---|---|---|---|");
    for (const s of r.stages)
      console.log(
        `| ${s.stage} | ${time(s.start)} | ${time(s.end)} | ${min(s.ai_ms)} | ${min(s.wait_ms)} | ${s.turns} | ${s.builds ? `${s.builds}（${s.builds_ok}）` : "—"} | ${s.subagents || "—"} |`,
      );
    console.log("");
    console.log(`- 工程の戻り：${r.back}回`);
    console.log(`- セッション：${r.sessions}`);
    if (r.harness.length) console.log(`- ハーネスの版：${r.harness.join("、")}`);
    for (const q of r.requests) console.log(`- 承認の依頼：${q.target} ${q.requests}回（承認 ${q.approved}回、聞き直し ${q.reasked}回）`);
    if (r.tokens)
      console.log(
        `- トークン：入力 ${r.tokens.input}、出力 ${r.tokens.output}、キャッシュ読み込み ${r.tokens.cache_read}、キャッシュ書き込み ${r.tokens.cache_write}`,
      );
  }
}
