// 書式のチェック（brief・outline・research・factcheck）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { SKILLS, SAMPLE, tempDeck } from "./helpers.mjs";

const { checkBrief, checkInputs } = await import(path.join(SKILLS, "slide-hearing/scripts/check-brief.mjs"));
const { checkOutline } = await import(path.join(SKILLS, "html-build/scripts/check-outline.mjs"));
const { checkResearch } = await import(path.join(SKILLS, "research-standards/scripts/check-research.mjs"));
const { checkFactcheck } = await import(path.join(SKILLS, "slide-factcheck/scripts/check-factcheck.mjs"));
const read = (f) => fs.readFileSync(path.join(SAMPLE, f), "utf8");
const outline = (...slides) => ["---", "deck_id: 2026-10-17-report-automation", "title: t", "---", "", ...slides.flatMap((s) => [...s, ""])].join("\n");

test("見本の brief.md は書式の誤りがない", () => {
  assert.deepEqual(checkBrief(read("brief.md")).errors, []);
});

test("brief.md：見出しが欠けるとエラー、空の項目は missing に出る", () => {
  const r = checkBrief("---\ndeck_id: 2026-10-17-x\n---\n\n## 目的・この資料で決めたいこと\n\n");
  assert.ok(r.errors.some((e) => e.includes("聞き手と前提知識")));
  assert.ok(r.missing.includes("目的・この資料で決めたいこと"));
  assert.ok(r.missing.includes("title"));
});

