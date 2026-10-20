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
  // 線の先・曲がる点・括弧・吹き出しの先も格子の中。size は正の数。cubes の filled は並び
  for (const s of [
    { type: "line", from: [0, 0], to: [30, 2] },
    { type: "line", from: [0, 0], to: [2, 2], via: [[-1, 1]] },
    { type: "brace", from: [20, 0], to: [20, 2] },
    { type: "note", at: [0, 0], text: "a", to: [0, 99] },
    { type: "box", at: [1, 1], size: [-2, 1], text: "a" },
    { type: "cubes", at: [0, 0], size: [4, 2], count: [3, 1], filled: 2 },
  ])
    assert.throws(() => canvas({ shapes: [s] }, { deck }), /格子|正の数|並び/, JSON.stringify(s));
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

test("枠線：囲みの型（two-column・do-dont・grid-4）、表の既定（grid）、自由図の card に、箱と同じ線を付ける", async () => {
  const { LINE } = await import(path.join(COMP, "_util.mjs"));
  const html = await renderDeck(readOutline(path.join(tempDeck(), "outline.md")));
  for (const layout of ["two-column", "do-dont", "grid-4"]) {
    const section = html.find((h) => h.includes(`data-layout="${layout}"`));
    assert.ok(section?.includes(`border-2 ${LINE.border}`), layout);
  }
  const table = (await import(path.join(COMP, "table.mjs"))).default;
  assert.match(table(DIAGRAMS.table), new RegExp(`^<div class="overflow-hidden rounded-panel border-2 ${LINE.border}">`));
  assert.doesNotMatch(table({ ...DIAGRAMS.table, style: "zebra" }), new RegExp(LINE.border));
  const canvas = (await import(path.join(COMP, "canvas.mjs"))).default;
  const card = canvas({ shapes: [{ type: "area", at: [0, 0], size: [4, 3], tone: "card" }] }, { width: 1172, height: 440, deck });
  assert.match(card, new RegExp(`border-2 bg-canvas ${LINE.border}`));
});

test("部品の直し：表の `…` はコードの字、kpi は狭い枠で縦に積む、丸の小、箱の字は図でそろう、流れ図の col・row は 0 にそろえる", async () => {
  const table = (await import(path.join(COMP, "table.mjs"))).default;
  const t = table({ columns: ["コマンド", "働き"], rows: [["`/init`", "`CLAUDE.md` を作る"]] });
  assert.match(t, /<code>\/init<\/code>/);
  assert.doesNotMatch(t, /`/);

  const kpi = (await import(path.join(COMP, "kpi.mjs"))).default;
  const items = ["a", "b", "c", "d"].map((label) => ({ label, value: "1" }));
  assert.match(kpi({ items }, { width: 1172 }), /grid-rows-subgrid/);
  assert.match(kpi({ items }, { width: 572 }), /grid-cols-subgrid/);

  const canvas = (await import(path.join(COMP, "canvas.mjs"))).default;
  const opt = { width: 1172, height: 440, deck };
  const two = canvas(
    {
      shapes: [
        { type: "box", id: "a", at: [0, 1], size: [3, 2], text: "大" },
        { type: "box", id: "b", at: [4, 1], size: [1, 1], text: "小" },
        { type: "badge", on: "b", text: "1", size: "small" },
      ],
    },
    opt,
  );
  assert.doesNotMatch(two, /text-heading/); // 小さい箱に合わせて、大きい箱も body
  assert.match(two, /width:24\.0px;height:24\.0px/);
  assert.match(canvas({ shapes: [{ type: "box", at: [0, 0], text: "a", text_size: "heading" }] }, opt), /text-heading/);
  assert.throws(() => canvas({ shapes: [{ type: "badge", at: [1, 1], text: "1", size: "big" }] }, opt), /size は small/);

  const fc = (await import(path.join(COMP, "flowchart.mjs"))).default;
  const nodes = (b) => [0, 1, 2].map((k) => ({ id: `n${k}`, label: `n${k}`, col: k + b, row: b }));
  const edges = [
    { from: "n0", to: "n1" },
    { from: "n1", to: "n2" },
  ];
  assert.equal(fc({ nodes: nodes(1), edges }, { width: 572, height: 400 }), fc({ nodes: nodes(0), edges }, { width: 572, height: 400 }));
});

test("章の扉：title は2行まで書け、目次とパンくずでは1行にまとめる", async () => {
  const dir = tempDeck();
  const file = path.join(dir, "outline.md");
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/- layout: section\n- title: (.+)\n/);
  fs.writeFileSync(file, src.replace(m[0], `- layout: section\n- title: |\n    実例\n    ${m[1]}\n`));
  const html = await renderDeck(readOutline(file));
  assert.ok(html.find((h) => h.includes('data-layout="section"')).includes(`実例<br>${m[1]}`));
  const toc = html.find((h) => h.includes('data-layout="toc"'));
  assert.ok(toc.includes(`実例 ${m[1]}`));
});
