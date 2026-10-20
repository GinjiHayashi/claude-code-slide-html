#!/usr/bin/env node
// 承認ゲート：次の工程に進んでよいかを、approvals.yaml とファイルの sha256 だけで判定する。
// AI の自己申告では判定しない。
// 使い方：node .claude/skills/make-slides/scripts/gate.mjs decks/<deck-id> <outline|factcheck|build>
// - outline：brief.md が承認済み。outline-draft.md（人間の構成の草案）があれば、それも承認済み
// - factcheck：brief.md（と草案）が承認済みで、outline.md がある。outline.md は単独では承認せず、factcheck.md と一緒に承認する
// - build：outline.md と factcheck.md が承認済みで、factcheck.md の書式にエラーがなく、P0 にすべて人間の判断（decision）が書かれている。
//   さらに、factcheck.md を承認したときから outline.md のスライドの文が変わっていない（文が変わったスライドはファクトチェックし直す。
//   見た目だけの変更は、outline.md の承認のやり直しで済む。文と見た目の分け方は spec.mjs の LOOK）
// 「承認済み」＝ approvals.yaml の最後の承認の sha256 が、今のファイルと一致する。違えば「承認後に変更あり」
import fs from "fs";
import path from "path";
import { sha256, slideHashes, slideDigests, slideChanges, describeChanges, readApprovals, latest } from "./approvals.mjs";
import { checkFactcheck } from "../../slide-factcheck/scripts/check-factcheck.mjs";
import { isMain } from "../../../lib/common.mjs";

const NEEDS = {
  outline: ["brief.md"],
  factcheck: ["brief.md"],
  build: ["outline.md", "factcheck.md"],
};
// あるときだけ承認が要るもの（草案を渡さないデッキもあるため）
const IF_EXISTS = { outline: ["outline-draft.md"], factcheck: ["outline-draft.md"] };
// 承認は要らないが、ないと進めないもの
const EXISTS = { factcheck: ["outline.md"] };

// factcheck.md の承認のときから文が変わった outline.md のスライド（記録がなければ null）。先頭の設定（meta）は見ない
// - 記録に outline_text があれば、id か文の sha256 でスライドを対応づけ、文が変わったものだけを返す
// - 古い記録（outline_slides だけ）は、見出しごとに全体の sha256 で比べる
export function factcheckedChanges(approval, outlineText) {
  const digests = approval?.outline_text && slideDigests(outlineText);
  if (digests) return slideChanges(approval.outline_text, digests).text;
  if (!approval?.outline_slides) return null;
  const now = slideHashes(outlineText),
    then = approval.outline_slides;
  return [...new Set([...Object.keys(then), ...Object.keys(now)])].filter((k) => k !== "meta" && then[k] !== now[k]);
}

export function checkGate(deckDir, stage) {
  const errors = [];
  const approvals = readApprovals(deckDir);
  for (const t of EXISTS[stage] ?? []) if (!fs.existsSync(path.join(deckDir, t))) errors.push(`${t} がない`);
  const optional = (IF_EXISTS[stage] ?? []).filter((t) => fs.existsSync(path.join(deckDir, t)));
  for (const target of [...NEEDS[stage], ...optional]) {
    const file = path.join(deckDir, target);
    if (!fs.existsSync(file)) {
      errors.push(`${target} がない`);
      continue;
    }
    const a = latest(approvals, target);
    if (!a) {
      errors.push(`${target} が承認されていない（request.mjs で承認を依頼し、人間が答える）`);
      continue;
    }
    const text = fs.readFileSync(file);
    if (a.sha256 === sha256(text)) continue;
    let where = "";
    const now = a.slide_text && slideDigests(text.toString("utf8"));
    if (now) where = `。変わったところ：${describeChanges(slideChanges(a.slide_text, now))}`;
    else if (a.slides) {
      const now = slideHashes(text.toString("utf8"));
      const ids = new Set([...Object.keys(a.slides), ...Object.keys(now)]);
      where = `。変わったところ：${[...ids].filter((k) => a.slides[k] !== now[k]).join("、")}`;
    }
    errors.push(`${target} が承認後に変更されている（承認：${a.approved_by}、${a.approved_at}）${where}`);
  }
  if (stage === "build" && fs.existsSync(path.join(deckDir, "factcheck.md"))) {
    const fc = checkFactcheck(fs.readFileSync(path.join(deckDir, "factcheck.md"), "utf8"));
    if (fc.errors.length) errors.push(`factcheck.md の書式にエラーが ${fc.errors.length}件ある（check-factcheck.mjs で確かめる）`);
    if (fc.waiting.length) errors.push(`factcheck.md の P0 に人間の判断（decision）がない：${fc.waiting.join("、")}`);
    const a = latest(approvals, "factcheck.md");
    const of = path.join(deckDir, "outline.md");
    if (a && fs.existsSync(of)) {
      const changed = factcheckedChanges(a, fs.readFileSync(of, "utf8"));
      if (changed === null) errors.push("factcheck.md の承認に、そのときの outline.md の記録がない。factcheck.md を承認し直す");
      else if (changed.length)
        errors.push(
          `ファクトチェックのあとに outline.md のスライドの文が変わった：${changed.join("、")}（そのスライドをファクトチェックし直し、factcheck.md を承認し直す）`,
        );
    }
  }
  return { ok: !errors.length, errors };
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const [deckDir, stage] = process.argv.slice(2);
  if (!deckDir || !NEEDS[stage]) {
    console.error(`使い方：node gate.mjs decks/<deck-id> <${Object.keys(NEEDS).join("|")}>`);
    process.exit(2);
  }
  const r = checkGate(deckDir, stage);
  for (const e of r.errors) console.log(`止める  ${e}`);
  console.log(r.ok ? `${stage} に進んでよい` : `${stage} に進めない`);
  process.exit(r.ok ? 0 : 1);
}
