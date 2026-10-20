// 承認の記録・ゲート・現在地
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { SKILLS, tempDeck } from "./helpers.mjs";

const { judge, recordApproval, slideHashes, slideDigests, slideChanges, readApprovals, YAML } = await import(
  path.join(SKILLS, "make-slides/scripts/approvals.mjs")
);
const { checkGate } = await import(path.join(SKILLS, "make-slides/scripts/gate.mjs"));
const { deckStatus } = await import(path.join(SKILLS, "make-slides/scripts/status.mjs"));
const approve = (dir, target) => recordApproval(dir, target, { approved_by: "test", approved_at: "2026-10-18T00:00:00Z", answer: "OK" });

test("judge：はっきりした承認・否定・判断できない答え", () => {
  for (const t of ["承認します", "OK", "問題ないです", "LGTM", "進めてください"]) assert.equal(judge(t), "approve", t);
  for (const t of ["直してください", "ちょっと待って", "保留で", "いいえ", "これで合っていますか？", "OKではないです"]) assert.equal(judge(t), "reject", t);
  for (const t of ["S04 の数字の出どころを教えて", "ありがとう"]) assert.equal(judge(t), "unclear", t);
});

test("judge：同意の語のほかに言葉が混じれば、承認にしない（聞き直す）", () => {
  for (const t of [
    "これはいけません",
    "問題ないですか",
    "承認していいのかな",
    "はい、でも図は差し替えたい",
    "承認前に確認させて",
    "問題ないです\n\nところで README も直して",
  ])
    assert.notEqual(judge(t), "approve", t);
  for (const t of ["はい", "OK！", "承認です。", "了解しました、進めてください", "ＯＫ"]) assert.equal(judge(t), "approve", t);
});

test("judge：同意の語を含む否定の言い方は承認にしない", () => {
  for (const t of ["承認しません", "承認できません", "まだ承認しないで", "OK しないでください", "はいはい、あとでね", "後で承認します"])
    assert.equal(judge(t), "reject", t);
  for (const t of ["問題ありません", "問題ないです", "はい、承認します", "大丈夫です。進めてください", "かまいません。OK です"])
    assert.equal(judge(t), "approve", t);
});

test("slideHashes：1枚だけ変えると、その番号だけ変わる", () => {
  const a = "---\nx: 1\n---\n\n## S01\n- a: 1\n\n## S02\n- b: 2\n";
  const [ha, hb] = [slideHashes(a), slideHashes(a.replace("- b: 2", "- b: 3"))];
  assert.equal(ha.S01, hb.S01);
  assert.notEqual(ha.S02, hb.S02);
});

test("ゲート：承認がなければ止め、承認すれば通し、承認後に変えたら止める", () => {
  const dir = tempDeck();
  assert.equal(checkGate(dir, "outline").ok, false);
  approve(dir, "brief.md");
  assert.equal(checkGate(dir, "outline").ok, true);
  fs.appendFileSync(path.join(dir, "brief.md"), "\n");
  const r = checkGate(dir, "outline");
  assert.equal(r.ok, false);
  assert.ok(r.errors[0].includes("承認後に変更"));
  assert.equal(readApprovals(dir).length, 1);
});

test("ゲート（outline）：構成の草案があれば、その承認も要る", () => {
  const dir = tempDeck();
  approve(dir, "brief.md");
  fs.writeFileSync(path.join(dir, "outline-draft.md"), "## S01\n- title: 草案\n");
  assert.ok(checkGate(dir, "outline").errors[0].includes("outline-draft.md"));
  approve(dir, "outline-draft.md");
  assert.equal(checkGate(dir, "outline").ok, true);
});

test("ゲート（factcheck）：outline.md の承認は要らないが、outline.md がなければ止める", () => {
  const dir = tempDeck(undefined, ["brief.md"]);
  approve(dir, "brief.md");
  assert.ok(checkGate(dir, "factcheck").errors.some((e) => e.includes("outline.md がない")));
  fs.copyFileSync(path.join(path.dirname(path.dirname(SKILLS)), "examples/sample-deck/outline.md"), path.join(dir, "outline.md"));
  assert.equal(checkGate(dir, "factcheck").ok, true);
});

