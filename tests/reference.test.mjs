// 資料の md 化（slide-intake/scripts/reference.mjs・to-md.py）のテスト
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { ROOT, SKILLS, SAMPLE } from "./helpers.mjs";

const { convert, checkReference, referenceStatus, AI_READ_TODO } = await import(path.join(SKILLS, "slide-intake/scripts/reference.mjs"));
const { python } = await import(path.join(ROOT, ".claude/lib/common.mjs"));

// inputs/ にテスト用の資料（Excel・Word・PowerPoint・PDF 2つ・画像・チャット）を置いたデッキ
function deck() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "harness-ref-")), "decks", "2026-10-21-ref");
  fs.mkdirSync(path.join(dir, "inputs"), { recursive: true });
  execFileSync(python(), [path.join(ROOT, "tests/fixtures/office.py"), path.join(dir, "inputs")]);
  fs.copyFileSync(path.join(SAMPLE, "assets/screen-entry.png"), path.join(dir, "inputs/screen-entry.png"));
  fs.writeFileSync(path.join(dir, "inputs/chat-2026-10-21.md"), "依頼：月次の資料を作る\n");
  return dir;
}
const md = (dir, id) => {
  const s = referenceStatus(dir).sources.find((x) => x.meta.id === id);
  return { ...s, path: path.join(dir, s.file) };
};

test("reference：機械で読める資料は表やページごとの md にし、読めないもの（画像・文字のない PDF）は AI の読み取りのひな形にする", () => {
  const dir = deck();
  assert.equal(checkReference(dir).errors.length, 7); // まだ md がない
  const r = convert(dir);
  assert.deepEqual(r.errors, []);
  const by = Object.fromEntries(r.done.map((d) => [d.source, d]));
  assert.equal(by["inputs/chat-2026-10-21.md"].md, "reference/chat/R-001-chat-2026-10-21.md");
  assert.equal(by["inputs/scan.pdf"].method, "AI の読み取り");
  assert.equal(by["inputs/screen-entry.png"].method, "AI の読み取り");
  const text = (src) => fs.readFileSync(path.join(dir, by[src].md), "utf8");
  assert.match(text("inputs/実績.xlsx"), /## シート：9月（A1:B2）[\s\S]*\| 2 \| 総務 \| 6 \|/);
  assert.match(text("inputs/方針.docx"), /## 背景\n\n月次レポートを自動化する。\n\n\| 項目 \| 値 \|/);
  assert.match(text("inputs/報告.pptx"), /## スライド 1[\s\S]*## スライド 2\n\n- 結論\n- 40時間が6時間に\n\nノート：\n\n試行の結果を話す\n\n## スライド 10/);
  assert.match(text("inputs/text.pdf"), /## p\.1\n\nMonthly report: 40 hours/);
  assert.match(text("inputs/実績.xlsx"), /^---\nid: R-\d{3}\nsource: inputs\/実績\.xlsx\nsha256: [0-9a-f]{64}\nformat: xlsx\nmethod: 機械（to-md\.py）/);
  assert.match(fs.readFileSync(path.join(dir, "reference/index.md"), "utf8"), /\| R-001 \| chat\/R-001-chat-2026-10-21\.md \| inputs\/chat-2026-10-21\.md \|/);

  // AI の読み取りが終わるまではエラー。書いて印を消せば通る
  const c = checkReference(dir);
  assert.deepEqual(
    c.errors.map((e) => e.split("：")[0]),
    [by["inputs/scan.pdf"].md, by["inputs/screen-entry.png"].md],
  );
  for (const src of ["inputs/scan.pdf", "inputs/screen-entry.png"]) {
    const f = path.join(dir, by[src].md);
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(new RegExp(`<!-- ${AI_READ_TODO}.*-->`), "入力の画面。"));
  }
  assert.deepEqual(checkReference(dir).errors, []);
  assert.ok(checkReference(dir).warnings.some((w) => w.includes("summary")));
});

test("reference：資料が変わったら同じ ID で作り直し、summary は残す。inputs/ がない端末では md だけで通す。assets/ に移した画像は注意にしない", () => {
  const dir = deck();
  convert(dir);
  const x = md(dir, "R-006");
  fs.writeFileSync(x.path, fs.readFileSync(x.path, "utf8").replace('summary: ""', "summary: 9月の部署別の作成時間"));
  execFileSync(process.execPath, [path.join(SKILLS, "slide-intake/scripts/reference.mjs"), dir, "--index"]);
  fs.appendFileSync(path.join(dir, "inputs/chat-2026-10-21.md"), "追記\n");
  assert.ok(checkReference(dir).errors.some((e) => e.startsWith("inputs/chat-2026-10-21.md が md にしたあとで変わった")));
  const r = convert(dir);
  assert.deepEqual(
    r.done.map((d) => d.id),
    ["R-001"],
  );
  assert.match(fs.readFileSync(md(dir, "R-001").path, "utf8"), /追記/);
  assert.match(fs.readFileSync(md(dir, "R-006").path, "utf8"), /summary: 9月の部署別の作成時間/);

  // 画像を assets/ に移す → 注意にしない。inputs/ ごとない → md だけで確かめる
  fs.mkdirSync(path.join(dir, "assets"));
  fs.renameSync(path.join(dir, "inputs/screen-entry.png"), path.join(dir, "assets/screen-entry.png"));
  assert.ok(!checkReference(dir).warnings.some((w) => w.includes("screen-entry.png が inputs/ にも")));
  fs.rmSync(path.join(dir, "inputs"), { recursive: true });
  const c = checkReference(dir);
  assert.ok(c.errors.every((e) => e.includes(AI_READ_TODO)));
  assert.ok(!c.warnings.some((w) => w.includes("inputs/ にも assets/ にもない")));

  // index.md を手で直すとエラー
  fs.appendFileSync(path.join(dir, "reference/index.md"), "手で足した行\n");
  assert.ok(checkReference(dir).errors.some((e) => e.startsWith("reference/index.md が md の先頭の設定と合わない")));
});
