#!/usr/bin/env node
// research.md のチェック：書式と、確度と出典の食い違いを出す（要求文書 7.2〜7.4）。内容が正しいかは見ない（ファクトチェックで確かめる）。
// 使い方：node .claude/skills/research-standards/scripts/check-research.mjs decks/<deck-id>/research.md
// - 書式は research-standards/research-template.md。「## C-001」ごとに「- 項目: 値」の YAML の箇条書き
// - 「引用しない」「除外」のドメイン（domains.md）の URL を出典にするとエラー
// - 戻り値：{ errors, claims: [{ id, line, fields }] }。終了コード：0＝合格、2＝エラーあり
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const YAML = createRequire(path.join(HERE, "..", "..", "html-build", "package.json"))("yaml");

const KIND = ["事実", "推測"];
const CONFIDENCE = ["確認済み", "おおむね確実", "未確認", "矛盾あり"];
const TIER = ["一次", "準公式", "二次", "個人"];
const REQUIRED = ["topic", "claim", "kind", "confidence", "as_of", "sources"];
const OPTIONAL = ["counter", "basis", "dropped"];
const SRC_REQUIRED = ["url", "title", "publisher", "published", "accessed", "tier", "locator"];
const SRC_OPTIONAL = ["interest", "reuse"];
const OTHER = ["調べきれなかったこと", "検索の記録"]; // 主張以外の見出し（自由に書く）
const DATE = /^\d{4}-\d{2}-\d{2}/;
const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

// domains.md の「引用しない」「除外」の表のドメイン
export function bannedDomains(file = path.join(HERE, "..", "domains.md")) {
  const out = [];
  let on = false;
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    const h = l.match(/^## (.+)/);
    if (h) on = /引用しない|除外/.test(h[1]);
    const r = on && l.match(/^\|\s*([a-z0-9.-]+\.[a-z]+)\s*\|/i);
    if (r) out.push(r[1].toLowerCase());
  }
  return out;
}
const hostIn = (url, domains) => {
  let h;
  try { h = new URL(url).hostname.toLowerCase(); } catch { return null; }
  return domains.find((d) => h === d || h.endsWith("." + d)) ?? null;
};

