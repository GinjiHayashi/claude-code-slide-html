#!/usr/bin/env node
// デッキの名前（deck-id）を変える。日付を今日で付けたあとで発表日がわかったときなどに使う。
// 使い方：node .claude/skills/slide-intake/scripts/rename-deck.mjs decks/<今の deck-id> <新しい deck-id>
// - 変えるもの：フォルダ（decks/<deck-id>/）、ブランチ（feature/<deck-id>）、デッキの直下のファイルの先頭の設定の deck_id
//   （brief.md・outline-draft.md・outline.md・knowledge-map.md・reference/research.md（前からのデッキは直下の research.md）・factcheck.md）
// - 承認の記録（approvals.yaml）があれば何も変えずに止める。brief.md が変わって承認し直しになるため、人間に聞く
// - 頼んでいる途中の承認（approval-request.yaml）は、古い中身を指すので消す。名前を変えたあとで頼み直す
// - フォルダが git の管理下なら git mv で動かす。ブランチは、ローカルにあれば名前を変える（push 済みの古いブランチは残る）
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { DECK_ID, isMain } from "../../../lib/common.mjs";

const FILES = ["brief.md", "outline-draft.md", "outline.md", "knowledge-map.md", "research.md", "reference/research.md", "factcheck.md"];
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const ok = (root, ...args) => {
  try {
    git(root, ...args);
    return true;
  } catch {
    return false;
  }
};

// 先頭の設定（--- で囲んだところ）の deck_id だけを置き換える
export function replaceDeckId(text, from, to) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!m) return text;
  return m[0].replace(new RegExp(`^deck_id:[ \\t]*${from}[ \\t]*$`, "m"), `deck_id: ${to}`) + text.slice(m[0].length);
}

// { ok, errors, done（したことの一覧） }
export function renameDeck(deckDir, to) {
  const dir = path.resolve(deckDir);
  const from = path.basename(dir);
  const root = path.dirname(path.dirname(dir));
  const dest = path.join(path.dirname(dir), to);
  const errors = [];
  if (!DECK_ID.test(to)) errors.push(`新しい deck-id「${to}」は YYYY-MM-DD-<短い英語名>（小文字・数字・ハイフン）にする`);
  if (!fs.existsSync(dir)) errors.push(`decks/${from} がない`);
  if (fs.existsSync(dest)) errors.push(`decks/${to} はもうある`);
  if (fs.existsSync(path.join(dir, "approvals.yaml")))
    errors.push(`decks/${from} には承認の記録がある。名前を変えると brief.md が変わり、承認し直しになる。変えるかを人間に聞く`);
  if (errors.length) return { ok: false, errors, done: [] };

  const done = [];
  const inGit = ok(root, "rev-parse", "--is-inside-work-tree");
  const tracked = inGit && git(root, "ls-files", "--", `decks/${from}`) !== "";
  if (tracked) git(root, "mv", `decks/${from}`, `decks/${to}`);
  else fs.renameSync(dir, dest);
  done.push(`フォルダ：decks/${from} → decks/${to}`);

  for (const f of FILES) {
    const p = path.join(dest, f);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const next = replaceDeckId(text, from, to);
    if (next !== text) {
      fs.writeFileSync(p, next);
      done.push(`${f} の deck_id`);
    }
  }
  const req = path.join(dest, "approval-request.yaml");
  if (fs.existsSync(req)) {
    fs.rmSync(req);
    done.push("頼んでいた承認（approval-request.yaml）を消した。承認は頼み直す");
  }

  if (inGit && ok(root, "rev-parse", "--verify", "-q", `refs/heads/feature/${from}`)) {
    if (ok(root, "rev-parse", "--verify", "-q", `refs/heads/feature/${to}`))
      done.push(`ブランチ feature/${to} がもうあるので、feature/${from} の名前は変えていない`);
    else {
      const pushed = ok(root, "rev-parse", "--verify", "-q", `feature/${from}@{upstream}`);
      git(root, "branch", "-m", `feature/${from}`, `feature/${to}`);
      done.push(`ブランチ：feature/${from} → feature/${to}`);
      if (pushed) done.push(`push 済みの origin の feature/${from} は残っている。新しいブランチを push し、古いものを消すかは人間に聞く`);
    }
  }
  return { ok: true, errors: [], done };
}

if (isMain(import.meta.url)) {
  const [deckDir, to] = process.argv.slice(2);
  if (!deckDir || !to) {
    console.error("使い方：node rename-deck.mjs decks/<今の deck-id> <新しい deck-id>");
    process.exit(2);
  }
  const r = renameDeck(deckDir, to);
  for (const e of r.errors) console.log(`止める  ${e}`);
  for (const d of r.done) console.log(`変えた  ${d}`);
  process.exit(r.ok ? 0 : 1);
}
