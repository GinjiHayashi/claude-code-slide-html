#!/usr/bin/env node
// 承認ゲート：次の工程に進んでよいかを、approvals.yaml とファイルの sha256 だけで判定する（要求文書 4章・11章）。
// AI の自己申告では判定しない。
// 使い方：node .claude/skills/make-slides/scripts/gate.mjs decks/<deck-id> <outline|factcheck|build>
// - outline：brief.md が承認済み
// - factcheck：brief.md と outline.md が承認済み
// - build：outline.md と factcheck.md が承認済みで、factcheck.md の P0 にすべて「人間の判断」が書かれている
// 「承認済み」＝ approvals.yaml の最後の承認の sha256 が、今のファイルと一致する。違えば「承認後に変更あり」
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sha256, slideHashes, readApprovals, latest } from "./approvals.mjs";

const NEEDS = {
  outline: ["brief.md"],
  factcheck: ["brief.md", "outline.md"],
  build: ["outline.md", "factcheck.md"],
};

// factcheck.md の表から、P0 で「人間の判断」が空の行を探す（要求文書 8.2 の表）
export function openP0(text) {
  const rows = text.split("\n").filter((l) => l.trim().startsWith("|"));
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const open = [];
  let col = null;
  for (const l of rows) {
    const c = cells(l);
    if (c.includes("区分") && c.includes("人間の判断")) { col = { kind: c.indexOf("区分"), judge: c.indexOf("人間の判断"), id: 0 }; continue; }
    if (!col || /^[-:\s]+$/.test(c.join(""))) continue;
    if (c[col.kind] === "P0" && ["", "—", "-", "未"].includes(c[col.judge] ?? "")) open.push(c[col.id]);
  }
  return open;
}

export function checkGate(deckDir, stage) {
  const errors = [];
  const approvals = readApprovals(deckDir);
  for (const target of NEEDS[stage]) {
    const file = path.join(deckDir, target);
    if (!fs.existsSync(file)) { errors.push(`${target} がない`); continue; }
    const a = latest(approvals, target);
    if (!a) { errors.push(`${target} が承認されていない（人間がプロンプトに「承認 ${target}」と打つ）`); continue; }
    const text = fs.readFileSync(file);
    if (a.sha256 === sha256(text)) continue;
    let where = "";
    if (a.slides) {
      const now = slideHashes(text.toString("utf8"));
      const ids = new Set([...Object.keys(a.slides), ...Object.keys(now)]);
      where = `。変わったところ：${[...ids].filter((k) => a.slides[k] !== now[k]).join("、")}`;
    }
    errors.push(`${target} が承認後に変更されている（承認：${a.approved_by}、${a.approved_at}）${where}`);
  }
  if (stage === "build" && fs.existsSync(path.join(deckDir, "factcheck.md"))) {
    const open = openP0(fs.readFileSync(path.join(deckDir, "factcheck.md"), "utf8"));
    if (open.length) errors.push(`factcheck.md の P0 に「人間の判断」がない：${open.join("、")}`);
  }
  return { ok: !errors.length, errors };
}

// コマンドとして呼ばれたとき
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const [deckDir, stage] = process.argv.slice(2);
  if (!deckDir || !NEEDS[stage]) { console.error(`使い方：node gate.mjs decks/<deck-id> <${Object.keys(NEEDS).join("|")}>`); process.exit(2); }
  const r = checkGate(deckDir, stage);
  for (const e of r.errors) console.log(`止める  ${e}`);
  console.log(r.ok ? `${stage} に進んでよい` : `${stage} に進めない`);
  process.exit(r.ok ? 0 : 1);
}
