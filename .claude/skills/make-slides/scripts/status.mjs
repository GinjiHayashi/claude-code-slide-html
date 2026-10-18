#!/usr/bin/env node
// 現在地：デッキがいまどの工程にいて、次に何をするかを、ファイルと承認の記録とゲートだけから決める。
// AI の自己申告で「終わった」と判断しないため、また会話が途切れても同じところから再開できるようにするため。
// 使い方：node .claude/skills/make-slides/scripts/status.mjs decks/<deck-id>
// - 出力：工程、状態、次にすること（使うスキル）と、その理由の行。--json で JSON
// - 工程：1 事前情報とヒアリング → 2 構成 → 3 ファクトチェック → 4・5 ビルド → 6 最終確認 → 完成
//   構成（outline.md）は単独では承認しない。ファクトチェックのあとに factcheck.md と一緒に承認する
// - 承認の依頼が出ていれば、何より先に「人間の答え待ち」を返す
import fs from "fs";
import path from "path";
import { YAML as YAMLlib, readApprovals, latest, sha256, readRequest } from "./approvals.mjs";
import { checkGate } from "./gate.mjs";
import { checkBrief, checkInputs } from "../../slide-hearing/scripts/check-brief.mjs";
import { checkStructure } from "../../slide-outline/scripts/check-structure.mjs";
import { checkFactcheck } from "../../slide-factcheck/scripts/check-factcheck.mjs";
import { frontMatter, isMain } from "../../../lib/common.mjs";

const read = (f) => fs.readFileSync(f, "utf8");
// 承認済みか：最後の承認の sha256 が今のファイルと同じ
function approved(deckDir, approvals, target) {
  const f = path.join(deckDir, target);
  if (!fs.existsSync(f)) return "ない";
  const a = latest(approvals, target);
  if (!a) return "未承認";
  return a.sha256 === sha256(fs.readFileSync(f)) ? "承認済み" : "承認後に変更あり";
}

