import path from "path";
import { chromium } from "playwright";
import { SLIDE } from "./spec.mjs";

// PDF：deck.html を Chromium の印刷で PDF にする（1枚＝1ページ、1280×720）。outline.md の pdf: true のときだけ。
// - 改ページと余白は base.html の印刷用の CSS（@page と break-after）に従う
// - ライセンス：PDF にはライセンスの全文（#licenses）は入らない。最後の credits スライドに著作権者とライセンス名が載る。
//   フォントを文書に埋め込む場合は OFL の全文を添えなくてよい（OFL FAQ 1.10・1.12）。KaTeX の CSS は PDF に入らない
export async function toPdf(deckHtml, out) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage();
    await page.route("**/*", (r) => (/^(file|data):/.test(r.request().url()) ? r.continue() : r.abort())); // 外部へは通信しない
    await page.goto("file://" + path.resolve(deckHtml));
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: out, width: `${SLIDE.width}px`, height: `${SLIDE.height}px`, printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
