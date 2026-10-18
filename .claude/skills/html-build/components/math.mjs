import fs from "fs";
import path from "path";
import { createRequire } from "module";
import katex from "katex";
import { esc, check, R, O } from "./_util.mjs";

// math：数式。TeX の記法で書いた式を、ビルド時に KaTeX で HTML に変える。表示するときに何も読み込まない。
// data: { tex, size?: "large" | "body", caption? }
// - KaTeX の HTML 出力を使い、CSS とフォントを deck.html に埋め込む（どの環境でも同じ見た目。MathML 出力は環境によって組版が崩れるため使わない）
// - size: large（既定。式だけを大きく見せる）／body（本文と同じ大きさ）
// - 数式のあるデッキは、katexCss() の CSS を deck.html に入れる。
// ライセンス：KaTeX のコードは MIT、フォントは OFL-1.1。registry.yaml に登録済み（id: katex）。数式のあるデッキはクレジットに両方を載せる。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { tex: R, size: O, caption: O };

export default function math(data) {
  check("math", data, schema);
  // html のときも MathML を併せて出す（読み上げソフトのため。見た目は KaTeX の CSS で隠れる）
  const html = katex
    .renderToString(data.tex, { displayMode: true, output: "htmlAndMathml", throwOnError: true })
    .replace(/<svg /g, '<svg data-origin="generated" '); // KaTeX が作る SVG（根号など）にも、部品が作ったことを示す印を付ける
  const size = data.size === "body" ? "text-body" : "flex h-full flex-col justify-center text-title"; // large は枠の縦の中央に置く
  const cap = data.caption ? `<div class="mt-[12px] text-center text-caption text-label">${esc(data.caption)}</div>` : "";
  return `<div class="${size} text-ink" data-kind="math">${html}${cap}</div>`;
}

/** KaTeX の CSS。フォント（woff2 だけ）を data: URL にして埋め込む */
export function katexCss() {
  const dir = path.dirname(createRequire(import.meta.url).resolve("katex/dist/katex.min.css"));
  let css = fs.readFileSync(path.join(dir, "katex.min.css"), "utf8");
  css = css.replace(
    /src:url\(fonts\/([^)]+?\.woff2)\) format\("woff2"\)(,url\([^)]+\) format\("[^"]+"\))*/g,
    (_, f) => `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, "fonts", f)).toString("base64")}) format("woff2")`,
  );
  return css;
}
