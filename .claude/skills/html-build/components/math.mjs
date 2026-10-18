import fs from "fs";
import path from "path";
import { createRequire } from "module";
import katex from "katex";
import { esc, need } from "./_util.mjs";

// math：数式。TeX の記法で書いた式を、ビルド時に KaTeX で HTML に変える。表示するときに何も読み込まない。
// data: { tex, output?: "html" | "mathml", size?: "large" | "body", caption? }
// - output: html（既定。KaTeX の CSS とフォントを deck.html に埋め込む。どの環境でも同じ見た目）
//           mathml（ブラウザが自分で描く。KaTeX はビルド時だけ使う。見た目は環境のフォントで変わる）
// - size: large（既定。式だけを大きく見せる）／body（本文と同じ大きさ）
// - html を使うデッキは、katexCss() の CSS を deck.html に入れる。
// ライセンス：KaTeX のコードは MIT、フォントは OFL-1.1。registry.yaml に登録済み（id: katex）。数式のあるデッキはクレジットに両方を載せる。

export default function math(data) {
  need("math", data, ["tex"]);
  const output = data.output ?? "html";
  // html のときも MathML を併せて出す（読み上げソフトのため。見た目は KaTeX の CSS で隠れる）
  const html = katex.renderToString(data.tex, { displayMode: true, output: output === "mathml" ? "mathml" : "htmlAndMathml", throwOnError: true }).replace(/<svg /g, '<svg data-origin="generated" '); // KaTeX が作る SVG（根号など）にも、部品が作ったことを示す印を付ける
  const size = data.size === "body" ? "text-body" : "flex h-full flex-col justify-center text-title"; // large は枠の縦の中央に置く
  const cap = data.caption ? `<div class="mt-[12px] text-center text-caption text-label">${esc(data.caption)}</div>` : "";
  return `<div class="${size} text-ink" data-kind="math" data-output="${output}">${html}${cap}</div>`;
}

/** KaTeX の CSS。フォント（woff2 だけ）を data: URL にして埋め込む */
export function katexCss() {
  const dir = path.dirname(createRequire(import.meta.url).resolve("katex/dist/katex.min.css"));
  let css = fs.readFileSync(path.join(dir, "katex.min.css"), "utf8");
  css = css.replace(/src:url\(fonts\/([^)]+?\.woff2)\) format\("woff2"\)(,url\([^)]+\) format\("[^"]+"\))*/g, (_, f) =>
    `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, "fonts", f)).toString("base64")}) format("woff2")`);
  return css;
}
