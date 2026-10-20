#!/usr/bin/env node
// 変更の検出の hook（SessionStart・Stop）：会話の中でハーネスのファイル（.claude/、CLAUDE.md）が変わったら、AI に人間へ報告させる。
// settings.json のルールと protect-bash.mjs をすり抜けた変更（スクリプトの中の書き込み、確認を飛ばすモードなど）も、
// ファイルの中身を比べるので見つけられる。最後の守り。
// 使い方（settings.json から呼ぶ）：protect-check.mjs start ／ protect-check.mjs stop
// - start：会話の始めに、ハーネスのファイルの sha256 を一時フォルダに控える
// - stop：ターンの終わりに今の sha256 と比べ、変わったファイルがあれば、止めて（decision: block）理由を AI に返す。
//   同じ中身の変更は一度だけ伝える（ハーネスを直す作業で、毎ターン止めないように）
// - 人間が許可した変更は伝えない：前のターンの終わりから、会話の記録（transcript_path）に、そのファイルへの Edit・Write・NotebookEdit が
//   成功したと残っていれば、許可された変更として覚え（told）、伝えない（protect-edit.mjs の確認に人間が答えた変更）。
//   同じターンに、同じファイルを Bash でも書いた場合は見分けられない。確認を飛ばすモード（permission_mode が bypassPermissions）では、
//   人間が答えていないので、許可された変更として扱わない
// - node_modules、settings.local.json、worktrees（作業用の複製）、デザインの見本の元資料（git 管理外）は比べない
// - ハーネスの開発中（common.mjs の harnessDev）は、.claude/settings.json だけを伝える（ほかのファイルは直すのが仕事なので伝えない）
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { harnessDev } from "../../../lib/common.mjs";

const mode = process.argv[2];
const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const id = crypto
  .createHash("sha256")
  .update(`${root}\n${input.session_id ?? ""}`)
  .digest("hex")
  .slice(0, 16);
const stateFile = path.join(os.tmpdir(), "slide-harness-protect", `${id}.json`);
const SKIP = new Set(["node_modules", "settings.local.json", "worktrees", ".DS_Store"]);

function snapshot() {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name) || /^source\./.test(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out[path.relative(root, p)] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    }
  };
  if (fs.existsSync(path.join(root, ".claude"))) walk(path.join(root, ".claude"));
  const md = path.join(root, "CLAUDE.md");
  if (fs.existsSync(md)) out["CLAUDE.md"] = crypto.createHash("sha256").update(fs.readFileSync(md)).digest("hex");
  return out;
}
const save = (s) => {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(s));
};

// 会話の記録の offset バイト目から後で、成功した Edit・Write・NotebookEdit が書いたファイル（root からの相対パス）
function toolEdits(transcript, offset = 0) {
  if (!transcript || !fs.existsSync(transcript)) return { files: new Set(), size: offset };
  const buf = fs.readFileSync(transcript);
  const uses = new Map();
  const files = new Set();
  for (const line of buf.subarray(Math.min(offset, buf.length)).toString("utf8").split("\n")) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const content = Array.isArray(e?.message?.content) ? e.message.content : [];
    for (const c of content) {
      if (c.type === "tool_use" && ["Edit", "Write", "NotebookEdit"].includes(c.name)) uses.set(c.id, c.input?.file_path ?? c.input?.notebook_path);
      if (c.type === "tool_result" && uses.has(c.tool_use_id) && !c.is_error)
        files.add(path.relative(root, path.resolve(root, String(uses.get(c.tool_use_id)))));
    }
  }
  return { files, size: buf.length };
}

if (mode === "start" || !fs.existsSync(stateFile)) {
  save({ base: snapshot(), told: {}, offset: toolEdits(input.transcript_path).size });
  process.exit(0);
}
if (mode !== "stop" || input.stop_hook_active) process.exit(0);

const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const now = snapshot();
const dev = harnessDev(root);
const edits = toolEdits(input.transcript_path, state.offset ?? 0);
if (input.permission_mode === "bypassPermissions") edits.files.clear();
state.offset = edits.size;
const changed = [...new Set([...Object.keys(state.base), ...Object.keys(now)])]
  .filter((f) => !dev || f === path.join(".claude", "settings.json"))
  .filter((f) => state.base[f] !== now[f] && state.told[f] !== (now[f] ?? "deleted"))
  .sort();
for (const f of changed) state.told[f] = now[f] ?? "deleted";
save(state);
const unasked = changed.filter((f) => !edits.files.has(f)); // 許可された Edit などでない変更だけを伝える
if (!unasked.length) process.exit(0);
const list = unasked.map((f) => `${f}（${!state.base[f] ? "増えた" : !now[f] ? "消えた" : "変わった"}）`).join("、");
console.log(
  JSON.stringify({
    decision: "block",
    reason: `この会話の中で、ハーネスのファイルが変わった：${list}。スライド作成中は固定ファイルを変えない（CLAUDE.md）。人間が許可したハーネスの修正でなければ、変えたことと理由を人間に伝え、元に戻すかを聞く。許可された修正なら、そのまま答えを終えてよい。`,
  }),
);
