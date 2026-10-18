#!/usr/bin/env node
// ブランチ：デッキの作業をどのブランチで行うかを、git の状態だけから決める（スライド用リポジトリ）。
// squash マージのあとは、元の feature ブランチが「マージ済み」に見えないため、AI の判断に任せると、
// マージ済みのブランチで直しを始めてしまう（9a-3 の試行で起きた）。
// 使い方：node .claude/skills/make-slides/scripts/branch.mjs decks/<deck-id> [--json]
// - 出力：するべきこと（使わない・続き・新規・直し・人間に聞く）、実行するコマンド、理由
// - develop にあるデッキ（＝PR がマージ済み）より新しいコミットがあり、中身が develop と違うブランチを「作業中」とみなす
// - 何も変えない（ブランチの切り替えは、出力のコマンドを AI が実行する）
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const ok = (...args) => { try { git(...args); return true; } catch { return false; } };
const time = (ref, dir) => Number(git("log", "-1", "--format=%ct", ref, "--", dir) || 0);

export function deckBranch(deckDir) {
  const id = path.basename(path.resolve(deckDir));
  const dir = `decks/${id}`;
  const at = (action, command, reasons = []) => ({ deck: id, action, command, reasons });
  if (!ok("rev-parse", "--is-inside-work-tree")) return at("使わない", null, ["git のリポジトリではない"]);
  if (ok("check-ignore", "-q", `${dir}/brief.md`)) return at("使わない", null, ["decks/ が git の管理外（ハーネスのリポジトリ）"]);
  if (!ok("rev-parse", "--verify", "-q", "develop")) return at("人間に聞く", null, ["develop ブランチがない（README「1. スライド用リポジトリを作る」）"]);

  const cur = ok("symbolic-ref", "-q", "HEAD") ? git("symbolic-ref", "--short", "HEAD") : "";
  const mine = (b) => b === `feature/${id}` || new RegExp(`^feature/${id}-fix\\d*$`).test(b);
  const dirty = git("status", "--porcelain", "--", dir);
  if (dirty) {
    if (mine(cur)) return at("続き", null, [`${cur} で、コミットしていない変更がある（このまま続ける）`]);
    return at("人間に聞く", null, [`コミットしていない変更が ${cur || "（ブランチなし）"} にある。どのブランチの作業か人間に確かめる`, ...dirty.split("\n")]);
  }

  const onDevelop = ok("cat-file", "-e", `develop:${dir}/brief.md`);
  const devTime = onDevelop ? time("develop", dir) : 0;
  const branches = git("branch", "--list", "--format=%(refname:short)", `feature/${id}`, `feature/${id}-fix*`).split("\n").filter(mine);
  // 作業中：develop のデッキより新しいコミットがあり、中身が develop と違う。作ったばかりでコミットのないブランチも、develop にデッキがなければ作業中
  const working = branches.filter((b) => {
    const t = time(b, dir);
    if (!onDevelop) return true;
    return t > devTime && !ok("diff", "--quiet", "develop", b, "--", dir);
  });
  if (working.length > 1) return at("人間に聞く", null, [`作業中のブランチが複数ある：${working.join("、")}`]);
  if (working.length === 1) {
    const b = working[0];
    return at("続き", b === cur ? null : `git switch ${b}`, [onDevelop ? `${b} に、develop にまだ入っていない変更がある` : `${b} があり、デッキはまだ develop にマージされていない`]);
  }
  if (!onDevelop) return at("新規", `git switch -c feature/${id} develop`, ["デッキが develop になく、作業中のブランチもない"]);
  // develop から作ったばかりの直しのブランチにいる（develop の最新を含み、まだコミットがない）
  if (mine(cur) && ok("merge-base", "--is-ancestor", "develop", cur)) return at("続き", null, [`${cur} は develop から作ったばかり（このまま続ける）`]);
  let name = `feature/${id}-fix`;
  for (let n = 2; branches.includes(name); n++) name = `feature/${id}-fix${n}`;
  return at("直し", `git switch -c ${name} develop`, ["デッキは develop にマージ済みで、作業中のブランチはない（完成後の直し）"]);
}

// コマンドとして呼ばれたとき
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error("使い方：node branch.mjs decks/<deck-id> [--json]"); process.exit(2); }
  const r = deckBranch(dir);
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`デッキ：${r.deck}\nすること：${r.action}${r.command ? `\nコマンド：${r.command}` : ""}`);
    for (const x of r.reasons) console.log(`  - ${x}`);
  }
}