export function deckStatus(deckDir) {
  const at = (stage, state, next, reasons = []) => ({ deck: path.basename(deckDir), stage, state, next, reasons });
  if (!fs.existsSync(deckDir)) return at("0 開始", "デッキのフォルダがない", "slide-intake（new-deck.mjs でフォルダを作る）");
  const approvals = readApprovals(deckDir);

  // 承認の依頼が出ていれば、人間の答えを待つ
  const req = readRequest(deckDir);
  if (req)
    return at("承認の確認", "人間の答え待ち", "人間に承認するかを聞く（答えは hook が記録する）", [
      `依頼中：${req.targets.map((t) => t.target).join("、")}（${req.requested_at}）`,
    ]);

  // 1 事前情報とヒアリング
  const briefFile = path.join(deckDir, "brief.md");
  if (!fs.existsSync(briefFile)) return at("1a 事前情報の取り込み", "brief.md がない", "slide-intake");
  const b = checkBrief(read(briefFile));
  b.errors.push(...checkInputs(b.sections, deckDir));
  if (b.errors.length) return at("1a 事前情報の取り込み", "brief.md に書式の誤り", "slide-intake（直して check-brief.mjs を0件にする）", b.errors);
  if (b.missing.length || b.questions.length)
    return at("1b ヒアリング", "聞くことが残っている", "slide-hearing", [...b.missing.map((m) => `空：${m}`), ...b.questions.map((q) => `確認：${q}`)]);
  const fixed = (b.sections["構成の進め方"] ?? "").replace(/^[-*]\s*/, "").startsWith("決まっている");
  const draft = fs.existsSync(path.join(deckDir, "outline-draft.md"));
  if (fixed && !draft)
    return at(
      "1a 事前情報の取り込み",
      "「決まっている」なのに構成の草案（outline-draft.md）がない",
      "slide-intake（人間の構成を草案に写す）か slide-hearing（構成を渡してもらう）",
    );
  const bs = approved(deckDir, approvals, "brief.md");
  const ds = draft ? approved(deckDir, approvals, "outline-draft.md") : "承認済み";
  if (bs !== "承認済み" || ds !== "承認済み")
    return at("1b ヒアリング", "brief.md の承認待ち", "slide-hearing の手順 5（brief.md の確認と承認の依頼）", [
      `brief.md：${bs}`,
      ...(draft ? [`outline-draft.md：${ds}`] : []),
    ]);

  // 2 構成
  const outlineFile = path.join(deckDir, "outline.md");
  if (!fs.existsSync(outlineFile)) return at("2 構成", "outline.md がない", "slide-outline");

  // 3 ファクトチェック（構成と一緒に承認する）
  const fcFile = path.join(deckDir, "factcheck.md");
  if (!fs.existsSync(fcFile)) return at("2 構成", "factcheck.md がない", "slide-outline（構成ができたら、承認は頼まずに slide-factcheck へ進む）");
  const fc = checkFactcheck(read(fcFile));
  if (fc.errors.length) return at("3 ファクトチェック", "factcheck.md に書式の誤り", "slide-factcheck（手順 5）", fc.errors);
  if (fc.waiting.length) return at("3 ファクトチェック", "P0 の人間の判断待ち", "slide-factcheck（手順 6・7）", [`判断待ち：${fc.waiting.join("、")}`]);
  const g = checkGate(deckDir, "build");
  if (!g.ok) {
    const reasons = [...g.errors];
    if (draft) {
      const st = checkStructure(deckDir);
      reasons.push(...st.errors, ...st.changed.map((c) => `草案から変えた：${c}`));
    }
    return at(
      "3 ファクトチェック",
      "構成とファクトチェックの承認待ち",
      "slide-factcheck の手順 9（直したスライドを確かめ直し、outline.md と factcheck.md を一緒に承認してもらう）",
      reasons,
    );
  }

  // 4・5 ビルド（ライセンス処理を含む）
  const manifestFile = path.join(deckDir, "build", "assets-manifest.yaml");
  const deckFile = path.join(deckDir, "build", "deck.html");
  const logFile = path.join(deckDir, "build", "build-log.md");
  const outlineSha = sha256(fs.readFileSync(outlineFile));
  const manifest = fs.existsSync(manifestFile) ? YAMLlib.parse(read(manifestFile)) : null;
  const log = fs.existsSync(logFile) ? read(logFile) : "";
  if (!fs.existsSync(deckFile) || !manifest) return at("4 HTML 作成", "まだビルドしていない", "html-build");
  if (manifest.outline_sha256 !== outlineSha) return at("4 HTML 作成", "いまの outline.md でビルドしていない", "html-build");
  if (manifest.deck_sha256 !== sha256(fs.readFileSync(deckFile)))
    return at("4 HTML 作成", "deck.html がビルドのあとに変わった（手で直さない）", "html-build（ビルドし直す）");
  const logMeta = frontMatter(log);
  if ((logMeta ? YAMLlib.parse(logMeta[1]) : {})?.ok !== true)
    return at("4 HTML 作成", "ビルドの検査で不合格", "html-build の「不合格のとき」", [(log.match(/^- 結果：.*$/m) ?? ["build-log.md がない"])[0]]);

  // 6 最終確認
  const fin = approved(deckDir, approvals, "build/deck.html");
  if (fin !== "承認済み")
    return at("6 最終確認", "人間の最終確認待ち", "人間に build/deck.html をブラウザで見てもらい、承認を頼む", [`build/deck.html：${fin}`]);
  return at("完成", "最終確認まで承認済み", "なし（直すときは工程7：make-slides の「直すとき」）");
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("使い方：node status.mjs decks/<deck-id> [--json]");
    process.exit(2);
  }
  const s = deckStatus(dir);
  if (process.argv.includes("--json")) console.log(JSON.stringify(s, null, 2));
  else {
    console.log(`デッキ：${s.deck}\n工程：${s.stage}\n状態：${s.state}\n次に：${s.next}`);
    for (const r of s.reasons) console.log(`  - ${r}`);
  }
}
