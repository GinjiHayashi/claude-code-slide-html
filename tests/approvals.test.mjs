// 承認の記録・ゲート・現在地
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { SKILLS, tempDeck } from "./helpers.mjs";

const { judge, recordApproval, slideHashes, readApprovals } = await import(path.join(SKILLS, "make-slides/scripts/approvals.mjs"));
const { checkGate } = await import(path.join(SKILLS, "make-slides/scripts/gate.mjs"));
const { deckStatus } = await import(path.join(SKILLS, "make-slides/scripts/status.mjs"));
const approve = (dir, target) => recordApproval(dir, target, { approved_by: "test", approved_at: "2026-10-18T00:00:00Z", answer: "OK" });

test("judge：はっきりした承認・否定・判断できない答え", () => {
  for (const t of ["承認します", "OK", "問題ないです", "LGTM", "進めてください"]) assert.equal(judge(t), "approve", t);
  for (const t of ["直してください", "ちょっと待って", "保留で", "いいえ", "これで合っていますか？", "OKではないです"]) assert.equal(judge(t), "reject", t);
  for (const t of ["S04 の数字の出どころを教えて", "ありがとう"]) assert.equal(judge(t), "unclear", t);
});

test("judge：同意の語を含む否定の言い方は承認にしない", () => {
  for (const t of ["承認しません", "承認できません", "まだ承認しないで", "OK しないでください", "はいはい、あとでね", "後で承認します"]) assert.equal(judge(t), "reject", t);
  for (const t of ["問題ありません", "問題ないです", "はい、承認します", "大丈夫です。進めてください", "かまいません。OK です"]) assert.equal(judge(t), "approve", t);
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

test("現在地：承認の進み具合で工程が進み、依頼中は答え待ちになる", () => {
  const dir = tempDeck();
  assert.equal(deckStatus(dir).stage, "1b ヒアリング");
  approve(dir, "brief.md");
  assert.equal(deckStatus(dir).stage, "2 構成");
  approve(dir, "outline.md");
  assert.equal(deckStatus(dir).stage, "3 ファクトチェック");
  fs.writeFileSync(path.join(dir, "approval-request.yaml"), "requested_at: x\ntargets:\n  - {target: brief.md, sha256: x}\n");
  assert.equal(deckStatus(dir).stage, "承認の確認");
});
