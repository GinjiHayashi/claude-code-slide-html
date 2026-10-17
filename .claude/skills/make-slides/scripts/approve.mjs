#!/usr/bin/env node
// 承認を記録するコマンド。人間が自分の端末で実行する（要求文書 4章：approvals.yaml は人間だけが書く）。
// 使い方：node .claude/skills/make-slides/scripts/approve.mjs decks/<deck-id> <outline.md など> [--by 名前]
// - 対象のファイルの今の sha256 を approvals.yaml に追記する。承認者は --by か、git config user.name
// - 端末（TTY）からの実行でなければ書かない。AI のツールから実行されたものは端末を持たないため、ここで止まる
//   （settings.json の禁止（構築順序11）と合わせた2重の守り。この判定だけで防げるとは限らない）
// - 書く前に、前回の承認から変わったスライドを示し、「yes」と打ったときだけ記録する
import fs from "fs";
import path from "path";
import readline from "readline";
import { execFileSync } from "child_process";
import { TARGETS, YAML, sha256, slideHashes, readApprovals, latest } from "./approvals.mjs";

const args = process.argv.slice(2);
const by = args.includes("--by") ? args[args.indexOf("--by") + 1] : null;
const [deckDir, target] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--by");
if (!deckDir || !TARGETS.includes(target)) {
  console.error(`使い方：node approve.mjs decks/<deck-id> <${TARGETS.join("|")}> [--by 名前]`);
  process.exit(2);
}
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("承認は人間が端末で実行したときだけ記録する（端末からの実行ではないので止めた）");
  process.exit(3);
}
const file = path.join(deckDir, target);
if (!fs.existsSync(file)) { console.error(`${file} がない`); process.exit(2); }

const buf = fs.readFileSync(file);
const entry = {
  target,
  sha256: sha256(buf),
  approved_by: by ?? (() => { try { return execFileSync("git", ["config", "user.name"], { encoding: "utf8" }).trim(); } catch { return ""; } })(),
  approved_at: new Date().toISOString(),
};
if (!entry.approved_by) { console.error("承認者がわからない。--by で名前を指定する"); process.exit(2); }
if (target === "outline.md") entry.slides = slideHashes(buf.toString("utf8"));

const all = readApprovals(deckDir);
const prev = latest(all, target);
console.log(`対象：${file}`);
console.log(`sha256：${entry.sha256}`);
console.log(`承認者：${entry.approved_by}`);
if (prev?.sha256 === entry.sha256) console.log("前回の承認から変わっていない");
else if (prev?.slides && entry.slides) {
  const ids = new Set([...Object.keys(prev.slides), ...Object.keys(entry.slides)]);
  const changed = [...ids].filter((k) => prev.slides[k] !== entry.slides[k]);
  console.log(`前回の承認（${prev.approved_at}）から変わったところ：${changed.join("、")}`);
} else if (prev) console.log(`前回の承認（${prev.approved_at}）から変わっている`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("この内容を承認しますか？ 承認するなら yes と入力：", (ans) => {
  rl.close();
  if (ans.trim() !== "yes") { console.log("記録しなかった"); process.exit(1); }
  const f = path.join(deckDir, "approvals.yaml");
  const head = fs.existsSync(f) ? "" : "# approvals.yaml：承認の記録。approve.mjs を人間が端末で実行して追記する。手で書き換えない（要求文書 4章）\n";
  fs.appendFileSync(f, head + YAML.stringify([entry]));
  console.log(`${f} に記録した`);
});
