#!/usr/bin/env node
// PR のマージ：人間がチャットで承認した PR だけをマージする（AI は gh pr merge を直接使わない。.claude/settings.json で止める）。
// 使い方：node .claude/skills/make-slides/scripts/merge.mjs decks/<deck-id> <PR の番号>
// - 承認は request.mjs decks/<deck-id> --merge <PR の番号> で頼み、hook（approve-hook.mjs）が approvals.yaml に記録する
// - 止めるとき：承認の記録がない、PR が開いていない、マージ先が develop・main 以外か承認のときと違う、承認のあとに PR の head が変わった
// - マージの方式：develop へは squash、main へはマージコミット（github.mjs の mergeMethod）。gh の --match-head-commit で、
//   承認した head のときだけマージする
// - main へのマージのあとは、main の最新のコミットにタグを付けて push する：<deck-id>。あれば <deck-id>-2、-3…（make-slides の「git」の 5）
import path from "path";
import { execFileSync } from "child_process";
import { readApprovals, latestMerge } from "./approvals.mjs";
import { MERGE_METHOD, mergeMethod, gh, prInfo } from "./github.mjs";
import { isMain } from "../../../lib/common.mjs";

const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// 付けるタグの名前：<deck-id>、すでにあれば <deck-id>-2、-3…
export function nextTag(deckId, tags) {
  if (!tags.includes(deckId)) return deckId;
  let n = 2;
  while (tags.includes(`${deckId}-${n}`)) n++;
  return `${deckId}-${n}`;
}

// マージしてよいかを確かめる。{ ok, errors, pr }
export function checkMerge(deckDir, pr) {
  const a = latestMerge(readApprovals(deckDir), pr);
  if (!a) return { ok: false, errors: [`PR #${pr} のマージの承認がない（request.mjs ${deckDir} --merge ${pr} で頼み、人間が答える）`] };
  const errors = [];
  const p = prInfo(pr, deckDir);
  if (p.state !== "OPEN") errors.push(`PR #${pr} は開いていない（${p.state}）`);
  if (!MERGE_METHOD[p.base]) errors.push(`PR #${pr} のマージ先は ${p.base}。マージできるのは ${Object.keys(MERGE_METHOD).join("・")} への PR だけ`);
  else if (p.base !== a.base) errors.push(`PR #${pr} のマージ先が、承認のとき（${a.base}）から ${p.base} に変わった。承認を頼み直す`);
  if (p.head_sha !== a.head_sha)
    errors.push(`承認のあとに PR #${pr} へ push された（承認：${String(a.head_sha).slice(0, 7)}、今：${p.head_sha.slice(0, 7)}）。承認を頼み直す`);
  return { ok: !errors.length, errors, pr: p };
}

export function mergePr(deckDir, pr, log = console.log) {
  const c = checkMerge(deckDir, pr);
  if (!c.ok) return { ...c, tag: null };
  const method = mergeMethod(c.pr.base, c.pr.head);
  gh(["pr", "merge", String(pr), `--${method}`, "--match-head-commit", c.pr.head_sha], deckDir);
  log(`PR #${pr} を ${c.pr.base} にマージした（${method === "squash" ? "squash マージ" : "マージコミット"}）`);
  if (c.pr.base !== "main") return { ...c, method, tag: null };
  // main：最新のコミットにタグを付けて push する
  const root = path.dirname(path.dirname(path.resolve(deckDir)));
  const deckId = path.basename(path.resolve(deckDir));
  git(root, "fetch", "--quiet", "--tags", "origin", "main");
  const tags = git(root, "tag", "--list").split("\n").filter(Boolean);
  const tag = nextTag(deckId, tags);
  git(root, "tag", tag, "FETCH_HEAD");
  git(root, "push", "--quiet", "origin", `refs/tags/${tag}`);
  log(`main の最新のコミットにタグ ${tag} を付けて push した`);
  return { ...c, method, tag };
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const [deckDir, pr] = process.argv.slice(2);
  if (!deckDir || !/^\d+$/.test(pr ?? "")) {
    console.error("使い方：node merge.mjs decks/<deck-id> <PR の番号>");
    process.exit(2);
  }
  const r = mergePr(deckDir, Number(pr));
  for (const e of r.errors) console.log(`止める  ${e}`);
  process.exit(r.ok ? 0 : 1);
}
