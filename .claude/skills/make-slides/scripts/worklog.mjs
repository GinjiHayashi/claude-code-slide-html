#!/usr/bin/env node
// 作業記録：いつ・どの工程で・何をしていたかを、デッキの worklog.jsonl に1行ずつ足す。あとで worklog-report.mjs で集計する
// - hook（.claude/settings.json の SessionStart・UserPromptSubmit・Stop・SubagentStop）：node worklog.mjs hook
//   人間が書いた時刻（prompt）、AI が返事を終えた時刻（stop）、セッションの始まり（session。ハーネスの版を残す）、サブエージェントの終わり（subagent）
// - スクリプトから：appendWork(deckDir, { event: "build", … })。build.mjs（ビルドの結果）と request.mjs（承認の依頼）が書く
// - どのデッキかは、ブランチ名 feature/<deck-id>（直しの feature/<deck-id>-fix も）で決める（make-slides/git.md）。わからなければ何も書かない
// - 人間の発言の本文は書かない（機密を増やさない。承認の答えは approvals.yaml にある）
// - 記録に失敗しても作業は止めない（hook は必ず終了コード 0 で終わる）
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { isMain } from "../../../lib/common.mjs";
import { deckStatus } from "./status.mjs";

export const WORKLOG = "worklog.jsonl";

// 1行を足す。stage を渡さなければ、今の工程（status.mjs）を入れる
export function appendWork(deckDir, entry) {
  try {
    // デッキ（decks/<deck-id>/）だけに書く。見本（examples/）のビルドでは書かない
    if (!fs.existsSync(deckDir) || path.basename(path.dirname(path.resolve(deckDir))) !== "decks") return;
    const stage = entry.stage ?? currentStage(deckDir);
    const line = { at: new Date().toISOString(), ...entry, ...(stage ? { stage } : {}) };
    fs.appendFileSync(path.join(deckDir, WORKLOG), JSON.stringify(line) + "\n");
  } catch {
    // 記録できなくても止めない
  }
}

// 今の工程（status.mjs の「工程」）
function currentStage(deckDir) {
  try {
    return deckStatus(deckDir, { sources: false }).stage; // 資料の検査は工程の判定に要らない（毎ターン重くしない）
  } catch {
    return undefined;
  }
}

export function readWork(deckDir) {
  const f = path.join(deckDir, WORKLOG);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}

const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

// 今のブランチ feature/<deck-id> のデッキのフォルダ。完成後の直しのブランチ feature/<deck-id>-fix（-fix2…。branch.mjs）も同じデッキ
export function currentDeck(root) {
  try {
    const m = git(root, "branch", "--show-current").match(/^feature\/(.+?)(?:-fix\d*)?$/);
    const dir = m && path.join(root, "decks", m[1]);
    return dir && fs.existsSync(dir) ? dir : null;
  } catch {
    return null;
  }
}

// ハーネスの版：.claude/ と CLAUDE.md を最後に変えたコミット
function harnessVersion(root) {
  try {
    return git(root, "log", "-1", "--format=%h", "--", ".claude", "CLAUDE.md") || undefined;
  } catch {
    return undefined;
  }
}

// そのターン（最後の人間の発言から後）に AI が使ったツールの回数、変えたファイル、トークン数とモデル。
// 会話の記録（transcript_path）の書式は公開の仕様ではないので、読めたものだけを返す（推測。読めなければ空）
export function turnSummary(transcriptPath) {
  try {
    const rows = fs
      .readFileSync(transcriptPath, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    const human = (r) =>
      r.type === "user" && (typeof r.message?.content === "string" || (Array.isArray(r.message?.content) && r.message.content.some((c) => c.type === "text")));
    let start = 0;
    rows.forEach((r, i) => human(r) && (start = i));
    const tools = {};
    const files = new Set();
    const tokens = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
    let model;
    for (const r of rows.slice(start)) {
      if (r.type !== "assistant") continue;
      model = r.message?.model ?? model;
      const u = r.message?.usage ?? {};
      tokens.input += u.input_tokens ?? 0;
      tokens.output += u.output_tokens ?? 0;
      tokens.cache_read += u.cache_read_input_tokens ?? 0;
      tokens.cache_write += u.cache_creation_input_tokens ?? 0;
      for (const c of Array.isArray(r.message?.content) ? r.message.content : []) {
        if (c.type !== "tool_use") continue;
        tools[c.name] = (tools[c.name] ?? 0) + 1;
        if (c.input?.file_path) files.add(c.input.file_path);
      }
    }
    return {
      ...(Object.keys(tools).length ? { tools } : {}),
      ...(files.size ? { files: [...files] } : {}),
      ...(tokens.input + tokens.output ? { tokens } : {}),
      ...(model ? { model } : {}),
    };
  } catch {
    return {};
  }
}

const EVENTS = { SessionStart: "session", UserPromptSubmit: "prompt", Stop: "stop", SubagentStop: "subagent" };

export function hook(input) {
  const event = EVENTS[input.hook_event_name];
  if (!event) return;
  // Claude Code が自分で始めるターン（予約したタスクなど）は「<」で始まるタグに包まれて届く（approve-hook.mjs と同じ。推測）
  if (
    event === "prompt" &&
    String(input.prompt ?? "")
      .trim()
      .startsWith("<")
  )
    return;
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const deckDir = currentDeck(root);
  if (!deckDir) return;
  const rel = (f) => (path.isAbsolute(f) ? path.relative(root, f) : f);
  const extra =
    event === "session"
      ? { harness: harnessVersion(root) }
      : event === "stop" && input.transcript_path
        ? (({ files, ...s }) => ({ ...s, ...(files ? { files: files.map(rel) } : {}) }))(turnSummary(input.transcript_path))
        : event === "subagent" && input.agent_type
          ? { agent: input.agent_type }
          : {};
  appendWork(deckDir, { event, session: input.session_id, ...extra });
}

if (isMain(import.meta.url) && process.argv[2] === "hook") {
  try {
    hook(JSON.parse(fs.readFileSync(0, "utf8") || "{}"));
  } catch {
    // 記録に失敗しても作業は止めない
  }
  process.exit(0);
}
