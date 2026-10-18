// 図の部品とスライドの型
import test from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { SKILLS, tempDeck } from "./helpers.mjs";
import { DIAGRAMS } from "./fixtures/diagrams.mjs";

const COMP = path.join(SKILLS, "html-build/components");
const { KINDS } = await import(path.join(SKILLS, "html-build/scripts/check-outline.mjs"));
const { readOutline } = await import(path.join(SKILLS, "html-build/scripts/outline.mjs"));
const { renderDeck } = await import(path.join(SKILLS, "html-build/layouts.mjs"));

test("テストのデータが、図の型の一覧と同じ顔ぶれ", () => {
  assert.deepEqual(Object.keys(DIAGRAMS).sort(), [...KINDS].sort());
});

for (const kind of Object.keys(DIAGRAMS)) {
  test(`部品 ${kind}：最小のデータで HTML を返し、必須の項目がなければ止まる`, async () => {
    const f = (await import(path.join(COMP, `${kind}.mjs`))).default;
    const html = f(DIAGRAMS[kind], { width: 1172, height: 440 });
    assert.equal(typeof html, "string");
    assert.ok(html.length > 0);
    assert.throws(() => f({}, { width: 1172, height: 440 }));
  });
}

test("見本の outline.md の全スライドを組み立てられる", async () => {
  const o = readOutline(path.join(tempDeck(), "outline.md"));
  const html = await renderDeck(o);
  assert.equal(html.length, o.slides.length);
  for (const [i, h] of html.entries()) assert.ok(h.includes(`data-id="${o.slides[i].id}"`));
});