export function checkResearch(text, banned = bannedDomains()) {
  const errors = [];
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) errors.push("先頭に --- で囲んだ設定（deck_id）がない");
  else {
    try { if (!YAML.parse(m[1])?.deck_id) errors.push("先頭の設定に deck_id がない"); } catch (e) { errors.push(`先頭の設定が YAML として読めない：${e.message.split("\n")[0]}`); }
  }
  const offset = m ? m[0].split("\n").length - 1 : 0;
  const body = (m ? text.slice(m[0].length) : text).split("\n");
  const parts = [];
  body.forEach((l, i) => {
    const h = l.match(/^## (.+?)\s*$/);
    if (h) parts.push({ id: h[1], line: offset + i + 1, src: [] });
    else if (parts.length) parts.at(-1).src.push(l);
  });
  const claims = [], seen = new Set();
  for (const p of parts) {
    if (OTHER.includes(p.id)) continue;
    const at = `${p.line}行目（${p.id}）`;
    if (!/^C-\d{3,}$/.test(p.id)) { errors.push(`${at}：見出しは C-001 の形か、${OTHER.join("・")}`); continue; }
    if (seen.has(p.id)) errors.push(`${at}：ID が重複している`);
    seen.add(p.id);
    let list;
    try { list = YAML.parse(p.src.join("\n")) ?? []; } catch (e) { errors.push(`${at}：YAML として読めない：${e.message.split("\n")[0]}`); continue; }
    const f = {};
    for (const item of Array.isArray(list) ? list : [list]) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) { errors.push(`${at}：「- 項目: 値」の形になっていない行がある`); continue; }
      Object.assign(f, item);
    }
    claims.push({ id: p.id, line: p.line, fields: f });
    for (const k of Object.keys(f)) if (![...REQUIRED, ...OPTIONAL].includes(k)) errors.push(`${at}：知らない項目「${k}」`);
    if (!empty(f.dropped)) continue; // 使わなくなった主張は、残っていればよい
    for (const k of REQUIRED) if (empty(f[k]) || (k === "sources" && !f[k]?.length)) errors.push(`${at}：${k} がない`);
    if (!empty(f.kind) && !KIND.includes(f.kind)) errors.push(`${at}：kind は ${KIND.join("・")}`);
    if (!empty(f.confidence) && !CONFIDENCE.includes(f.confidence)) errors.push(`${at}：confidence は ${CONFIDENCE.join("・")}`);
    if (f.kind === "推測" && empty(f.basis)) errors.push(`${at}：推測なのに basis（根拠）がない`);
    if (f.confidence === "矛盾あり" && empty(f.counter)) errors.push(`${at}：矛盾ありなのに counter（食い違う内容）がない`);
    const srcs = Array.isArray(f.sources) ? f.sources : [];
    if (f.sources != null && !Array.isArray(f.sources)) errors.push(`${at}：sources は「- url: …」の並び`);
    srcs.forEach((s, i) => {
      const sa = `${at} の出典${i + 1}`;
      if (s === null || typeof s !== "object") { errors.push(`${sa}：url・title などの項目で書く`); return; }
      for (const k of Object.keys(s)) if (![...SRC_REQUIRED, ...SRC_OPTIONAL].includes(k)) errors.push(`${sa}：知らない項目「${k}」`);
      for (const k of SRC_REQUIRED) if (empty(s[k])) errors.push(`${sa}：${k} がない`);
      if (!empty(s.url) && !/^https?:\/\/[^\s/]+\.[^\s]+/.test(s.url)) errors.push(`${sa}：url が URL の形でない`);
      const d = !empty(s.url) && hostIn(s.url, banned);
      if (d) errors.push(`${sa}：${d} は出典にしない（domains.md の「引用しない」か「除外」）。原典をたどって出典にする`);
      if (!empty(s.published) && s.published !== "不明" && !DATE.test(String(s.published))) errors.push(`${sa}：published は YYYY-MM-DD か「不明」`);
      if (!empty(s.accessed) && !DATE.test(String(s.accessed))) errors.push(`${sa}：accessed は YYYY-MM-DD`);
      if (!empty(s.tier) && !TIER.includes(s.tier)) errors.push(`${sa}：tier は ${TIER.join("・")}`);
    });
    // 確度と出典の数・発行元・tier（同じ発行元は1つと数える）
    const pubs = (pred) => new Set(srcs.filter(pred).map((s) => String(s?.publisher ?? "").trim()).filter(Boolean)).size;
    const all = pubs(() => true), primary = pubs((s) => s?.tier === "一次");
    if (f.confidence === "確認済み" && primary < 2) errors.push(`${at}：確認済みには、発行元の異なる一次情報が2つ以上いる（今は ${primary}）`);
    if (f.confidence === "おおむね確実" && all < 2) errors.push(`${at}：おおむね確実には、発行元の異なる情報源が2つ以上いる（今は ${all}）。1つなら未確認`);
    if (f.confidence === "未確認" && all > 1) errors.push(`${at}：発行元の異なる情報源が ${all} つあるのに未確認になっている（一致するならおおむね確実、食い違うなら矛盾あり）`);
  }
  return { errors, claims };
}

// コマンドとして呼ばれたとき
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const file = process.argv[2];
  if (!file) { console.error("使い方：node check-research.mjs decks/<deck-id>/research.md"); process.exit(2); }
  const r = checkResearch(fs.readFileSync(file, "utf8"));
  for (const e of r.errors) console.log(`エラー  ${e}`);
  const n = (c) => r.claims.filter((x) => empty(x.fields.dropped) && x.fields.confidence === c).length;
  console.log(`主張 ${r.claims.length}件（確認済み ${n("確認済み")}、おおむね確実 ${n("おおむね確実")}、未確認 ${n("未確認")}、矛盾あり ${n("矛盾あり")}）、エラー ${r.errors.length}件`);
  process.exit(r.errors.length ? 2 : 0);
}
