#!/usr/bin/env node
// factcheck.md のチェック：書式と、区分・根拠・人間の判断の食い違いを出す。
// 使い方：node .claude/skills/slide-factcheck/scripts/check-factcheck.mjs decks/<deck-id>/factcheck.md
// - 書式は slide-factcheck/factcheck-template.md。「## FC-101」ごとに「- 項目: 値」の YAML の箇条書き
// - 根拠の出典は research.md と同じきまり（check-research.mjs の checkSource）
// - 戻り値：{ errors, findings: [{ id, line, fields }], waiting: [判断が空の P0 の ID] }
// - 終了コード：0＝合格、1＝判断待ちの P0 がある、2＝エラーあり
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { fileURLToPath } from "url";
import { checkSource, bannedDomains } from "../../research-standards/scripts/check-research.mjs";
import { empty, frontMatter, isMain } from "../../../lib/common.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const LEVEL = ["P0", "P1", "要確認"];
const DECISION = ["修正する", "残す", "削除する", "出典を足す"];
const REQUIRED = ["slide", "claim_id", "target", "level", "problem"];
const OPTIONAL = ["sources", "suggestion", "decision", "decision_note"];
const OTHER = ["信頼して使う資料", "問題がなかった記述", "検索の記録"]; // 指摘以外の見出し（自由に書く）
// round：どの回のファクトチェックか（brief.md の factcheck が「構成のあとと最後の2回」のときに書く。書かなければ「最後」）
export const ROUND = ["構成のあと", "最後"];

export function checkFactcheck(text, banned = bannedDomains()) {
  const errors = [];
  const m = frontMatter(text);
  if (!m) errors.push("先頭に --- で囲んだ設定（deck_id）がない");
  else {
    try {
      const meta = YAML.parse(m[1]) ?? {};
      if (!meta.deck_id) errors.push("先頭の設定に deck_id がない");
      if (meta.round !== undefined && !ROUND.includes(meta.round)) errors.push(`先頭の設定の round は ${ROUND.join("・")} のどちらか`);
    } catch (e) {
      errors.push(`先頭の設定が YAML として読めない：${e.message.split("\n")[0]}`);
    }
  }
  const offset = m ? m[0].split("\n").length - 1 : 0;
  const body = (m ? text.slice(m[0].length) : text).split("\n");
  const parts = [];
  body.forEach((l, i) => {
    const h = l.match(/^## (.+?)\s*$/);
    if (h) parts.push({ id: h[1], line: offset + i + 1, src: [] });
    else if (parts.length) parts.at(-1).src.push(l);
  });
  const findings = [],
    waiting = [],
    seen = new Set();
  for (const p of parts) {
    if (OTHER.includes(p.id)) continue;
    const at = `${p.line}行目（${p.id}）`;
    if (!/^FC-\d{3,}$/.test(p.id)) {
      errors.push(`${at}：見出しは FC-101 の形か、${OTHER.join("・")}`);
      continue;
    }
    if (seen.has(p.id)) errors.push(`${at}：ID が重複している`);
    seen.add(p.id);
    let list;
    try {
      list = YAML.parse(p.src.join("\n")) ?? [];
    } catch (e) {
      errors.push(`${at}：YAML として読めない：${e.message.split("\n")[0]}`);
      continue;
    }
    const f = {};
    for (const item of Array.isArray(list) ? list : [list]) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`${at}：「- 項目: 値」の形になっていない行がある`);
        continue;
      }
      Object.assign(f, item);
    }
    findings.push({ id: p.id, line: p.line, fields: f });
    for (const k of Object.keys(f)) if (![...REQUIRED, ...OPTIONAL].includes(k)) errors.push(`${at}：知らない項目「${k}」`);
    for (const k of REQUIRED) if (empty(f[k])) errors.push(`${at}：${k} がない`);
    if (!empty(f.slide) && !/^S\d{2,}$/.test(String(f.slide))) errors.push(`${at}：slide は S04 の形（outline.md の見出し）`);
    if (!empty(f.claim_id) && f.claim_id !== "なし" && !/^C-\d{3,}$/.test(String(f.claim_id))) errors.push(`${at}：claim_id は C-001 の形か「なし」`);
    if (!empty(f.level) && !LEVEL.includes(f.level)) errors.push(`${at}：level は ${LEVEL.join("・")}`);
    if (!empty(f.decision) && !DECISION.includes(f.decision)) errors.push(`${at}：decision は ${DECISION.join("・")}`);
    const srcs = Array.isArray(f.sources) ? f.sources : [];
    if (!empty(f.sources) && !Array.isArray(f.sources)) errors.push(`${at}：sources は「- url: …」の並び`);
    srcs.forEach((s, i) => errors.push(...checkSource(s, `${at} の根拠${i + 1}`, banned)));
    if (f.level === "P0" || f.level === "P1") {
      if (!srcs.length) errors.push(`${at}：${f.level} には根拠（sources）がいる。示せないなら要確認にする`);
      if (empty(f.suggestion)) errors.push(`${at}：${f.level} には修正案（suggestion）がいる`);
    }
    if (f.decision === "残す" && empty(f.decision_note)) errors.push(`${at}：「残す」には理由（decision_note）がいる`);
    if (f.decision === "出典を足す" && f.level !== "要確認") errors.push(`${at}：「出典を足す」は要確認だけに使う`);
    if (f.level === "P0" && empty(f.decision)) waiting.push(p.id);
  }
  return { errors, findings, waiting };
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("使い方：node check-factcheck.mjs decks/<deck-id>/factcheck.md");
    process.exit(2);
  }
  const r = checkFactcheck(fs.readFileSync(file, "utf8"));
  for (const e of r.errors) console.log(`エラー  ${e}`);
  if (r.waiting.length) console.log(`判断待ち  P0：${r.waiting.join("、")}（人間の判断を聞いて decision に写す）`);
  const n = (lv) => r.findings.filter((x) => x.fields.level === lv).length;
  console.log(
    `指摘 ${r.findings.length}件（P0 ${n("P0")}、P1 ${n("P1")}、要確認 ${n("要確認")}）、判断待ちの P0 ${r.waiting.length}件、エラー ${r.errors.length}件`,
  );
  process.exit(r.errors.length ? 2 : r.waiting.length ? 1 : 0);
}
