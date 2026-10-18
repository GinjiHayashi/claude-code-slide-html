// 図の部品とスライドの型
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { SKILLS, tempDeck } from "./helpers.mjs";
import { DIAGRAMS } from "./fixtures/diagrams.mjs";

const COMP = path.join(SKILLS, "html-build/components");
const { KINDS } = await import(path.join(SKILLS, "html-build/scripts/spec.mjs"));
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
    assert.throws(() => f({ ...DIAGRAMS[kind], highlite: 1 }, { width: 1172, height: 440 }), /知らない項目 highlite/);
  });
}

test("部品：入れ子の項目の書き間違いも止まる（matrix の軸の name は label の誤り）", async () => {
  const matrix = (await import(path.join(COMP, "matrix.mjs"))).default;
  const d = DIAGRAMS.matrix;
  assert.throws(() => matrix({ ...d, x_axis: { name: "影響", low: "小", high: "大" } }), /知らない項目 x_axis\.name/);
  const bar = (await import(path.join(COMP, "bar.mjs"))).default;
  assert.throws(() => bar({ ...DIAGRAMS.bar, data: [{ label: "A", valu: 1 }] }), /data\[1\]\.valu/);
});

test("schema.mjs：全部の図の型の項目を出せる", async () => {
  const { schemaOf } = await import(path.join(SKILLS, "html-build/scripts/schema.mjs"));
  const { describe } = await import(path.join(COMP, "_util.mjs"));
  for (const k of KINDS) assert.ok(describe(await schemaOf(k)).length > 0, k);
});

test("spec.mjs：全部のスライドの型の決まりを出せ、余白は theme.css から読む", async () => {
  const { LAYOUTS, SPACE, describeLayout } = await import(path.join(SKILLS, "html-build/scripts/spec.mjs"));
  for (const l of Object.keys(LAYOUTS)) assert.match(describeLayout(l), /^必須：.*｜任意：/, l);
  const css = fs.readFileSync(path.join(SKILLS, "html-build/theme.css"), "utf8");
  assert.ok(css.includes(`--spacing-slide-x: ${SPACE.x}px`));
});

test("見本の outline.md の全スライドを組み立てられる", async () => {
  const o = readOutline(path.join(tempDeck(), "outline.md"));
  const html = await renderDeck(o);
  assert.equal(html.length, o.slides.length);
  for (const [i, h] of html.entries()) assert.ok(h.includes(`data-id="${o.slides[i].id}"`));
});