test("ゲート（build）：factcheck.md の承認のあとに変わったスライドを示す", () => {
  const dir = tempDeck();
  fs.writeFileSync(path.join(dir, "factcheck.md"), "---\ndeck_id: 2026-10-17-report-automation\n---\n\n## 問題がなかった記述\n");
  approve(dir, "outline.md");
  approve(dir, "factcheck.md");
  assert.deepEqual(checkGate(dir, "build").errors, []);
  const f = path.join(dir, "outline.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("## S02\n", "## S02\n- notes: 変更\n"));
  approve(dir, "outline.md");
  assert.ok(checkGate(dir, "build").errors.some((e) => e.includes("S02")));
});

// 文と見た目を分けた比べ方（4.11）に使う、小さな outline.md
const S = {
  title: ["- layout: title", "- title: 月次レポートの自動化"],
  lead: ["- layout: title-diagram", "- title: 作成時間の内訳", "- lead: 窓口サービスが最も長く、全体の3割を占めています。"],
  box: [
    "- layout: title-diagram",
    "- title: 新しい手順",
    "- diagram:",
    "    kind: canvas",
    "    shapes:",
    "      - { type: box, at: [0, 0], size: [2, 1], text: 入力 }",
    "      - { type: box, at: [3, 0], size: [2, 1], text: 集計, tone: primary }",
  ],
  extra: ["- layout: title-body", "- title: 足したスライド", "- body:", "    - 新しい説明"],
};
const mk = (...slides) =>
  ["---", "deck_id: 2026-10-17-report-automation", "---", ""].concat(slides.flatMap((b, i) => [`## S${String(i + 1).padStart(2, "0")}`, ...b, ""])).join("\n");
const changes = (a, b) => slideChanges(slideDigests(a), slideDigests(b));

test("slideDigests：箱の大きさ・色だけの変更は見た目、lead の1文字の変更は文", () => {
  const a = mk(S.title, S.lead, S.box);
  const look = a.replace("size: [2, 1], text: 集計, tone: primary", "size: [3, 2], text: 集計, tone: soft");
  assert.deepEqual(changes(a, look), { text: [], look: ["S03"], removed: [] });
  assert.deepEqual(changes(a, a.replace("3割", "4割")).text, ["S02"]);
});

test("slideDigests：改行の位置や太字だけの直しは、文の変更にしない（T8）", () => {
  const a = mk(S.title, S.lead);
  const b = a.replace("- lead: 窓口サービスが最も長く、", "- lead: |\n    **窓口サービス**が最も長く、\n    ");
  assert.notEqual(slideHashes(a).S02, slideHashes(b).S02);
  assert.deepEqual(changes(a, b).text, []);
});

test("slideChanges：途中に1枚足しても、後ろのスライドは変わった扱いにしない", () => {
  const a = mk(S.title, S.lead, S.box);
  const b = mk(S.title, S.extra, S.lead, S.box);
  assert.deepEqual(changes(a, b), { text: ["S02"], look: [], removed: [] });
  // 消したスライドは、ファクトチェックのやり直しにならない
  assert.deepEqual(changes(b, a), { text: [], look: [], removed: ["S02"] });
});

test("slideChanges：id があれば、番号が変わっても同じスライドとして文を比べる", () => {
  const withId = (b, id) => [b[0], `- id: ${id}`, ...b.slice(1)];
  const a = mk(S.title, withId(S.lead, "time-breakdown"));
  const b = mk(S.title, S.extra, withId(S.lead, "time-breakdown"));
  assert.deepEqual(changes(a, b).text, ["S02"]);
  assert.deepEqual(changes(a, b.replace("3割", "4割")).text, ["S02", "S03"]);
});

test("ゲート（build）：見た目だけの変更は承認のやり直しだけ、文の変更はファクトチェックのやり直しを求める", () => {
  const dir = tempDeck();
  const f = path.join(dir, "outline.md");
  fs.writeFileSync(f, mk(S.title, S.lead, S.box));
  fs.writeFileSync(path.join(dir, "factcheck.md"), "---\ndeck_id: 2026-10-17-report-automation\n---\n\n## 問題がなかった記述\n");
  for (const t of ["brief.md", "outline.md", "factcheck.md"]) approve(dir, t);
  assert.deepEqual(checkGate(dir, "build").errors, []);
  // 箱の大きさだけ：outline.md の承認のやり直しを求め、ファクトチェックのやり直しは求めない
  fs.writeFileSync(f, mk(S.title, S.lead, S.box).replace("size: [2, 1], text: 入力", "size: [3, 1], text: 入力"));
  const r = checkGate(dir, "build").errors;
  assert.equal(r.length, 1);
  assert.match(r[0], /outline\.md が承認後に変更されている.*見た目だけ：S03/);
  assert.match(deckStatus(dir).next, /ファクトチェックはし直さない/);
  approve(dir, "outline.md");
  assert.deepEqual(checkGate(dir, "build").errors, []);
  // 途中に1枚足す：足したスライドだけ
  fs.writeFileSync(f, mk(S.title, S.extra, S.lead, S.box).replace("size: [2, 1], text: 入力", "size: [3, 1], text: 入力"));
  approve(dir, "outline.md");
  assert.deepEqual(checkGate(dir, "build").errors, [
    "ファクトチェックのあとに outline.md のスライドの文が変わった：S02（そのスライドをファクトチェックし直し、factcheck.md を承認し直す）",
  ]);
  // lead の1文字
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("3割", "4割"));
  approve(dir, "outline.md");
  assert.ok(checkGate(dir, "build").errors.some((e) => e.includes("文が変わった：S02、S03")));
  assert.match(deckStatus(dir).next, /文が変わったスライドだけ/);
});

