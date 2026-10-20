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

test("brief.md：max_subagents は 1〜10 の整数", () => {
  const brief = (v) => checkBrief(`---\ndeck_id: 2026-10-17-x\nmax_subagents: ${v}\n---\n`).errors.some((e) => e.includes("max_subagents"));
  assert.equal(brief(3), false);
  assert.equal(brief(0), true);
  assert.equal(brief(11), true);
  assert.equal(brief("おまかせ"), true);
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

test("outline.md：図のイメージ（idea・match）。match の書き方の誤りはエラー、描き方との食い違いは注意", async () => {
  const f = path.join(tempDeck(), "outline.md");
  const src = fs.readFileSync(f, "utf8");
  const run = async (from, to) => {
    fs.writeFileSync(f, src.replace(from, to));
    return checkOutline(f);
  };
  // S06 は flowchart（部品）で描いている
  let r = await run("- match: そのまま\n- lead: 月次レポートは", "- match: たぶん合う\n- lead: 月次レポートは");
  assert.ok(
    r.errors.some((e) => e.startsWith("S06") && e.includes("match は")),
    r.errors.join("\n"),
  );
  r = await run("- match: そのまま\n- lead: 月次レポートは", "- match: 意味が欠ける\n- lead: 月次レポートは");
  assert.ok(
    r.errors.some((e) => e.startsWith("S06") && e.includes("「：」のあと")),
    r.errors.join("\n"),
  );
  r = await run("- match: そのまま\n- lead: 月次レポートは", "- match: 意味が欠ける：貼り合わせの手間が伝わらない\n- lead: 月次レポートは");
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.startsWith("S06") && w.includes("一覧の型（flowchart）で描いている")));
  // 「意味が欠ける」を自由図（canvas）で描くのは食い違いではない。「そのまま」を canvas で描くのは注意
  const canvas = "- diagram:\n    kind: canvas\n    shapes:\n      - {type: box, at: [1, 1], text: a}\n";
  const s06 = (m) => src.replace(/(## S06\n[\s\S]*?)- match: そのまま\n([\s\S]*?)- diagram:\n(?:    .*\n|      .*\n)+/, `$1- match: ${m}\n$2${canvas}`);
  fs.writeFileSync(f, s06("意味が欠ける：貼り合わせの手間が伝わらない"));
  r = await checkOutline(f);
  assert.deepEqual(r.errors, []);
  assert.ok(!r.warnings.some((w) => w.startsWith("S06") && w.includes("描いている")), r.warnings.join("\n"));
  fs.writeFileSync(f, s06("そのまま"));
  r = await checkOutline(f);
  assert.ok(
    r.warnings.some((w) => w.startsWith("S06") && w.includes("自由図（canvas）で描いている")),
    r.warnings.join("\n"),
  );
  r = await run(/- idea: 部門の表が[^\n]*\n- match: そのまま\n/, "");
  assert.ok(r.warnings.some((w) => w.startsWith("S06") && w.includes("idea")));
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

test("outline.md：箇条書きの下の階層と numbered", async () => {
  const dir = tempDeck();
  const slide = (id, body, more = []) => [`## ${id}`, "- layout: title-body", "- title: t", "- lead: false", `- body: ${body}`, ...more];
  fs.writeFileSync(
    path.join(dir, "outline.md"),
    outline(
      slide("S01", "[a, [a1, a2], b]", ["- numbered: true"]),
      slide("S02", "[[a1], a]"),
      slide("S03", "[a, [a1, [a11]]]"),
      slide("S04", "[a, b]", ["- numbered: はい"]),
      ["## S05", "- layout: section", "- title: t", "- topics: [a, [a1], b, c]"],
      ["## S06", "- layout: two-column", "- title: t", "- lead: false", "- left: { items: [a, [a1]] }", "- right: { items: [b] }"],
    ),
  );
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.ok(!r.errors.some((e) => e.startsWith("S01")), r.errors.join("\n"));
  for (const id of ["S02", "S03", "S04", "S05", "S06"])
    assert.ok(
      r.errors.some((e) => e.startsWith(id)),
      `${id}\n${r.errors.join("\n")}`,
    );
});

test("outline.md：表紙の title は spec の行数まで（3行はエラー、1行の字数超えは注意）", async () => {
  const dir = tempDeck();
  const cover = (id, title) => [`## ${id}`, "- layout: title", `- title: "${title}"`, "- date: 2026年10月24日"];
  fs.writeFileSync(path.join(dir, "outline.md"), outline(cover("S01", "a\\nb\\nc"), cover("S02", "あ".repeat(23))));
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.ok(
    r.errors.some((e) => e.startsWith("S01") && e.includes("2行まで")),
    r.errors.join("\n"),
  );
  assert.ok(
    r.warnings.some((e) => e.startsWith("S02") && e.includes("22字")),
    r.warnings.join("\n"),
  );
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
    "---\ndeck_id:\ntitle:\nsubtitle:\ndate:\nauthor:\ncontact:\npdf:\nmax_subagents:\n---\n\n" +
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

test("outline.md：lead は目安より短いと注意（lead_short に理由を書けば出ない）、3行を超えるとエラー。目安の長さは決まった幅で3行に収まる", async () => {
  const { leadWidth, LEAD } = await import(path.join(SKILLS, "html-build/scripts/outline.mjs"));
  const zen = (n) => "あ".repeat(n - 1) + "。";
  const slide = (lead, more = []) => ["## S01", "- layout: title-body", "- title: t", `- lead: ${lead}`, "- body: [a]", ...more];
  const check = async (...s) => {
    const dir = tempDeck();
    fs.writeFileSync(path.join(dir, "outline.md"), outline(s));
    return checkOutline(path.join(dir, "outline.md"));
  };
  const short = (r) => r.warnings.some((w) => w.includes("lead が短い"));
  assert.equal(short(await check(...slide(zen(70)))), true);
  assert.equal(short(await check(...slide(zen(70), ["- lead_short: 表が大きいため"]))), false);
  assert.equal(short(await check(...slide(zen(145)))), false);
  assert.ok((await check(...slide(zen(145), ["- lead_short: 表が大きいため"]))).warnings.some((w) => w.includes("lead_short は要らない")));
  assert.ok((await check(...slide(zen(230)))).errors.some((e) => e.includes("3行に収まらない")));
  // 目安の上限（160字）までは決まった幅のまま。超えたときだけ広がる
  assert.equal(leadWidth(zen(150)), LEAD.base);
  assert.equal(leadWidth(zen(LEAD.target[1])), LEAD.base);
  assert.ok(leadWidth(zen(190)) > LEAD.base);
});

test("outline.md：箇条書きの型が本文のあるスライドの3割を超える・箇条書きの項目が短すぎると注意", async () => {
  const lead = "- lead: " + "あ".repeat(144) + "。";
  const body = (id, items) => [`## ${id}`, "- layout: title-body", "- title: t", lead, `- body: [${items}]`];
  const chart = (id) => [
    `## ${id}`,
    "- layout: title-diagram",
    "- title: t",
    lead,
    "- idea: i",
    "- match: そのまま",
    "- diagram: {kind: kpi, items: [{label: a, value: '1'}]}",
  ];
  const check = async (...s) => {
    const dir = tempDeck();
    fs.writeFileSync(path.join(dir, "outline.md"), outline(...s));
    return (await checkOutline(path.join(dir, "outline.md"))).warnings;
  };
  const long = "部署ごとに表の形が違うため、本部が手で貼り合わせている";
  const ratio = (w) => w.some((x) => x.includes("箇条書きの型（"));
  assert.equal(ratio(await check(body("S01", long), body("S02", long), chart("S03"))), true); // 2/3
  assert.equal(ratio(await check(body("S01", long), chart("S02"), chart("S03"), chart("S04"))), false); // 1/4
  const short = (w) => w.some((x) => x.includes("短すぎる"));
  assert.equal(short(await check(body("S01", "時間がかかる"))), true);
  assert.equal(short(await check(body("S01", long))), false);
});

test("outline.md：同じ型・同じ図の型が3枚続く、1つの図の型が図のあるスライドの4割を超えると注意", async () => {
  const lead = "- lead: " + "あ".repeat(144) + "。";
  const fig = (id, layout, kind) => [
    `## ${id}`,
    `- layout: ${layout}`,
    "- title: t",
    lead,
    "- idea: i",
    "- match: そのまま",
    ...(layout === "text-diagram" ? ["- body: [部署ごとに表の形が違うため、本部が手で貼り合わせている]"] : []),
    kind === "kpi" ? "- diagram: {kind: kpi, items: [{label: a, value: '1'}]}" : "- diagram: {kind: steps, items: [{title: a}, {title: b}, {title: c}]}",
  ];
  const check = async (...s) => {
    const dir = tempDeck();
    fs.writeFileSync(path.join(dir, "outline.md"), outline(...s));
    return (await checkOutline(path.join(dir, "outline.md"))).warnings;
  };
  const has = (w, t) => w.some((x) => x.includes(t));
  const w1 = await check(fig("S01", "title-diagram", "kpi"), fig("S02", "title-diagram", "kpi"), fig("S03", "title-diagram", "kpi"));
  assert.ok(has(w1, "S01〜S03 の3枚が、同じスライドの型（title-diagram）"));
  assert.ok(has(w1, "S01〜S03 の3枚が、同じ図の型（kpi）"));
  const mixed = [
    fig("S01", "title-diagram", "kpi"),
    fig("S02", "text-diagram", "steps"),
    fig("S03", "title-diagram", "kpi"),
    fig("S04", "text-diagram", "steps"),
    fig("S05", "title-diagram", "kpi"),
  ];
  const w2 = await check(...mixed);
  assert.ok(!has(w2, "枚が、同じ"));
  assert.ok(has(w2, "図の型 kpi が、図のあるスライド5枚のうち3枚（60%）"));
});
