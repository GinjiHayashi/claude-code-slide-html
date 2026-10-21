// ビルド
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { SKILLS, tempDeck } from "./helpers.mjs";
import { python } from "../.claude/lib/common.mjs";

const { build } = await import(path.join(SKILLS, "html-build/scripts/build.mjs"));

test("ビルド：失敗したとき、前回の deck.html・deck.pdf を残さない", async () => {
  const dir = tempDeck();
  const out = path.join(dir, "build");
  fs.mkdirSync(out);
  for (const f of ["deck.html", "deck.pdf", "assets-manifest.yaml"]) fs.writeFileSync(path.join(out, f), "前回");
  const f = path.join(dir, "outline.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("- layout: toc", "- layout: no-such-layout"));
  const r = await build(dir);
  assert.equal(r.ok, false);
  assert.deepEqual(fs.readdirSync(out), ["build-log.md"]);
});

test("フォントのサブセット化：同じ文字なら毎回同じバイト列になる", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-font-"));
  fs.writeFileSync(path.join(dir, "t.html"), "<p>同じ文字</p>");
  const run = (out) => {
    execFileSync(python(), [path.join(SKILLS, "html-build/scripts/font-subset.py"), path.join(dir, "t.html"), path.join(dir, out)]);
    return fs.readFileSync(path.join(dir, out), "utf8");
  };
  const a = run("a.css");
  execFileSync("sleep", ["1.1"]); // フォントの時刻は秒の単位なので、秒をまたがせる
  assert.equal(run("b.css"), a);
});

test("shots：指定したスライドを 1280×720 の PNG に撮り、ない番号はエラーにする", async () => {
  const { shots } = await import(path.join(SKILLS, "html-build/scripts/shots.mjs"));
  const dir = tempDeck();
  await assert.rejects(shots(dir, ["S01"]), /先にビルドする/);
  assert.equal((await build(dir)).ok, true);
  const [file] = await shots(dir, ["S01"]);
  assert.equal(file, path.join(dir, "build", "shots", "S01.png"));
  const png = fs.readFileSync(file);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 720]); // IHDR の幅と高さ
  await assert.rejects(shots(dir, ["S99"]), /deck\.html にないスライド：S99/);
});

test("検査：図の箱からのはみ出し、線のラベルと箱の重なりは不合格。カードと左右の図の上端のずれ、図の片寄りは注意", async () => {
  const dir = tempDeck();
  const f = path.join(dir, "outline.md");
  const lead = "- lead: " + "検査が反応するかを確かめるために、わざと崩した図を置いたスライドです。".repeat(3);
  const slide = (id, html) =>
    [`## ${id}`, "- layout: title-diagram", "- title: 崩した図", lead, "- idea: i", "- match: 描けない：検査のため", `- html: '${html}'`, ""].join("\n");
  const broken = [
    // 小さい箱に長い文字（下にはみ出す）
    slide("S16", '<div data-kind="t"><div class="h-[40px] w-[80px] border-2 border-line">とても長い文字がこの小さな箱の外まで出てしまう</div></div>'),
    // 線のラベルが箱に重なる
    slide(
      "S17",
      '<div data-kind="t" class="relative h-[200px] w-[600px]"><svg class="absolute left-0 top-0" width="600" height="200"><text class="fill-ink text-body" x="40" y="40">ラベル</text></svg><div class="absolute left-[20px] top-[20px] h-[60px] w-[200px] border-2 border-line"></div></div>',
    ),
    // 横に並ぶカードで、ラベルの行数の違いから数字の上端がずれる
    slide(
      "S18",
      '<div data-kind="t" class="flex w-[400px] items-start gap-[24px]"><div class="w-[160px] border-2 border-line"><div class="text-body">短い</div><div class="text-kpi">6</div></div><div class="w-[160px] border-2 border-line"><div class="text-body">とても長いラベルが二行に折り返す</div><div class="text-kpi">12</div></div></div>',
    ),
    // 図が枠の右下に寄る
    slide("S19", '<div data-kind="t" class="relative h-full w-full"><div class="absolute bottom-0 right-0 h-[80px] w-[200px] bg-panel"></div></div>'),
  ];
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("## S15", `${broken.join("\n")}\n## S15`));
  const r = await build(dir);
  const has = (k, t) => r.inspect[k].some((x) => x.includes(t));
  assert.ok(has("boxover", "S16: div「とても長い文字がこの小さな箱の外まで出て」 が枠から"), r.inspect.boxover.join("\n"));
  assert.ok(has("overlap", "S17: 線のラベル text「ラベル」"), r.inspect.overlap.join("\n"));
  assert.ok(has("align", "S18: 横に並ぶ箱の"), r.inspect.align.join("\n"));
  assert.ok(has("offset", "S19: 図（t）が枠の右に寄っている") && has("offset", "S19: 図（t）が枠の下に寄っている"), r.inspect.offset.join("\n"));
  assert.equal(r.ok, false); // はみ出しと重なりは不合格
  const log = fs.readFileSync(path.join(dir, "build", "build-log.md"), "utf8");
  assert.match(log, /端のそろい（カードの上端・左右の図の上端）：\n  - S18/);
});