test("ゲート（build）：古い形式の承認の記録（outline_text がない）も読み、見出しごとに比べる", () => {
  const dir = tempDeck();
  const f = path.join(dir, "outline.md");
  fs.writeFileSync(f, mk(S.title, S.lead, S.box));
  fs.writeFileSync(path.join(dir, "factcheck.md"), "---\ndeck_id: 2026-10-17-report-automation\n---\n\n## 問題がなかった記述\n");
  approve(dir, "outline.md");
  approve(dir, "factcheck.md");
  const af = path.join(dir, "approvals.yaml");
  const old = YAML.parse(fs.readFileSync(af, "utf8")).map(({ slide_text, outline_text, ...a }) => a);
  fs.writeFileSync(af, YAML.stringify(old));
  assert.deepEqual(checkGate(dir, "build").errors, []);
  fs.writeFileSync(f, mk(S.title, S.lead, S.box).replace("size: [2, 1], text: 入力", "size: [3, 1], text: 入力"));
  assert.ok(checkGate(dir, "build").errors.some((e) => e.includes("変わったところ：S03")));
});

test("現在地：承認の進み具合で工程が進み、依頼中は答え待ちになる", () => {
  const dir = tempDeck();
  assert.equal(deckStatus(dir).stage, "1b ヒアリング");
  approve(dir, "brief.md");
  // outline.md は単独では承認しない。factcheck.md ができるまでは構成の工程
  assert.equal(deckStatus(dir).stage, "2 構成");
  assert.equal(checkGate(dir, "factcheck").ok, true);
  fs.writeFileSync(path.join(dir, "factcheck.md"), "---\ndeck_id: 2026-10-17-report-automation\n---\n\n## 問題がなかった記述\n");
  const s = deckStatus(dir);
  assert.equal(s.stage, "3 ファクトチェック");
  assert.equal(s.state, "構成とファクトチェックの承認待ち");
  approve(dir, "outline.md");
  approve(dir, "factcheck.md");
  assert.equal(deckStatus(dir).stage, "4 HTML 作成");
  fs.writeFileSync(path.join(dir, "approval-request.yaml"), "requested_at: x\ntargets:\n  - {target: brief.md, sha256: x}\n");
  assert.equal(deckStatus(dir).stage, "承認の確認");
});

test("現在地：承認済みの brief.md は、あとから増えた項目が空でもヒアリングに戻さない", () => {
  const dir = tempDeck();
  const f = path.join(dir, "brief.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^max_subagents:.*\n/m, ""));
  assert.equal(deckStatus(dir).stage, "1b ヒアリング");
  approve(dir, "brief.md");
  assert.equal(deckStatus(dir).stage, "2 構成");
});

test("現在地：ビルドの合否は build-log.md の先頭の設定（ok）で見る", () => {
  const dir = tempDeck();
  fs.writeFileSync(path.join(dir, "factcheck.md"), "---\ndeck_id: 2026-10-17-report-automation\n---\n\n## 問題がなかった記述\n");
  for (const t of ["brief.md", "outline.md", "factcheck.md"]) approve(dir, t);
  const out = path.join(dir, "build");
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, "deck.html"), "<html></html>");
  const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  fs.writeFileSync(
    path.join(out, "assets-manifest.yaml"),
    `outline_sha256: ${sha(path.join(dir, "outline.md"))}\ndeck_sha256: ${sha(path.join(out, "deck.html"))}\n`,
  );
  const log = (ok) => fs.writeFileSync(path.join(out, "build-log.md"), `---\nok: ${ok}\n---\n\n- 結果：合格\n`);
  log(false);
  assert.equal(deckStatus(dir).stage, "4 HTML 作成");
  log(true);
  assert.equal(deckStatus(dir).stage, "6 最終確認");
  // 承認の前の試しのビルド（gate: false）のままなら、ビルドし直す
  fs.writeFileSync(path.join(out, "build-log.md"), "---\nok: true\ngate: false\n---\n");
  assert.equal(deckStatus(dir).state, "承認の前の試しのビルドのまま");
});
