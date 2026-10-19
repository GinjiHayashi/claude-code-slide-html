// 図の部品とスライドの型
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { SKILLS, SAMPLE, tempDeck } from "./helpers.mjs";
import { DIAGRAMS } from "./fixtures/diagrams.mjs";

const COMP = path.join(SKILLS, "html-build/components");
const { KINDS } = await import(path.join(SKILLS, "html-build/scripts/spec.mjs"));
const { readOutline } = await import(path.join(SKILLS, "html-build/scripts/outline.mjs"));
const { renderDeck } = await import(path.join(SKILLS, "html-build/layouts.mjs"));
// 画像の部品が読むデッキ（見本の outline.md の assets）
const deck = { dir: SAMPLE, assets: readOutline(path.join(SAMPLE, "outline.md")).meta.assets };

test("テストのデータが、図の型の一覧と同じ顔ぶれ", () => {
  assert.deepEqual(Object.keys(DIAGRAMS).sort(), [...KINDS].sort());
});

for (const kind of Object.keys(DIAGRAMS)) {
  test(`部品 ${kind}：最小のデータで HTML を返し、必須の項目がなければ止まる`, async () => {
    const f = (await import(path.join(COMP, `${kind}.mjs`))).default;
    const html = f(DIAGRAMS[kind], { width: 1172, height: 440, deck });
    assert.equal(typeof html, "string");
    assert.ok(html.length > 0);
    assert.throws(() => f({}, { width: 1172, height: 440, deck }));
    assert.throws(() => f({ ...DIAGRAMS[kind], highlite: 1 }, { width: 1172, height: 440, deck }), /知らない項目 highlite/);
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

test("code：色は theme.css のトークンのクラスで出し、使えない言語は止まる", async () => {
  const code = (await import(path.join(COMP, "code.mjs"))).default;
  const html = code({ lang: "python", code: "def f():\n    return 'a' # c\n" });
  assert.ok(html.includes('<span class="text-code-keyword">def</span>'));
  assert.ok(html.includes("text-code-comment"));
  assert.ok(html.includes(">Python</span>") && !code({ lang: "text", code: "x" }).includes("rounded-full border"));
  assert.ok(code({ lang: "python", code: "x", file: "a.py" }).includes('font-bold text-ink">a.py</span>'));
  assert.ok(!/#[0-9a-f]{6}|style=/i.test(html));
  assert.throws(() => code({ lang: "cobol", code: "x" }), /lang に cobol は使えない/);
});

test("文中のコード：`…` を <code> にし、中の ** は太字にしない", async () => {
  const dir = tempDeck();
  const f = path.join(dir, "outline.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("本部が手で貼り合わせて", "本部が `a**b**` で **手で**貼り合わせて"));
  const html = (await renderDeck(readOutline(f))).join("\n");
  assert.ok(html.includes("<code>a**b**</code> で <strong"));
});

test("image：assets にない素材は止まり、アイコンは色を currentColor にして埋め込む", async () => {
  const image = (await import(path.join(COMP, "image.mjs"))).default;
  assert.throws(() => image({ src: "inputs/nothing.png", alt: "x" }, { deck }), /assets にない/);
  const html = image({ src: "inputs/screen-entry.png", alt: "画面", fit: "contain" }, { width: 572, height: 400, deck });
  assert.ok(html.includes('data-deck-asset="inputs/screen-entry.png"') && html.includes("rounded-panel"));
  assert.ok(html.includes("width:572px;height:321px")); // 960×540 を幅 572 に収める
  assert.ok(html.includes("border border-line"));
  const dir = tempDeck();
  fs.writeFileSync(path.join(dir, "inputs/i.svg"), '<svg viewBox="0 0 24 24"><path fill="#000000" d="M0 0h24v24H0z"/></svg>');
  const own = { dir, assets: [{ src: "inputs/i.svg", credit: "自作", license: "自作" }] };
  const icon = image({ src: "inputs/i.svg", alt: "確認", icon: true }, { width: 572, height: 400, deck: own });
  assert.ok(icon.includes('fill="currentColor"') && !icon.includes("#000000") && icon.includes('data-deck-asset="inputs/i.svg"'));
});

test("アイコン集：phosphor:<名前> は assets に書かずに使え、data-asset-id で registry の id として見つかる", async () => {
  const image = (await import(path.join(COMP, "image.mjs"))).default;
  const { searchIcons } = await import(path.join(SKILLS, "html-build/scripts/icons.mjs"));
  const { scanDeck } = await import(path.join(SKILLS, "license-notice/scripts/scan.mjs"));
  const html = image({ src: "phosphor:users", alt: "人々" }, { width: 572, height: 400, deck });
  assert.ok(html.includes('data-asset-id="phosphor:users"') && html.includes('fill="currentColor"') && html.includes("text-primary"));
  assert.throws(() => image({ src: "phosphor:no-such-icon", alt: "x" }, { deck }), /アイコン「phosphor:no-such-icon」がない/);
  assert.throws(() => image({ src: "phosphor:../x", alt: "x" }, { deck }), /書き方が違う/);
  assert.equal(searchIcons(["team"])[0].ref, "phosphor:users");
  const scan = scanDeck(`<section class="slide" data-id="S01">${html}</section>`);
  assert.deepEqual(
    scan.assets.map((a) => a.id),
    ["phosphor"],
  );
  assert.deepEqual(scan.untaggedSvg, []);
});

test("ライセンスの照合：assets にないデッキの素材はエラー、あれば credits に載る", async () => {
  const { scanDeck } = await import(path.join(SKILLS, "license-notice/scripts/scan.mjs"));
  const { verify } = await import(path.join(SKILLS, "license-notice/scripts/verify.mjs"));
  const { credits } = await import(path.join(SKILLS, "license-notice/scripts/credits.mjs"));
  const html = '<section class="slide" data-id="S01"><img src="data:image/png;base64,AA" alt="" data-deck-asset="inputs/a.png"></section>';
  const scan = scanDeck(html);
  assert.deepEqual(scan.deckAssets, ["inputs/a.png"]);
  assert.deepEqual(scan.unknown, []);
  assert.ok(verify(scan, []).errors.some((e) => e.includes("inputs/a.png が outline.md の先頭の assets にない")));
  const assets = [{ src: "inputs/a.png", credit: "自組織", license: "自組織の素材" }];
  assert.ok(!verify(scan, assets).errors.some((e) => e.includes("inputs/a.png")));
  assert.deepEqual(credits([], new Map(), { used: scan.deckAssets, assets }).rows, [
    { id: "deck", name: "画像：a.png", license: "自組織の素材", copyright: "自組織" },
  ]);
});

test("dirtree：ファイルの下に行を書く・1行目の字下げはエラー", async () => {
  const { default: dirtree } = await import(path.join(COMP, "dirtree.mjs"));
  assert.throws(() => dirtree({ tree: "a/\n  b.txt\n    c.txt" }, { deck }), /ファイルなので/);
  assert.throws(() => dirtree({ tree: "  a/\n    b.txt" }, { deck }), /1行目は字下げしない/);
});

test("canvas：格子からはみ出す形と、ない id への線はエラー", async () => {
  const { default: canvas } = await import(path.join(COMP, "canvas.mjs"));
  assert.throws(() => canvas({ shapes: [{ type: "box", at: [11, 5], size: [2, 1], text: "a" }] }, { deck }));
  assert.throws(() =>
    canvas(
      {
        shapes: [
          { type: "box", id: "a", at: [0, 0], text: "a" },
          { type: "line", from: "a", to: "zz" },
        ],
      },
      { deck },
    ),
  );
});
