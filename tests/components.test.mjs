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
    // 部品が作る SVG には、ライセンスの照合で素材と見分けるための印（data-origin・data-asset-id）を付ける
    assert.doesNotMatch(html, /<svg(?![^>]*data-(origin|asset-id))/);
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

test("cards：見出しの帯と説明を同じ段でそろえ、まとめの帯を置ける。枚数と tone の誤りはエラー", async () => {
  const cards = (await import(path.join(COMP, "cards.mjs"))).default;
  const items = (n) => Array.from({ length: n }, (_, i) => ({ heading: `h${i}`, text: "説明" }));
  const html = cards({ items: items(6), summary: { text: "まとめ" } }, { width: 1172, deck });
  assert.equal((html.match(/grid-rows-subgrid/g) ?? []).length, 6);
  assert.match(html, /grid-template-columns:repeat\(3,/);
  assert.match(html, /grid-row:7;grid-column:1 \/ -1">まとめ/); // 2段（3行ずつ）のあと
  assert.match(cards({ items: items(4) }, { deck }), /grid-template-columns:repeat\(2,/);
  assert.throws(() => cards({ items: items(1) }, { deck }), /itemsは2〜6（今は1）/);
  assert.throws(() => cards({ items: [{ heading: "a", tone: "red" }, { heading: "b" }] }, { deck }), /tone は/);
});

test("cycle：4つの輪は四角の角に置く。exit は輪の右側の箱から、caption は row だけ", async () => {
  const cycle = (await import(path.join(COMP, "cycle.mjs"))).default;
  const items = ["a", "b", "c", "d"].map((label) => ({ label }));
  const html = cycle({ items }, { width: 600, height: 400 });
  const pos = [...html.matchAll(/text-center text-body font-bold [^"]*" style="left:([\d.]+)px;top:([\d.]+)px/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(pos.length, 4);
  assert.deepEqual(new Set(pos.map((p) => p[0])).size, 2); // 左右の2列
  assert.deepEqual(new Set(pos.map((p) => p[1])).size, 2); // 上下の2段
  assert.equal(Math.min(...pos.map((p) => p[0])), 0); // 枠の端まで広げる
  assert.throws(() => cycle({ items, exit: { from: 1, label: "x" } }, {}), /右側の箱/);
  assert.throws(() => cycle({ items: [{ label: "a", caption: "c" }, ...items.slice(1)] }, {}), /row のときだけ/);
  assert.match(cycle({ items, shape: "row", back: "くり返す" }, {}), /くり返す/);
});

test("cycle：exit があると、輪の箱と抜け出す先の箱が横に等間隔。上下の段のあいだは 96px まで。frame で囲む", async () => {
  const cycle = (await import(path.join(COMP, "cycle.mjs"))).default;
  const items = ["a", "b", "c", "d"].map((label) => ({ label }));
  const html = cycle({ items, exit: { from: 2, label: "x" } }, { width: 1172, height: 400 });
  const boxes = [...html.matchAll(/text-center text-body font-bold [^"]*" style="left:([\d.]+)px;top:([\d.]+)px;width:([\d.]+)px/g)].map((m) =>
    m.slice(1).map(Number),
  );
  const xs = [...new Set(boxes.map(([x]) => x))].sort((a, b) => a - b);
  const w = boxes[0][2];
  assert.equal(xs.length, 3);
  assert.ok(Math.abs(xs[1] - xs[0] - (xs[2] - xs[1])) < 0.2, `等間隔でない：${xs}`);
  assert.ok(xs[1] - xs[0] > w);
  const ys = [...new Set(boxes.map(([, y]) => y))].sort((a, b) => a - b);
  assert.equal(ys[1] - ys[0], 72 + 96); // 上下は左右と別に、箱のあいだ 96px
  const framed = cycle({ items, title: "良い循環", frame: true, tone: "primary" }, { width: 560, height: 400 });
  assert.match(framed, /bg-highlight/);
  assert.throws(() => cycle({ items, numbered: "x" }, {}), /numbered は/);
});

test("layers：3〜6層の帯。top・bottom で左に矢印とラベル、note で注記", async () => {
  const layers = (await import(path.join(COMP, "layers.mjs"))).default;
  const items = ["a", "b", "c"].map((label) => ({ label }));
  const html = layers({ items, top: "上", bottom: "下", note: "層の並びは AI が整理したもの" }, {});
  assert.match(html, /上<\/div>/);
  assert.match(html, /※ 層の並びは AI が整理したもの/);
  assert.doesNotMatch(layers({ items }, {}), /<svg/); // ラベルがなければ矢印を引かない
  assert.throws(() => layers({ items: items.slice(0, 2) }, {}), /3〜6/);
  assert.throws(() => layers({ items: [{ label: "a", tone: "red" }, ...items.slice(1)] }, {}), /tone は/);
});

test("hub：上の箱・帯・下の箱。下の箱は横に等間隔で、帯から線を下ろす", async () => {
  const hub = (await import(path.join(COMP, "hub.mjs"))).default;
  const items = ["a", "b", "c", "d"].map((label) => ({ label, text: "説明" }));
  const html = hub({ top: { label: "上" }, hub: { label: "口", text: "説明" }, items }, { width: 1172, height: 440 });
  const lines = [...html.matchAll(/d="M([\d.]+),[\d.]+V[\d.]+"/g)].map((m) => Number(m[1]));
  assert.equal(lines.length, 5); // 上と帯の1本と、下の箱への4本
  const xs = lines.slice(1);
  assert.ok(
    xs.every((x, k) => !k || Math.abs(x - xs[k - 1] - (xs[1] - xs[0])) < 0.2),
    `等間隔でない：${xs}`,
  );
  assert.match(html, /口<span class="font-normal">（説明）/);
  assert.throws(() => hub({ top: { label: "上" }, hub: { label: "口" }, items: items.slice(0, 1) }, {}), /2〜6/);
});

test("nested：外から内へ囲みを重ね、いちばん内側は青地", async () => {
  const nested = (await import(path.join(COMP, "nested.mjs"))).default;
  const html = nested({ items: [{ label: "外", text: "説明" }, { label: "中", tone: "soft" }, { label: "内" }] }, {});
  assert.ok(html.indexOf("外") < html.indexOf("中") && html.indexOf("中") < html.indexOf("内"));
  assert.match(html, /bg-primary[^>]*><span class="font-bold">内/);
  assert.throws(() => nested({ items: [{ label: "a" }, { label: "b" }, { label: "c", tone: "soft" }] }, {}), /いちばん内側/);
});

test("flow-notes：流れの箱、説明の箱、帯を同じ列にそろえる", async () => {
  const flowNotes = (await import(path.join(COMP, "flow-notes.mjs"))).default;
  const items = ["a", "b", "c"].map((label) => ({ label, note: `${label}の説明` }));
  const html = flowNotes({ items, base: { label: "帯" } }, {});
  assert.match(html, /grid-template-columns:minmax\(0,1fr\) 56px minmax\(0,1fr\) 56px minmax\(0,1fr\)/);
  assert.equal([...html.matchAll(/grid-row:3;grid-column:(\d)/g)].map((m) => m[1]).join(), "1,3,5"); // 説明は箱の真下
  assert.match(html, /grid-row:5;grid-column:1 \/ -1">帯/);
  assert.throws(() => flowNotes({ items: items.slice(0, 1) }, {}), /2〜5/);
});

test("数の決まり（limits）：部品が宣言した数を超えると止まり、schema.mjs の書き方で出せる", async () => {
  const { describeLimits } = await import(path.join(COMP, "_util.mjs"));
  for (const kind of Object.keys(DIAGRAMS)) {
    const { limits } = await import(path.join(COMP, `${kind}.mjs`));
    if (!limits) continue;
    for (const [k, v] of Object.entries(limits)) assert.ok(Array.isArray(v) && v.length === 2 && v[0] <= v[1], `${kind}.${k}`);
  }
  const cards = (await import(path.join(COMP, "cards.mjs"))).default;
  const items = Array.from({ length: 7 }, (_, i) => ({ heading: `h${i}` }));
  assert.throws(() => cards({ items }, { width: 1172, height: 440, deck }), /cards: itemsは2〜6（今は7）/);
  const table = (await import(path.join(COMP, "table.mjs"))).default;
  assert.throws(() => table({ ...DIAGRAMS.table, rows: Array.from({ length: 9 }, () => DIAGRAMS.table.rows[0]) }), /table: 行は8まで（今は9）/);
  assert.equal(describeLimits({ items: [2, 6], 行: [0, 8], cells: [4, 4] }), "items 2〜6、行 8まで、cells 4");
});
