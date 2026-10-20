#!/usr/bin/env node
// 現在地：デッキがいまどの工程にいて、次に何をするかを、ファイルと承認の記録とゲートだけから決める。
// AI の自己申告で「終わった」と判断しないため、また会話が途切れても同じところから再開できるようにするため。
// 使い方：node .claude/skills/make-slides/scripts/status.mjs decks/<deck-id>
// - 出力：工程、状態、次にすること（使うスキル）と、その理由の行。--json で JSON
// - 工程：1a 事前情報の取り込み → 1b ヒアリング → 2 構成 → 3 HTML 作成（見た目の確認・直しを含む）→ 4 ファクトチェック → 5 最終確認 → 完成
//   ファクトチェックの時期（brief.md の factcheck）が「構成のあとと最後の2回」なら、2 構成のあとに 2b ファクトチェック（構成のあと）が入る
//   承認：brief.md → outline.md（2回なら factcheck.md と一緒に）→ outline.md と factcheck.md（最後のファクトチェックのあと）→ build/deck.html
// - 承認の依頼が出ていれば、何より先に「人間の答え待ち」を返す
import fs from "fs";
import path from "path";
import { YAML as YAMLlib, readApprovals, latest, sha256, readRequest, targetName } from "./approvals.mjs";
import { checkGate, factcheckedChanges, timing, round } from "./gate.mjs";
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

// factcheck.md の書式の誤りと、P0 の判断待ち（なければ null）
function factcheckBlock(at, fcFile, stage, next) {
  if (!fs.existsSync(fcFile)) return at(stage, "factcheck.md がない", next);
  const fc = checkFactcheck(read(fcFile));
  if (fc.errors.length) return at(stage, "factcheck.md に書式の誤り", "slide-factcheck（手順 5）", fc.errors);
  if (fc.waiting.length) return at(stage, "P0 の人間の判断待ち", "slide-factcheck（手順 6・7）", [`判断待ち：${fc.waiting.join("、")}`]);
  return null;
}

