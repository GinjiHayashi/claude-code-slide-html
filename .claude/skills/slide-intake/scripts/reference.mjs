#!/usr/bin/env node
// 資料の md 化（reference/）：人が inputs/ に置いた元の資料を md にして reference/ に入れる。以降の工程は reference/ だけを読む
// 使い方：
//   node .claude/skills/slide-intake/scripts/reference.mjs decks/<deck-id>             … 今の状態を一覧にする（変えない）
//   node .claude/skills/slide-intake/scripts/reference.mjs decks/<deck-id> --convert   … まだの資料・変わった資料を md にし、index.md を作り直す
//   node .claude/skills/slide-intake/scripts/reference.mjs decks/<deck-id> --index     … index.md だけを作り直す（AI が summary を書いたあと）
//   node .claude/skills/slide-intake/scripts/reference.mjs decks/<deck-id> --check     … 検査（エラーなら終了コード 2）
// - inputs/ は git の管理外（元の資料を共有しないため）。reference/ は git で管理する。inputs/ がない端末では、md だけで検査を通す
// - 1つの資料＝1つの md。ID は R-001 から順に付け、変わらない（資料が変わったら同じ ID のまま作り直す）
//   - チャットの原文（inputs/chat-YYYY-MM-DD.md）は reference/chat/、ほかは reference/sources/ に入れる
//   - 先頭の設定：id・source（inputs/ からのパス）・sha256・format・method（機械（to-md.py）か AI の読み取り）・converted_at・summary
// - 機械で読めるもの（Excel・Word・PowerPoint・文字のある PDF・テキスト）は to-md.py が変換する。数値を AI が書き写さない
// - 読めないもの（画像・スキャンした PDF）は、method: AI の読み取り の md のひな形を作る。AI が Read で読んで、文字の書き起こしと図の説明を書き、
//   本文の印（AI_READ_TODO）を消す。そこの数値はヒアリングで人に確かめる
// - 検査（エラー）：inputs/ にあるのに md がない、sha256 が合わない（資料が変わった）、AI の読み取りが終わっていない、
//   先頭の設定が足りない、ID の重複、index.md が古い。注意：summary が空、md の元の資料が inputs/ にも assets/ にもない（ほかの端末で変換したもの）
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { isMain, python, sha256File, frontMatter } from "../../../lib/common.mjs";

const TO_MD = path.join(path.dirname(fileURLToPath(import.meta.url)), "to-md.py");
export const AI_READ_TODO = "AI_READ_TODO";
const FIELDS = ["id", "source", "sha256", "format", "method", "converted_at"];
export const METHODS = { machine: "機械（to-md.py）", ai: "AI の読み取り" };

const rel = (deckDir, f) => path.relative(deckDir, f).split(path.sep).join("/");
const today = () => new Date().toISOString().slice(0, 10);

// inputs/ の元の資料（隠しファイルは除く）
export function inputFiles(deckDir) {
  const dir = path.join(deckDir, "inputs");
  if (!fs.existsSync(dir)) return null;
  return fs
    .readdirSync(dir, { recursive: true })
    .map((f) => `inputs/${String(f).split(path.sep).join("/")}`)
    .filter((f) => !f.split("/").some((x) => x.startsWith(".")) && fs.statSync(path.join(deckDir, f)).isFile())
    .sort();
}

// reference/sources/ と reference/chat/ の md（先頭の設定つき）
export function readSources(deckDir) {
  const out = [];
  for (const sub of ["sources", "chat"]) {
    const dir = path.join(deckDir, "reference", sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".md"))
      .sort()) {
      const file = path.join(dir, name);
      const text = fs.readFileSync(file, "utf8");
      const m = frontMatter(text);
      let meta = {};
      try {
        meta = (m && YAML.parse(m[1])) ?? {};
      } catch {
        meta = {};
      }
      out.push({ file: rel(deckDir, file), meta, text });
    }
  }
  return out;
}

