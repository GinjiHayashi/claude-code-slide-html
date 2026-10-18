// ビルド
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { SKILLS, tempDeck } from "./helpers.mjs";

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
    execFileSync("python3", [path.join(SKILLS, "html-build/scripts/font-subset.py"), path.join(dir, "t.html"), path.join(dir, out)]);
    return fs.readFileSync(path.join(dir, out), "utf8");
  };
  const a = run("a.css");
  execFileSync("sleep", ["1.1"]); // フォントの時刻は秒の単位なので、秒をまたがせる
  assert.equal(run("b.css"), a);
});