test("brief.md：inputs/ のファイルが入力の一覧にないとエラー", () => {
  const dir = tempDeck();
  fs.mkdirSync(path.join(dir, "inputs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "inputs", "memo.txt"), "メモ");
  const r = checkBrief(fs.readFileSync(path.join(dir, "brief.md"), "utf8"));
  assert.ok(checkInputs(r.sections, dir).some((e) => e.includes("inputs/memo.txt")));
});

test("見本の outline.md は書式の誤りがない", async () => {
  const r = await checkOutline(path.join(tempDeck(), "outline.md"));
  assert.deepEqual(r.errors, []);
  assert.ok(r.slides > 0);
});

test("outline.md：grid-4 の icon は、アイコン集の名前がないとエラー", async () => {
  const f = path.join(tempDeck(), "outline.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("icon: phosphor:steps", "icon: phosphor:no-such-icon"));
  const r = await checkOutline(f);
  assert.ok(
    r.errors.some((e) => e.includes("items の4つ目の") && e.includes("phosphor:no-such-icon")),
    r.errors.join("\n"),
  );
});

test("outline.md：一覧にない型・必須の項目の抜け・知らない項目はエラー", async () => {
  const dir = tempDeck();
  fs.writeFileSync(
    path.join(dir, "outline.md"),
    outline(["## S01", "- layout: nosuch"], ["## S02", "- layout: title-body", "- lead: false"], ["## S03", "- layout: toc", "- typo: 1"]),
  );
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.ok(r.errors.some((e) => e.startsWith("S01") && e.includes("nosuch")));
  assert.ok(r.errors.some((e) => e.startsWith("S02") && e.includes("title")));
  assert.ok(r.errors.some((e) => e.startsWith("S03") && e.includes("typo")));
});

test("outline.md：どの本文の型にも source を書ける。表紙の date は必須。checklist の知らない項目はエラー", async () => {
  const dir = tempDeck();
  fs.writeFileSync(
    path.join(dir, "outline.md"),
    outline(
      ["## S01", "- layout: title", "- title: t"],
      ["## S02", "- layout: do-dont", "- title: t", "- lead: false", "- source: s", "- do: {items: [a]}", "- dont: {items: [b]}"],
      [
        "## S03",
        "- layout: grid-4",
        "- title: t",
        "- lead: false",
        "- source: s",
        "- items: [{heading: a, text: a}, {heading: b, text: b}, {heading: c, text: c}, {heading: d, text: d}]",
      ],
      ["## S04", "- layout: checklist", "- title: t", "- lead: false", "- source: s", "- items: [{text: a, done: true, note: x}]"],
    ),
  );
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.ok(r.errors.some((e) => e.startsWith("S01") && e.includes("date")));
  assert.ok(!r.errors.some((e) => e.includes("source")), r.errors.join("\n"));
  assert.ok(r.errors.some((e) => e.startsWith("S04") && e.includes("note")));
  assert.equal(r.errors.filter((e) => /^S0[23]/.test(e)).length, 0, r.errors.join("\n"));
});

test("outline.md：html: のスクリプトはエラー", async () => {
  const dir = tempDeck();
  fs.writeFileSync(
    path.join(dir, "outline.md"),
    outline(["## S01", "- layout: title-diagram", "- title: t", "- lead: false", '- html: "<script>alert(1)</script>"']),
  );
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.ok(r.errors.some((e) => e.includes("スクリプト")));
});

test("outline.md：claims の ID が research.md にないとエラー", async () => {
  const dir = tempDeck();
  fs.writeFileSync(
    path.join(dir, "outline.md"),
    outline(["## S01", "- layout: title-body", "- title: t", "- lead: false", "- body: [a]", "- claims: [C-999]"]),
  );
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.ok(r.errors.some((e) => e.includes("C-999")));
});

test("見本の research.md は書式の誤りがない", () => {
  assert.deepEqual(checkResearch(read("research.md")).errors, []);
});

test("research.md：確認済みなのに一次情報が1つならエラー", () => {
  const md = [
    "---",
    "deck_id: 2026-10-17-x",
    "---",
    "",
    "## C-001",
    "- topic: t",
    "- claim: c",
    "- kind: 事実",
    "- confidence: 確認済み",
    "- as_of: 2026",
    "- sources:",
    "    - {url: https://www.example.go.jp/a, title: a, publisher: p, published: 2026-01-01, accessed: 2026-10-18, tier: 一次, locator: 1ページ}",
    "",
  ].join("\n");
  assert.ok(checkResearch(md).errors.some((e) => e.includes("確認済み")));
});

const finding = (extra) =>
  ["---", "deck_id: 2026-10-17-x", "---", "", "## FC-101", "- slide: S02", "- claim_id: なし", "- target: 「a」", ...extra, ""].join("\n");
const SRC = [
  "- sources:",
  "    - {url: https://www.example.go.jp/a, title: a, publisher: p, published: 2026-01-01, accessed: 2026-10-18, tier: 一次, locator: 表1}",
];

test("factcheck.md：判断のない P0 は判断待ち", () => {
  const r = checkFactcheck(finding(["- level: P0", "- problem: p", ...SRC, "- suggestion: s"]));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.waiting, ["FC-101"]);
});

test("factcheck.md：根拠のない P0、理由のない「残す」はエラー", () => {
  assert.ok(checkFactcheck(finding(["- level: P0", "- problem: p", "- suggestion: s"])).errors.some((e) => e.includes("sources")));
  assert.ok(
    checkFactcheck(finding(["- level: P1", "- problem: p", ...SRC, "- suggestion: s", "- decision: 残す"])).errors.some((e) => e.includes("decision_note")),
  );
});

test("factcheck.md：「引用しない」のドメインを根拠にするとエラー", () => {
  const r = checkFactcheck(
    finding([
      "- level: P1",
      "- problem: p",
      "- sources:",
      "    - {url: https://ja.wikipedia.org/wiki/a, title: a, publisher: p, published: 不明, accessed: 2026-10-18, tier: 二次, locator: x}",
      "- suggestion: s",
    ]),
  );
  assert.ok(r.errors.some((e) => e.includes("wikipedia.org")));
});

test("brief のチェック：空の項目を questions.md の表の順に出す（deck_id は最後）", () => {
  const text =
    "---\ndeck_id:\ntitle:\nsubtitle:\ndate:\nauthor:\ncontact:\npdf:\n---\n\n" +
    [
      "目的・この資料で決めたいこと",
      "聞き手と前提知識",
      "伝えたい結論（1文）",
      "発表時間・枚数の目安",
      "調査が必要な項目",
      "必ず入れる要素・入れない要素",
      "構成の進め方",
    ]
      .map((h) => `## ${h}\n`)
      .join("\n");
  const rows = fs
    .readFileSync(path.join(SKILLS, "slide-hearing/questions.md"), "utf8")
    .match(/^\| \d+ \| [^|]+/gm)
    .map((r) => r.split("|")[2].trim());
  assert.deepEqual(checkBrief(text).missing, rows);
});
