// 回帰：最初の版の問題（指示書の5章）を再現した outline（tests/fixtures/regression/outline.md）で、注意と不合格が出る
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { SKILLS, ROOT } from "./helpers.mjs";

const FIXTURE = path.join(ROOT, "tests", "fixtures", "regression", "outline.md");
const { checkOutline } = await import(path.join(SKILLS, "html-build/scripts/check-outline.mjs"));
const { build } = await import(path.join(SKILLS, "html-build/scripts/build.mjs"));
const has = (list, re) => list.some((x) => re.test(x));

test("回帰：書式チェックで、短い lead・短い箇条書き・箇条書きの型の多さ・順序のない steps に注意が出る", async () => {
  const { errors, warnings } = await checkOutline(FIXTURE);
  assert.deepEqual(errors, []);
  const w = warnings.join("\n");
  assert.ok(has(warnings, /^S02.*lead が短い/), w); // 4.3
  assert.ok(has(warnings, /^S02.*body の1項目目が短すぎる/), w); // 4.4
  assert.ok(has(warnings, /箇条書きの型.*6枚のうち3枚/), w); // 4.4
  assert.ok(has(warnings, /^S04.*順序がないと書いたのに steps/), w); // 4.5
});

test("回帰：ビルドの検査で、自由図の箱からのはみ出しは不合格。KPI の数字と、左右に並べた steps と table の上端はそろう", async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "harness-regression-")), "decks", "2026-10-20-regression");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(FIXTURE, path.join(dir, "outline.md"));
  const r = await build(dir);
  assert.equal(r.ok, false);
  assert.ok(has(r.inspect.boxover, /^S05: .*箱の幅よりずっと長い/), r.inspect.boxover.join("\n")); // 4.9
  assert.deepEqual(r.inspect.align, []); // 4.7・4.9（S03 の KPI）、4.5・4.9（S06 の diagrams）
});
