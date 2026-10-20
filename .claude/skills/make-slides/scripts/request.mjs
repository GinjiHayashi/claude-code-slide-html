#!/usr/bin/env node
// 承認の依頼：AI が人間に承認を求めるときに実行する（承認そのものではない）。
// 使い方：node .claude/skills/make-slides/scripts/request.mjs decks/<deck-id> <outline.md など…>
// - 対象のファイルの今の sha256 を approval-request.yaml に書く。人間の次の答えを hook（approve-hook.mjs）が判定し、
//   承認なら、この sha256 のまま変わっていないファイルだけを approvals.yaml に記録する
// - 依頼を出したら、AI は「outline.md を承認しますか？」と聞く。承認になるのは「OK」「承認します」など短い同意の語だけの答え（approvals.mjs の judge()）
// - PR のマージ：request.mjs decks/<deck-id> --merge <PR の番号>。PR の番号・マージ先・今の head のコミットと、失敗しているチェックを書く。
//   承認されたら、merge.mjs がマージする（AI は gh pr merge を直接使わない）
// - 依頼は同時に1つのデッキだけ。ほかのデッキに残っている依頼は消す（人間の答えがどのデッキへのものか、取り違えないように）
import fs from "fs";
import path from "path";
import { TARGETS, YAML, sha256, REQUEST } from "./approvals.mjs";
import { MERGE_METHOD, mergeMethod, prInfo } from "./github.mjs";

const [deckDir, ...targets] = process.argv.slice(2);
const merge = targets[0] === "--merge";
if (!deckDir || !targets.length || (merge ? targets.length !== 2 || !/^\d+$/.test(targets[1]) : targets.some((t) => !TARGETS.includes(t)))) {
  console.error(`使い方：node request.mjs decks/<deck-id> <${TARGETS.join("|")}>…\n      node request.mjs decks/<deck-id> --merge <PR の番号>`);
  process.exit(2);
}
let req;
if (merge) {
  // PR のマージ：今の PR の head のコミットを残す（承認のあとに push されたら、merge.mjs が止める）
  const p = prInfo(targets[1], deckDir);
  if (p.state !== "OPEN") {
    console.error(`PR #${p.pr} は開いていない（${p.state}）`);
    process.exit(2);
  }
  if (!MERGE_METHOD[p.base]) {
    console.error(`PR #${p.pr} のマージ先は ${p.base}。マージを承認で頼めるのは ${Object.keys(MERGE_METHOD).join("・")} への PR だけ`);
    process.exit(2);
  }
  req = {
    requested_at: new Date().toISOString(),
    targets: [{ target: "merge", pr: p.pr, base: p.base, head: p.head, head_sha: p.head_sha, url: p.url, failing: p.failing, pending: p.pending }],
  };
} else
  req = {
    requested_at: new Date().toISOString(),
    targets: targets.map((t) => {
      const f = path.join(deckDir, t);
      if (!fs.existsSync(f)) {
        console.error(`${f} がない`);
        process.exit(2);
      }
      return { target: t, sha256: sha256(fs.readFileSync(f)) };
    }),
  };
const others = fs
  .readdirSync(path.dirname(path.resolve(deckDir)))
  .map((d) => path.join(path.dirname(path.resolve(deckDir)), d))
  .filter((d) => d !== path.resolve(deckDir) && fs.existsSync(path.join(d, REQUEST)));
for (const d of others) {
  fs.rmSync(path.join(d, REQUEST));
  console.log(`${path.basename(d)} に残っていた承認の依頼を消した（同時に依頼できるのは1つのデッキだけ）`);
}
fs.writeFileSync(path.join(deckDir, REQUEST), "# 承認の依頼（request.mjs が書く）。人間の次の答えで hook が判定し、消す\n" + YAML.stringify(req));
if (merge) {
  const t = req.targets[0];
  const warn = [
    ...(t.failing.length ? [`CI が失敗しているチェック：${t.failing.join("、")}。それでもマージしてよいかも、あわせて聞く`] : []),
    ...(t.pending.length ? [`まだ終わっていないチェック：${t.pending.join("、")}`] : []),
  ];
  console.log(
    `承認の依頼を出した：PR #${t.pr}（${t.head} → ${t.base}、${mergeMethod(t.base, t.head) === "squash" ? "squash マージ" : "マージコミット"}、head ${t.head_sha.slice(0, 7)}）。` +
      `人間に「PR #${t.pr} を ${t.base} にマージします。承認なら『承認』だけを送ってください。直したいところがあれば、その内容を書いてください」と聞く`,
  );
  for (const w of warn) console.log(`  - ${w}`);
} else
  console.log(
    `承認の依頼を出した：${targets.join("、")}。人間に「${targets.join("・")} を承認しますか？承認なら『承認』だけを送ってください。直したいところがあれば、その内容を書いてください」と聞く`,
  );