// 元の資料ごとの状態：converted（済み）・new（まだ）・changed（変わった）。md の元がないもの：orphan
export function referenceStatus(deckDir) {
  const inputs = inputFiles(deckDir);
  const sources = readSources(deckDir);
  const bySource = new Map(sources.map((s) => [s.meta.source, s]));
  const items = (inputs ?? []).map((f) => {
    const s = bySource.get(f);
    const sha = sha256File(path.join(deckDir, f));
    return { source: f, sha256: sha, md: s?.file ?? null, id: s?.meta.id ?? null, state: !s ? "new" : s.meta.sha256 === sha ? "converted" : "changed" };
  });
  // スライドに載せる画像は inputs/ から assets/ に移す（コピーしない）。移したものは、assets/ の同じ名前・同じ sha256 のファイルで確かめる
  const moved = (s) => {
    const f = path.join(deckDir, "assets", path.basename(String(s.meta.source ?? "")));
    return fs.existsSync(f) && sha256File(f) === s.meta.sha256;
  };
  const orphan = inputs ? sources.filter((s) => !inputs.includes(s.meta.source) && !moved(s)) : [];
  return { inputs: inputs !== null, items, sources, orphan };
}

const nextId = (sources) => {
  const n = Math.max(0, ...sources.map((s) => Number(String(s.meta.id ?? "").match(/^R-(\d+)$/)?.[1] ?? 0)));
  return `R-${String(n + 1).padStart(3, "0")}`;
};
const slug = (f) =>
  path
    .basename(f, path.extname(f))
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .slice(0, 60);

