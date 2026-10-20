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
