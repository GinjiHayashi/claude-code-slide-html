#!/usr/bin/env node
// 承認の依頼：AI が人間に承認を求めるときに実行する（承認そのものではない）。
// 使い方：node .claude/skills/make-slides/scripts/request.mjs decks/<deck-id> <outline.md など…>
// - 対象のファイルの今の sha256 を approval-request.yaml に書く。人間の次の答えを hook（approve-hook.mjs）が判定し、
//   承認なら、この sha256 のまま変わっていないファイルだけを approvals.yaml に記録する
// - 依頼を出したら、AI は「outline.md を承認しますか？」と聞く。人間は「OK」「問題ないです」など自由な言葉で答えてよい
// - 依頼は同時に1つのデッキだけ。ほかのデッキに残っている依頼は消す（人間の答えがどのデッキへのものか、取り違えないように）
import fs from "fs";
import path from "path";
import { TARGETS, YAML, sha256, REQUEST } from "./approvals.mjs";

const [deckDir, ...targets] = process.argv.slice(2);
if (!deckDir || !targets.length || targets.some((t) => !TARGETS.includes(t))) {
  console.error(`使い方：node request.mjs decks/<deck-id> <${TARGETS.join("|")}>…`);
  process.exit(2);
}
const req = {
  requested_at: new Date().toISOString(),
  targets: targets.map((t) => {
    const f = path.join(deckDir, t);
    if (!fs.existsSync(f)) { console.error(`${f} がない`); process.exit(2); }
    return { target: t, sha256: sha256(fs.readFileSync(f)) };
  }),
};
const others = fs.readdirSync(path.dirname(path.resolve(deckDir))).map((d) => path.join(path.dirname(path.resolve(deckDir)), d))
  .filter((d) => d !== path.resolve(deckDir) && fs.existsSync(path.join(d, REQUEST)));
for (const d of others) { fs.rmSync(path.join(d, REQUEST)); console.log(`${path.basename(d)} に残っていた承認の依頼を消した（同時に依頼できるのは1つのデッキだけ）`); }
fs.writeFileSync(path.join(deckDir, REQUEST), "# 承認の依頼（request.mjs が書く）。人間の次の答えで hook が判定し、消す\n" + YAML.stringify(req));
console.log(`承認の依頼を出した：${targets.join("、")}。人間に「${targets.join("・")} を承認しますか？」と聞く`);