// 1つの資料を md にする。戻り値：書いた md のパス（デッキのフォルダから）と method
function convertOne(deckDir, item, id) {
  const src = path.join(deckDir, item.source);
  const chat = /^chat-.*\.md$/.test(path.basename(item.source));
  const sub = chat ? "chat" : "sources";
  const file = item.md ? path.join(deckDir, item.md) : path.join(deckDir, "reference", sub, `${id}-${slug(item.source)}.md`);
  let body,
    method = METHODS.machine;
  try {
    body = execFileSync(python(), [TO_MD, src], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    if (e.status !== 3) throw new Error(`${item.source} を変換できない：${String(e.stderr ?? e.message).trim()}`);
    method = METHODS.ai;
    body = [
      `<!-- ${AI_READ_TODO}：AI が Read で ${item.source} を読み、文字の書き起こしと図・写真の説明をここに書く。書いたらこの行を消す -->`,
      "",
      "> この md は AI の読み取り。数値と固有名詞は、ヒアリングで人に確かめる。",
    ].join("\n");
  }
  // 作り直すときも、AI が書いた summary は残す（資料が変わったら AI が見直す）
  const old = item.md ? readSources(deckDir).find((s) => s.file === item.md)?.meta : null;
  const meta = {
    id,
    source: item.source,
    sha256: item.sha256,
    format: path.extname(item.source).slice(1).toLowerCase() || "なし",
    method,
    converted_at: today(),
    summary: old?.summary ?? "",
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\n${YAML.stringify(meta)}---\n\n# ${id} ${path.basename(item.source)}\n\n${body}\n`);
  return { md: rel(deckDir, file), method };
}

// index.md：md の先頭の設定から作る（手で直さない）
export function indexText(deckDir) {
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
  const sources = readSources(deckDir).sort((a, b) => String(a.meta.id).localeCompare(String(b.meta.id)));
  const lines = [
    "# 資料の一覧（reference/index.md）",
    "",
    "reference.mjs が reference/sources/・reference/chat/ の md の先頭の設定から作る。手で直さない（summary は各 md に書き、--index で作り直す）。",
    "元の資料（inputs/）は git に入れない。以降の工程は、この一覧と md だけを読む。AI の調査は research.md。",
    "",
    "| ID | md | 元の資料 | 形式 | 変換 | 日付 | 要約 |",
    "|---|---|---|---|---|---|---|",
    ...sources.map(
      (s) =>
        `| ${esc(s.meta.id)} | ${esc(s.file.replace(/^reference\//, ""))} | ${esc(s.meta.source)} | ${esc(s.meta.format)} | ${esc(s.meta.method)} | ${esc(s.meta.converted_at)} | ${esc(s.meta.summary)} |`,
    ),
  ];
  return lines.join("\n") + "\n";
}
const writeIndex = (deckDir) => {
  fs.mkdirSync(path.join(deckDir, "reference"), { recursive: true });
  fs.writeFileSync(path.join(deckDir, "reference", "index.md"), indexText(deckDir));
};

export function convert(deckDir) {
  const st = referenceStatus(deckDir);
  if (!st.inputs) return { done: [], errors: ["inputs/ がない（元の資料がない端末では変換しない）"] };
  const done = [],
    errors = [];
  for (const item of st.items.filter((i) => i.state !== "converted")) {
    try {
      const id = item.id ?? nextId(readSources(deckDir));
      done.push({ ...item, id, ...convertOne(deckDir, item, id) });
    } catch (e) {
      errors.push(e.message);
    }
  }
  writeIndex(deckDir);
  return { done, errors };
}

export function checkReference(deckDir) {
  const st = referenceStatus(deckDir);
  const errors = [],
    warnings = [];
  for (const i of st.items) {
    if (i.state === "new") errors.push(`${i.source} の md がない（reference.mjs --convert で作る）`);
    if (i.state === "changed") errors.push(`${i.source} が md にしたあとで変わった（sha256 が違う）。--convert で作り直し、summary を見直す`);
  }
  const ids = new Map();
  for (const s of st.sources) {
    const missing = FIELDS.filter((k) => !s.meta[k]);
    if (missing.length) errors.push(`${s.file}：先頭の設定に ${missing.join("・")} がない`);
    if (s.meta.id && !/^R-\d{3,}$/.test(s.meta.id)) errors.push(`${s.file}：id「${s.meta.id}」は R-001 の形にする`);
    if (ids.has(s.meta.id)) errors.push(`${s.file}：id「${s.meta.id}」が ${ids.get(s.meta.id)} と重複している`);
    ids.set(s.meta.id, s.file);
    if (s.text.includes(AI_READ_TODO)) errors.push(`${s.file}：AI の読み取りが終わっていない（Read で読んで書き、${AI_READ_TODO} の行を消す）`);
    if (!String(s.meta.summary ?? "").trim()) warnings.push(`${s.file}：summary（1行の要約）が空`);
  }
  for (const s of st.orphan) warnings.push(`${s.file}：元の資料 ${s.meta.source} が inputs/ にも assets/ にもない（ほかの端末で変換したものなら問題ない）`);
  const idx = path.join(deckDir, "reference", "index.md");
  if (st.sources.length && (!fs.existsSync(idx) || fs.readFileSync(idx, "utf8") !== indexText(deckDir)))
    errors.push("reference/index.md が md の先頭の設定と合わない（reference.mjs --index で作り直す）");
  return { errors, warnings, status: st };
}

if (isMain(import.meta.url)) {
  const [deckDir, flag] = process.argv.slice(2);
  if (!deckDir || (flag && !["--convert", "--index", "--check"].includes(flag))) {
    console.error("使い方：node reference.mjs decks/<deck-id> [--convert|--index|--check]");
    process.exit(2);
  }
  if (flag === "--convert") {
    const r = convert(deckDir);
    for (const d of r.done) console.log(`${d.id}：${d.source} → ${d.md}（${d.method}）`);
    if (!r.done.length && !r.errors.length) console.log("変換する資料はない");
    const ai = r.done.filter((d) => d.method === METHODS.ai);
    if (ai.length) console.log(`AI が Read で読んで書くもの：${ai.map((d) => d.md).join("、")}`);
    for (const e of r.errors) console.error(`エラー：${e}`);
    process.exit(r.errors.length ? 2 : 0);
  }
  if (flag === "--index") {
    writeIndex(deckDir);
    console.log("reference/index.md を作り直した");
    process.exit(0);
  }
  const r = checkReference(deckDir);
  if (!flag) {
    const label = { converted: "済み", new: "まだ", changed: "変わった" };
    if (!r.status.inputs) console.log("inputs/ がない（md だけで確かめる）");
    for (const i of r.status.items) console.log(`- ${i.source}：${label[i.state]}${i.md ? `（${i.md}）` : ""}`);
  }
  for (const w of r.warnings) console.log(`注意：${w}`);
  for (const e of r.errors) console.error(`エラー：${e}`);
  process.exit(flag === "--check" && r.errors.length ? 2 : 0);
}
