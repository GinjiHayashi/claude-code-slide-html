import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { isMain } from "../../../lib/common.mjs";
import { SLIDE } from "./spec.mjs";

// スライドを画像にする：build/deck.html を開き、指定したスライドを1枚ずつ PNG（1280×720）に撮る。
// - はみ出し・重なり・端のそろい・余白の偏りを、AI が画像で確かめるための道具（CLAUDE.md の原則6）。見た目の良し悪しは判断しない
// - 印刷のときと同じ見た目で撮る（pdf.mjs と同じ。PDF を画像にする pdftoppm は要らない）
// - 書き出す先は decks/<deck-id>/build/shots/<スライドの番号>.png。git の管理外（.gitignore）
// ids：撮るスライドの番号（["S13", "S33"]）。空なら全部を撮り、前回の画像を消してから書く
export async function shots(deckDir, ids = []) {
  const html = path.join(deckDir, "build", "deck.html");
  if (!fs.existsSync(html)) throw new Error(`${html} がない。先にビルドする（npm run build -- ${deckDir}）`);
  const outDir = path.join(deckDir, "build", "shots");
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: SLIDE.width, height: SLIDE.height } });
    await page.route("**/*", (r) => (/^(file|data):/.test(r.request().url()) ? r.continue() : r.abort())); // 外部へは通信しない
    await page.goto("file://" + path.resolve(html));
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    const all = await page.$$eval("section.slide", (els) => els.map((e) => e.dataset.id));
    const missing = ids.filter((id) => !all.includes(id));
    if (missing.length) throw new Error(`deck.html にないスライド：${missing.join("、")}（あるのは ${all.join("、")}）`);
    if (!ids.length) fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const files = [];
    for (const id of ids.length ? ids : all) {
      const file = path.join(outDir, `${id}.png`);
      await page.locator(`section.slide[data-id="${id}"]`).screenshot({ path: file });
      files.push(file);
    }
    return files;
  } finally {
    await browser.close();
  }
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const [dir, ...ids] = process.argv.slice(2);
  if (!dir) {
    console.error("使い方：npm run shots -- decks/<deck-id> [S13 S33 …]（番号を省くと全部）");
    process.exit(2);
  }
  try {
    for (const f of await shots(dir, ids)) console.log(f);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
