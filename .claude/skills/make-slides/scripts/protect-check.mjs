#!/usr/bin/env node
// 変更の検出の hook（SessionStart・Stop）：会話の中でハーネスのファイル（.claude/、CLAUDE.md）が変わったら、AI に人間へ報告させる（要求文書 9.1、Q6。構築順序10）。
// settings.json のルールと protect-bash.mjs をすり抜けた変更（スクリプトの中の書き込み、確認を飛ばすモードなど）も、
// ファイルの中身を比べるので見つけられる。最後の守り。
// 使い方（settings.json から呼ぶ）：protect-check.mjs start ／ protect-check.mjs stop
// - start：会話の始めに、ハーネスのファイルの sha256 を一時フォルダに控える
// - stop：ターンの終わりに今の sha256 と比べ、変わったファイルがあれば、止めて（decision: block）理由を AI に返す。
//   同じ中身の変更は一度だけ伝える（ハーネスを直す作業で、毎ターン止めないように）
// - node_modules、settings.local.json、デザインの見本の元資料（git 管理外）は比べない
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

const mode = process.argv[2];
const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const id = crypto.createHash("sha256").update(`${root}\n${input.session_id ?? ""}`).digest("hex").slice(0, 16);
const stateFile = path.join(os.tmpdir(), "slide-harness-protect", `${id}.json`);
const SKIP = new Set(["node_modules", "settings.local.json", ".DS_Store"]);

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
const save = (s) => { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s)); };

if (mode === "start" || !fs.existsSync(stateFile)) {
  save({ base: snapshot(), told: {} });
  process.exit(0);
}
if (mode !== "stop" || input.stop_hook_active) process.exit(0);

const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const now = snapshot();
const changed = [...new Set([...Object.keys(state.base), ...Object.keys(now)])]
  .filter((f) => state.base[f] !== now[f] && state.told[f] !== (now[f] ?? "deleted"))
  .sort();
if (!changed.length) process.exit(0);
for (const f of changed) state.told[f] = now[f] ?? "deleted";
save(state);
const list = changed.map((f) => `${f}（${!state.base[f] ? "増えた" : !now[f] ? "消えた" : "変わった"}）`).join("、");
console.log(JSON.stringify({
  decision: "block",
  reason: `この会話の中で、ハーネスのファイルが変わった：${list}。スライド作成中は固定ファイルを変えない（CLAUDE.md）。人間が許可したハーネスの修正でなければ、変えたことと理由を人間に伝え、元に戻すかを聞く。許可された修正なら、そのまま答えを終えてよい。`,
}));
