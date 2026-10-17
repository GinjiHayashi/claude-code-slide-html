#!/usr/bin/env node
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { readOutline } from "./outline.mjs";
import { checkOutline } from "./check-outline.mjs";
import { renderDeck } from "../layouts.mjs";
import { katexCss } from "../components/math.mjs";

// ビルド：decks/<deck-id>/outline.md から、1ファイルの deck.html を作る（要求文書 11章）。
// 使い方：node build.mjs decks/<deck-id>
// 1. 書式チェック（check-outline.mjs）。エラーがあれば止める
// 2. スライドを組み立てる（layouts.mjs と components/）
// 3. Tailwind の CLI で、使っているクラスだけの CSS を作る（theme.css のトークンを含む）
// 4. Noto Sans JP を使っている文字だけにサブセット化して埋め込む（font-subset.py）
// 5. 数式があれば KaTeX の CSS とフォントを埋め込む
// 6. base.html の印を置き換えて deck.html を書き出す。外部から何も読み込まない（D8）
// ライセンス表記（credits）は license-notice のスクリプトが後から入れる（構築順序 5-5）。

const HB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function build(deckDir) {
  const outlineFile = path.join(deckDir, "outline.md");
  const chk = await checkOutline(outlineFile);
  if (chk.errors.length) return { ok: false, check: chk };

  const outline = readOutline(outlineFile);
  const slides = (await renderDeck(outline)).join("\n");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "html-build-"));
  try {
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

    // フォント：base.html の文字（ページ番号など）も含める
    fs.writeFileSync(path.join(work, "text.html"), slides + fs.readFileSync(path.join(HB, "base.html"), "utf8"));
    const fontLog = execFileSync("python3", [path.join(HB, "scripts/font-subset.py"), path.join(work, "text.html"), path.join(work, "font.css")], { encoding: "utf8" }).trim();
    const font = fs.readFileSync(path.join(work, "font.css"), "utf8");

    // base.html の印を置き換える。置き換える値に $ が含まれても崩れないよう、関数で渡す
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = fs.readFileSync(path.join(HB, "base.html"), "utf8")
      .replace("{{title}}", () => esc(outline.meta.title))
      .replace("/*FONT*/", () => font)
      .replace("/*TAILWIND*/", () => css)
      .replace("<!--SLIDES-->", () => slides);
    const out = path.join(deckDir, "deck.html");
    fs.writeFileSync(out, html);
    return { ok: true, check: chk, out, slides: outline.slides.length, bytes: Buffer.byteLength(html), math, fontLog };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// コマンドとして呼ばれたとき
if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error("使い方：node build.mjs decks/<deck-id>"); process.exit(2); }
  const r = await build(dir);
  for (const e of r.check.errors) console.log(`エラー  ${e}`);
  for (const w of r.check.warnings) console.log(`注意    ${w}`);
  if (!r.ok) { console.log("書式チェックのエラーがあるので、ビルドを止めた"); process.exit(1); }
  console.log(`${r.out}：${r.slides}枚、${Math.round(r.bytes / 1024)} KB（フォント：${r.fontLog}${r.math ? "。KaTeX を埋め込んだ" : ""}）`);
}
