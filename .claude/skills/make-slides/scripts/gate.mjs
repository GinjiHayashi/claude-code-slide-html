#!/usr/bin/env node
// 承認ゲート：次の工程に進んでよいかを、approvals.yaml とファイルの sha256 だけで判定する。
// AI の自己申告では判定しない。
// 使い方：node .claude/skills/make-slides/scripts/gate.mjs decks/<deck-id> <outline|factcheck|build|final>
// ファクトチェックの時期（brief.md の factcheck）で、ビルドの前に要る承認が変わる（timing()。既定は「最後に1回」）
// - outline：brief.md が承認済み。outline-draft.md（人間の構成の草案）があれば、それも承認済み
// - factcheck：brief.md（と草案）が承認済みで、outline.md がある。「最後に1回」なら、outline.md が一度は承認されている
// - build：構成の承認がある。「最後に1回」は outline.md の承認、「2回」は構成のあとのファクトチェック（outline.md と factcheck.md を一緒に）の承認。
//   承認のあとの見た目や文の直しでは止めず、notices（注意）に出す。最後のファクトチェックのあとに、まとめて承認し直すため
// - final（最終確認の前）：outline.md と factcheck.md が承認済みで、factcheck.md の書式にエラーがなく、P0 にすべて人間の判断（decision）が
//   書かれている。「2回」なら factcheck.md が最後のファクトチェック（round: 最後）。さらに、factcheck.md を承認したときから
//   outline.md のスライドの文が変わっていない（文が変わったスライドはファクトチェックし直す。見た目だけの変更は、承認のやり直しで済む。
//   文と見た目の分け方は spec.mjs の LOOK）
// 「承認済み」＝ approvals.yaml の最後の承認の sha256 が、今のファイルと一致する。違えば「承認後に変更あり」
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { sha256, slideHashes, slideDigests, slideChanges, describeChanges, readApprovals, latest } from "./approvals.mjs";
import { checkFactcheck, ROUND } from "../../slide-factcheck/scripts/check-factcheck.mjs";
import { FACTCHECK_TIMING } from "../../slide-hearing/scripts/check-brief.mjs";
import { frontMatter, isMain } from "../../../lib/common.mjs";

const NEEDS = {
  outline: ["brief.md"],
  factcheck: ["brief.md"],
  build: [],
  final: ["outline.md", "factcheck.md"],
};
// あるときだけ承認が要るもの（草案を渡さないデッキもあるため）
const IF_EXISTS = { outline: ["outline-draft.md"], factcheck: ["outline-draft.md"] };
// 承認は要らないが、ないと進めないもの
const EXISTS = { factcheck: ["outline.md"], build: ["outline.md"] };

// ファクトチェックの時期：once（最後に1回。既定）か twice（構成のあとと最後の2回）
const meta = (file) => {
  if (!fs.existsSync(file)) return {};
  const m = frontMatter(fs.readFileSync(file, "utf8"));
  try {
    return (m && YAML.parse(m[1])) || {};
  } catch {
    return {};
  }
};
export const timing = (deckDir) => (meta(path.join(deckDir, "brief.md")).factcheck === FACTCHECK_TIMING[1] ? "twice" : "once");
// factcheck.md がどの回のものか（2回のときに使う）。書いていなければ「最後」
export const round = (deckDir) => (meta(path.join(deckDir, "factcheck.md")).round === ROUND[0] ? ROUND[0] : ROUND[1]);

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

// 承認のあとに変わったところ（outline.md はスライドの番号と、文か見た目か）
function changedSince(a, target, text) {
  let where = "";
  const now = a.slide_text && slideDigests(text.toString("utf8"));
  if (now) where = `。変わったところ：${describeChanges(slideChanges(a.slide_text, now))}`;
  else if (a.slides) {
    const hashes = slideHashes(text.toString("utf8"));
    const ids = new Set([...Object.keys(a.slides), ...Object.keys(hashes)]);
    where = `。変わったところ：${[...ids].filter((k) => a.slides[k] !== hashes[k]).join("、")}`;
  }
  return `${target} が承認後に変更されている（承認：${a.approved_by}、${a.approved_at}）${where}`;
}

export function checkGate(deckDir, stage) {
  const errors = [],
    notices = [];
  const approvals = readApprovals(deckDir);
  const mode = timing(deckDir);
  for (const t of EXISTS[stage] ?? []) if (!fs.existsSync(path.join(deckDir, t))) errors.push(`${t} がない`);
  const optional = (IF_EXISTS[stage] ?? []).filter((t) => fs.existsSync(path.join(deckDir, t)));
  // 承認済み（sha256 が一致）でなければ止める
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
    if (a.sha256 !== sha256(text)) errors.push(changedSince(a, target, text));
  }
  // 「最後に1回」のファクトチェックは、構成（outline.md）の承認のあと
  if (stage === "factcheck" && mode === "once" && fs.existsSync(path.join(deckDir, "outline.md")) && !latest(approvals, "outline.md"))
    errors.push("outline.md が承認されていない（ファクトチェックの時期が「最後に1回」なので、構成を承認してからビルドし、そのあとにファクトチェックする）");
  // ビルド：構成の承認があればよい。承認のあとの変更は注意にとどめる（最終確認の前に、まとめて承認し直す）
  if (stage === "build") {
    const need = mode === "once" ? ["outline.md"] : ["outline.md", "factcheck.md"];
    for (const target of need) {
      const file = path.join(deckDir, target);
      if (!fs.existsSync(file)) {
        if (target !== "outline.md") errors.push(`${target} がない（ファクトチェックの時期が「2回」なので、構成のあとのファクトチェックをする）`);
        continue;
      }
      const a = latest(approvals, target);
      if (!a)
        errors.push(
          mode === "once"
            ? `${target} が承認されていない（request.mjs で承認を依頼し、人間が答える）`
            : `${target} が承認されていない（構成のあとのファクトチェックのあとに、outline.md と factcheck.md を一緒に承認してもらう）`,
        );
      else if (a.sha256 !== sha256(fs.readFileSync(file)))
        notices.push(`${changedSince(a, target, fs.readFileSync(file))}。最後のファクトチェックのあとに、まとめて承認し直す`);
    }
    const fcFile = path.join(deckDir, "factcheck.md");
    if (mode === "twice" && fs.existsSync(fcFile)) {
      const fc = checkFactcheck(fs.readFileSync(fcFile, "utf8"));
      if (fc.waiting.length) errors.push(`factcheck.md の P0 に人間の判断（decision）がない：${fc.waiting.join("、")}`);
    }
  }
  if (stage === "final" && fs.existsSync(path.join(deckDir, "factcheck.md"))) {
    const fc = checkFactcheck(fs.readFileSync(path.join(deckDir, "factcheck.md"), "utf8"));
    if (fc.errors.length) errors.push(`factcheck.md の書式にエラーが ${fc.errors.length}件ある（check-factcheck.mjs で確かめる）`);
    if (fc.waiting.length) errors.push(`factcheck.md の P0 に人間の判断（decision）がない：${fc.waiting.join("、")}`);
    if (mode === "twice" && round(deckDir) !== "最後")
      errors.push("最後のファクトチェックがまだ（factcheck.md は構成のあとのもの。ビルドのあとにもう一度確かめ、先頭の設定を round: 最後 にする）");
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
  return { ok: !errors.length, errors, notices };
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
  for (const e of r.notices) console.log(`注意    ${e}`);
  console.log(r.ok ? `${stage} に進んでよい` : `${stage} に進めない`);
  process.exit(r.ok ? 0 : 1);
}
