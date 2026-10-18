#!/usr/bin/env node
// 構成の比べ：人間の構成を写した草案（outline-draft.md）と outline.md を比べ、AI が変えたところと足したところを出す。
// 使い方：node .claude/skills/slide-outline/scripts/check-structure.mjs decks/<deck-id>
// - 草案は、人間が確認した（approvals.yaml に記録がある）ときのまま変わっていないこと。違えばエラー
// - スライドはタイトルで対応を取る（並べ替えや番号の振り直しがあっても対応が取れるように）。取れなければ同じ番号どうし（タイトルを変えたとき）
// - 「変えた」：草案に書かれた項目の中身が違う、スライドが消えた・増えた、並びが変わった
//   「AI が埋めた」：草案にない項目（型、lead、図、claims など）と、太字（**）だけの違い
// - 「構成の進め方」が「決まっている」なのに草案がなければエラー。ほかのモードで草案がなければ比べない
// - 終了コード：0＝変えたところなし、1＝変えたところあり（人間に見せる）、2＝エラー
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseOutline, plain } from "../../html-build/scripts/outline.mjs";
import { checkBrief } from "../../slide-hearing/scripts/check-brief.mjs";
import { readApprovals, latest, sha256 } from "../../make-slides/scripts/approvals.mjs";

export const DRAFT = "outline-draft.md";
const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());
// 比べるときは前後の空白と太字の印を無視する
const norm = (v) => typeof v === "string" ? plain(v).trim() : Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)])) : v;
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const show = (v) => (typeof v === "string" ? `「${v.trim()}」` : JSON.stringify(v));
const titleOf = (s) => (typeof s.fields.title === "string" ? plain(s.fields.title).trim() : "");

// タイトルの最長共通部分列で対応を取り、残りは同じタイトル、同じ番号の順で対応させる
function pair(draft, out) {
  const n = draft.length, m = out.length;
  const L = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = titleOf(draft[i]) && titleOf(draft[i]) === titleOf(out[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (titleOf(draft[i]) && titleOf(draft[i]) === titleOf(out[j])) { pairs.push([draft[i], out[j]]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  const usedD = new Set(pairs.map((p) => p[0])), usedO = new Set(pairs.map((p) => p[1]));
  // 並べ替えたスライド（同じタイトル）、次に同じ番号どうし
  for (const match of [(d, x) => titleOf(d) && titleOf(d) === titleOf(x), (d, x) => x.id === d.id]) {
    for (const d of draft) {
      if (usedD.has(d)) continue;
      const o = out.find((x) => !usedO.has(x) && match(d, x));
      if (o) { pairs.push([d, o]); usedD.add(d); usedO.add(o); }
    }
  }
  return { pairs, removed: draft.filter((d) => !usedD.has(d)), added: out.filter((o) => !usedO.has(o)) };
}

export function checkStructure(deckDir) {
  const errors = [], changed = [], filled = [];
  const brief = fs.existsSync(path.join(deckDir, "brief.md")) ? checkBrief(fs.readFileSync(path.join(deckDir, "brief.md"), "utf8")) : null;
  const plan = (brief?.sections?.["構成の進め方"] ?? "").split("\n")[0].replace(/^[-*]\s*/, "");
  const fixed = plan.startsWith("決まっている");
  const draftFile = path.join(deckDir, DRAFT);
  if (!fs.existsSync(draftFile)) {
    if (fixed) errors.push(`構成の進め方が「決まっている」なのに ${DRAFT}（人間の構成の草案）がない。slide-intake で人間の構成を写し、確認してもらう`);
    return { errors, changed, filled, fixed, compared: false };
  }
  const buf = fs.readFileSync(draftFile);
  const a = latest(readApprovals(deckDir), DRAFT);
  if (!a) errors.push(`${DRAFT} を人間が確認していない（request.mjs で確認を依頼する）`);
  else if (a.sha256 !== sha256(buf)) errors.push(`${DRAFT} が確認のあとに変わっている（確認：${a.approved_by}、${a.approved_at}）。草案は書き換えない`);
  const outFile = path.join(deckDir, "outline.md");
  if (!fs.existsSync(outFile)) { errors.push("outline.md がない"); return { errors, changed, filled, fixed, compared: false }; }
  let draft, out;
  try { draft = parseOutline(buf.toString("utf8"), DRAFT); out = parseOutline(fs.readFileSync(outFile, "utf8"), "outline.md"); }
  catch (e) { errors.push(e.message); return { errors, changed, filled, fixed, compared: false }; }

  const { pairs, removed, added } = pair(draft.slides, out.slides);
  for (const d of removed) changed.push(`${d.id}（草案）が消えた：${show(titleOf(d) || d.id)}`);
  for (const o of added) changed.push(`${o.id} が増えた：${show(titleOf(o) || o.id)}`);
  const order = pairs.filter(([d]) => draft.slides.includes(d)).sort((x, y) => out.slides.indexOf(x[1]) - out.slides.indexOf(y[1])).map(([d]) => d);
  if (order.some((d, i) => i && draft.slides.indexOf(order[i - 1]) > draft.slides.indexOf(d))) changed.push(`並びが変わった：草案 ${order.map((d) => d.id).join("・")} の順になった`);
  for (const [d, o] of pairs.sort((x, y) => out.slides.indexOf(x[1]) - out.slides.indexOf(y[1]))) {
    const at = d.id === o.id ? o.id : `${o.id}（草案の ${d.id}）`;
    const fill = [];
    for (const [k, v] of Object.entries(d.fields)) {
      if (empty(v)) continue;
      if (!(k in o.fields)) changed.push(`${at} の ${k} が消えた：${show(v)}`);
      else if (!same(v, o.fields[k])) changed.push(`${at} の ${k}：${show(v)} → ${show(o.fields[k])}`);
      else if (JSON.stringify(v) !== JSON.stringify(o.fields[k])) fill.push(`${k} に太字`);
    }
    for (const k of Object.keys(o.fields)) if (empty(d.fields[k]) && !empty(o.fields[k])) fill.push(k);
    if (fill.length) filled.push(`${at}：${fill.join("、")}`);
  }
  return { errors, changed, filled, fixed, compared: true };
}

// コマンドとして呼ばれたとき
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error("使い方：node check-structure.mjs decks/<deck-id>"); process.exit(2); }
  const r = checkStructure(dir);
  for (const e of r.errors) console.log(`エラー    ${e}`);
  if (!r.compared && !r.errors.length) { console.log(`${DRAFT} がないので比べない（構成の進め方が「決まっている」ではない）`); process.exit(0); }
  for (const c of r.changed) console.log(`変えた    ${c}`);
  for (const f of r.filled) console.log(`AI が埋めた ${f}`);
  console.log(`変えたところ ${r.changed.length}件、AI が埋めたスライド ${r.filled.length}枚、エラー ${r.errors.length}件${r.fixed && r.changed.length ? "（構成の進め方は「決まっている」。人間が直してと言ったところだけのはず）" : ""}`);
  process.exit(r.errors.length ? 2 : r.changed.length ? 1 : 0);
}