export function deckStatus(deckDir) {
  const at = (stage, state, next, reasons = []) => ({ deck: path.basename(deckDir), stage, state, next, reasons });
  if (!fs.existsSync(deckDir)) return at("0 開始", "デッキのフォルダがない", "slide-intake（new-deck.mjs でフォルダを作る）");
  const approvals = readApprovals(deckDir);

  // 承認の依頼が出ていれば、人間の答えを待つ
  const req = readRequest(deckDir);
  if (req)
    return at("承認の確認", "人間の答え待ち", "人間に承認するかを聞く（答えは hook が記録する）", [
      `依頼中：${req.targets.map(targetName).join("、")}（${req.requested_at}）`,
    ]);

  // 1 事前情報とヒアリング
  const briefFile = path.join(deckDir, "brief.md");
  if (!fs.existsSync(briefFile)) return at("1a 事前情報の取り込み", "brief.md がない", "slide-intake");
  const b = checkBrief(read(briefFile));
  b.errors.push(...checkInputs(b.sections, deckDir));
  if (b.errors.length) return at("1a 事前情報の取り込み", "brief.md に書式の誤り", "slide-intake（直して check-brief.mjs を0件にする）", b.errors);
  // 承認済みで変わっていない brief.md は、あとから増えた項目（max_subagents など）が空でもヒアリングに戻さない（空の項目は既定の値で進む）
  if ((b.missing.length && approved(deckDir, approvals, "brief.md") !== "承認済み") || b.questions.length)
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
  const mode = timing(deckDir);
  const fcFile = path.join(deckDir, "factcheck.md");
  const g = checkGate(deckDir, "build");
  const structure = () => (draft ? ((st) => [...st.errors, ...st.changed.map((c) => `草案から変えた：${c}`)])(checkStructure(deckDir)) : []);
  if (!g.ok) {
    if (mode === "once") return at("2 構成", "outline.md の承認待ち", "slide-outline（手順 8 で outline.md の承認を頼む）", [...g.errors, ...structure()]);
    // 2回：構成のあとに、数値と結論を支える事実だけを確かめる
    const fcBlock = factcheckBlock(at, fcFile, "2b ファクトチェック（構成のあと）", "slide-factcheck（構成のあと。数値と結論を支える事実だけ）");
    if (fcBlock) return fcBlock;
    return at(
      "2b ファクトチェック（構成のあと）",
      "構成とファクトチェックの承認待ち",
      "slide-factcheck（手順 9 で outline.md と factcheck.md を一緒に承認してもらう）",
      [...g.errors, ...structure()],
    );
  }

  // 3 HTML 作成（ライセンス処理を含む）と、見た目の確認・直し
  const manifestFile = path.join(deckDir, "build", "assets-manifest.yaml");
  const deckFile = path.join(deckDir, "build", "deck.html");
  const logFile = path.join(deckDir, "build", "build-log.md");
  const outlineSha = sha256(fs.readFileSync(outlineFile));
  const manifest = fs.existsSync(manifestFile) ? YAMLlib.parse(read(manifestFile)) : null;
  const log = fs.existsSync(logFile) ? read(logFile) : "";
  if (!fs.existsSync(deckFile) || !manifest) return at("3 HTML 作成", "まだビルドしていない", "html-build");
  if (manifest.outline_sha256 !== outlineSha) return at("3 HTML 作成", "いまの outline.md でビルドしていない", "html-build", g.notices);
  if (manifest.deck_sha256 !== sha256(fs.readFileSync(deckFile)))
    return at("3 HTML 作成", "deck.html がビルドのあとに変わった（手で直さない）", "html-build（ビルドし直す）");
  const logMeta = frontMatter(log);
  const meta = logMeta ? YAMLlib.parse(logMeta[1]) : {};
  // 承認の前の試しのビルド（slide-outline の手順 6）は、承認のあとにビルドし直す
  if (meta?.gate === false) return at("3 HTML 作成", "承認の前の試しのビルドのまま", "html-build（ビルドし直す）");
  if (meta?.ok !== true)
    return at("3 HTML 作成", "ビルドの検査で不合格", "html-build の「不合格のとき」", [(log.match(/^- 結果：.*$/m) ?? ["build-log.md がない"])[0]]);

  // 4 ファクトチェック（最後）
  const fcStage = "4 ファクトチェック";
  if (!fs.existsSync(fcFile)) return at(fcStage, "factcheck.md がない", "slide-factcheck（見た目の直しが済んだら、すべてのスライドを確かめる）", g.notices);
  if (mode === "twice" && round(deckDir) !== "最後") {
    const a = latest(approvals, "factcheck.md");
    const changed = a ? (factcheckedChanges(a, read(outlineFile)) ?? []) : [];
    return at(
      fcStage,
      "最後のファクトチェックがまだ",
      "slide-factcheck（最後。構成のあとに確かめていない記述と、構成のあとに文が変わったスライドを確かめ、先頭の設定を round: 最後 にする）",
      changed.length ? [`構成のあとのファクトチェックのあとに文が変わった：${changed.join("、")}`] : [],
    );
  }
  const fcBlock = factcheckBlock(at, fcFile, fcStage, "slide-factcheck");
  if (fcBlock) return fcBlock;
  const gf = checkGate(deckDir, "final");
  if (!gf.ok) {
    // 文が変わったスライドがなければ（見た目だけの変更なら）、ファクトチェックはし直さず、承認だけを頼み直す
    const lookOnly = gf.errors.every((e) => e.startsWith("outline.md が承認後に変更されている"));
    return at(
      fcStage,
      "構成とファクトチェックの承認待ち",
      lookOnly
        ? "slide-factcheck（文が変わったスライドはないので、ファクトチェックはし直さない。手順 9 で outline.md と factcheck.md を一緒に承認してもらう）"
        : "slide-factcheck（文が変わったスライドだけ手順 2〜5 でファクトチェックし直し、手順 9 で outline.md と factcheck.md を一緒に承認してもらう）",
      [...gf.errors, ...structure()],
    );
  }

  // 5 最終確認
  const fin = approved(deckDir, approvals, "build/deck.html");
  if (fin !== "承認済み")
    return at("5 最終確認", "人間の最終確認待ち", "人間に build/deck.html をブラウザで見てもらい、承認を頼む", [`build/deck.html：${fin}`]);
  return at("完成", "最終確認まで承認済み", "なし（直すときは make-slides の「直すとき」）");
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
