#!/usr/bin/env node
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { readOutline } from "./outline.mjs";
import { checkOutline } from "./check-outline.mjs";
import { renderDeck, renderCredits } from "../layouts.mjs";
import { katexCss } from "../components/math.mjs";
import { inspect } from "./inspect.mjs";
import crypto from "crypto";
import { createRequire } from "module";
import { scanDeck } from "../../license-notice/scripts/scan.mjs";
import { verify } from "../../license-notice/scripts/verify.mjs";
import { credits, licensesHtml } from "../../license-notice/scripts/credits.mjs";

// ビルド：decks/<deck-id>/outline.md から、1ファイルの deck.html を作る（要求文書 11章）。
// 使い方：node build.mjs decks/<deck-id>
// 1. 書式チェック（check-outline.mjs）。エラーがあれば止める
// 2. スライドを組み立てる（layouts.mjs と components/）
// 3. Tailwind の CLI で、使っているクラスだけの CSS を作る（theme.css のトークンを含む）
// 4. Noto Sans JP を使っている文字だけにサブセット化して埋め込む（font-subset.py）
// 5. 数式があれば KaTeX の CSS とフォントを埋め込む
// 6. 組み立てたものを走査し、registry.yaml・policy.md と照合する（license-notice）。不合格なら止める
// 7. 合格した素材の credits スライドとライセンスの全文を入れて組み立て直し、deck.html と assets-manifest.yaml を書き出す。外部から何も読み込まない（D8）
// 8. ブラウザで開いて機械的に検査し（inspect.mjs）、結果を build-log.md に書く。問題があれば失敗として返す

const HB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const YAML = createRequire(import.meta.url)("yaml");

