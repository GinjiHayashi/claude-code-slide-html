// ビルド
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
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