export async function build(deckDir) {
  const outlineFile = path.join(deckDir, "outline.md");
  const chk = await checkOutline(outlineFile);
  const outline = readOutline(outlineFile);
  if (chk.errors.length) {
    const r = { ok: false, check: chk, custom: customs(outline) };
    fs.writeFileSync(path.join(deckDir, "build-log.md"), buildLog(outline, r));
    return r;
  }

  const slides = (await renderDeck(outline)).join("\n");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "html-build-"));
  try {
    // 1回目：スライドだけで組み立て、使った素材を走査して照合する（license-notice）。不合格なら deck.html を書かずに止める
    const first = assemble(work, outline, slides, "");
    const scan1 = scanDeck(first.html);
    const lic = verify(scan1);
    const cr = credits(scan1.assets.map((a) => a.id), lic.registry);
    lic.errors.push(...cr.errors);
    if (lic.errors.length) {
      const r = { ok: false, check: chk, custom: customs(outline), license: { ...lic, assets: scan1.assets, rows: [] } };
      fs.writeFileSync(path.join(deckDir, "build-log.md"), buildLog(outline, r));
      return r;
    }
    // 2回目：最後に credits スライドを足し、ライセンスの全文を入れて組み立て直す（スライドの文字と Tailwind のクラスが増えるため）
    const all = slides + "\n" + renderCredits(cr.rows);
    const { html, math, fontLog } = assemble(work, outline, all, licensesHtml(cr.texts));
    const out = path.join(deckDir, "deck.html");
    fs.writeFileSync(out, html);

    // 書き出した deck.html をもう一度走査して、素材の一覧（assets-manifest.yaml）を作る
    const scan = scanDeck(html);
    const reg = lic.registry;
    const manifest = [
      "# assets-manifest.yaml：deck.html を走査スクリプト（license-notice/scripts/scan.mjs）が調べて作った、使った素材の一覧。手で直さない",
      YAML.stringify({
        deck_id: outline.meta.deck_id,
        deck_sha256: crypto.createHash("sha256").update(html).digest("hex"),
        distributed: scan.assets.map((a) => ({ id: a.id, version: reg.get(a.id)?.version, license: reg.get(a.id)?.license, found: a.found })),
        build_only: [...reg.values()].filter((e) => e.scope === "build-only").map((e) => ({ id: e.id, version: e.version, license: e.license })),
        svg_without_id: scan.untaggedSvg,
      }),
    ].join("\n");
    fs.writeFileSync(path.join(deckDir, "assets-manifest.yaml"), manifest);

    const count = outline.slides.length + 1; // credits を含む
    const insp = await inspect(out, count);
    const r = { check: chk, out, slides: count, bytes: Buffer.byteLength(html), math, fontLog, inspect: insp, custom: customs(outline), license: { ...lic, assets: scan.assets, rows: cr.rows } };
    r.ok = CATEGORIES.every(([k]) => !insp[k].length);
    fs.writeFileSync(path.join(deckDir, "build-log.md"), buildLog(outline, r));
    return r;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// スライドの HTML から deck.html の中身を組み立てる（Tailwind・KaTeX・フォント・base.html）
function assemble(work, outline, slides, licenses) {
  // Tailwind：スライドの HTML からクラス名を読み取る。import は絶対パスで書き、作業フォルダの場所に左右されないようにする
  fs.writeFileSync(path.join(work, "slides.html"), slides);
  fs.writeFileSync(path.join(work, "in.css"), [
    `@import "${path.join(HB, "node_modules/tailwindcss/index.css")}";`,
    `@import "${path.join(HB, "theme.css")}";`,
    `@source "${path.join(work, "slides.html")}";`,
    `@source "${path.join(HB, "base.html")}";`,
  ].join("\n"));
  execFileSync(process.execPath, [path.join(HB, "node_modules/@tailwindcss/cli/dist/index.mjs"), "-i", path.join(work, "in.css"), "-o", path.join(work, "out.css"), "--minify"], { stdio: "pipe" });
  let css = fs.readFileSync(path.join(work, "out.css"), "utf8");
  const math = slides.includes('data-kind="math"');
  if (math) css += "\n" + katexCss();

  // フォント：base.html の文字（ページ番号など）も含める。ライセンスの全文は画面に出さないので含めない
  fs.writeFileSync(path.join(work, "text.html"), slides + fs.readFileSync(path.join(HB, "base.html"), "utf8"));
  const fontLog = execFileSync("python3", [path.join(HB, "scripts/font-subset.py"), path.join(work, "text.html"), path.join(work, "font.css")], { encoding: "utf8" }).trim();
  const font = fs.readFileSync(path.join(work, "font.css"), "utf8");

  // base.html の印を置き換える。置き換える値に $ が含まれても崩れないよう、関数で渡す
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = fs.readFileSync(path.join(HB, "base.html"), "utf8")
    .replace("{{title}}", () => esc(outline.meta.title))
    .replace("/*FONT*/", () => font)
    .replace("/*TAILWIND*/", () => css)
    .replace("<!--SLIDES-->", () => slides)
    .replace("<!--LICENSES-->", () => licenses);
  return { html, math, fontLog };
}

// 検査の種類。どれか1件でもあれば失敗（人が直すか、理由を確かめる）
const CATEGORIES = [
  ["overflow", "はみ出し（スライドの外・本文の枠の外）"],
  ["margin", "余白不足（左右 54・上下 27）"],
  ["overlap", "文字の重なり"],
  ["text", "文字が小さすぎる（11px 未満）"],
  ["color", "トークン外の色"],
  ["lead", "説明文が3行を超えた"],
  ["network", "外部への通信"],
  ["script", "スクリプトのエラー"],
  ["count", "枚数が outline.md と合わない"],
];

// 独自の表現（html:）を使ったスライド。人の確認が要る（components.md 4.1）
function customs(outline) {
  return outline.slides.filter((s) => s.fields.html).map((s) => s.id);
}

function buildLog(outline, r) {
  const list = (a) => (a.length ? a.map((x) => `- ${x}`).join("\n") : "なし");
  const L = [
    `# ビルドの記録：${outline.meta.deck_id}`,
    "",
    `- 日時：${new Date().toISOString()}`,
    `- 結果：${r.ok ? "合格" : r.inspect ? "不合格（下の検査を確認）" : r.license ? "ライセンスの照合で不合格のため止めた（deck.html は作っていない）" : "書式チェックのエラーで止めた（deck.html は作っていない）"}`,
    ...(r.inspect ? [`- 出力：deck.html（${r.slides}枚、${Math.round(r.bytes / 1024)} KB。フォント：${r.fontLog}${r.math ? "。KaTeX を埋め込んだ" : ""}）`] : []),
    "",
    "## 書式チェック（check-outline.mjs）",
    "",
    "### エラー",
    "",
    list(r.check.errors),
    "",
    "### 注意（人が確認する）",
    "",
    list(r.check.warnings),
    "",
    "## 機械的な検査（inspect.mjs）",
    "",
    ...(r.inspect ? [
      "| 検査 | 件数 |",
      "|---|---|",
      ...CATEGORIES.map(([k, label]) => `| ${label} | ${r.inspect[k].length} |`),
      "",
      ...CATEGORIES.filter(([k]) => r.inspect[k].length).flatMap(([k, label]) => [`### ${label}`, "", list(r.inspect[k]), ""]),
    ] : ["前の段階で止めたので、行っていない", ""]),
    "## ライセンス（license-notice）",
    "",
    ...(r.license ? [
      "### 照合のエラー",
      "",
      list(r.license.errors),
      "",
      "### 注意（人が確認する）",
      "",
      list(r.license.warnings),
      "",
      "### 配布物に入った素材（assets-manifest.yaml）",
      "",
      list(r.license.assets.map((a) => `${a.id}：${a.found.join("、")}`)),
      "",
      "### credits スライドに載せたもの",
      "",
      list(r.license.rows.map((x) => `${x.name}（${x.license}）`)),
      "",
    ] : ["書式チェックのエラーがあるので、行っていない", ""]),
    "## 独自の表現（html:）",
    "",
    r.custom.length ? `次のスライドは部品を使わず HTML で書いている。人が見た目と内容を確認する：${r.custom.join("、")}` : "なし",
    "",
  ];
  return L.join("\n");
}

// コマンドとして呼ばれたとき
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error("使い方：node build.mjs decks/<deck-id>"); process.exit(2); }
  const r = await build(dir);
  for (const e of r.check.errors) console.log(`エラー  ${e}`);
  for (const w of r.check.warnings) console.log(`注意    ${w}`);
  for (const e of r.license?.errors ?? []) console.log(`ライセンス  ${e}`);
  for (const w of r.license?.warnings ?? []) console.log(`注意    ${w}`);
  if (!r.inspect) { console.log(r.license ? "ライセンスの照合で不合格のため、ビルドを止めた" : "書式チェックのエラーがあるので、ビルドを止めた"); process.exit(1); }
  console.log(`${r.out}：${r.slides}枚、${Math.round(r.bytes / 1024)} KB（フォント：${r.fontLog}${r.math ? "。KaTeX を埋め込んだ" : ""}）`);
  for (const [k, label] of CATEGORIES) for (const x of r.inspect[k]) console.log(`検査    ${label}：${x}`);
  console.log(r.ok ? "検査：合格（build-log.md に記録した）" : "検査：不合格（build-log.md を確認）");
  if (!r.ok) process.exit(1);
}
