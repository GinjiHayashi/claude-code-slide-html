import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHighlighter } from "shiki";
import { esc, check, R, O } from "./_util.mjs";

// code：プログラムのコード（コードブロック）。ビルド時に shiki で色を付け、HTML にする。表示するときに何も読み込まない。
// data: { lang, code, file? }
// - lang：言語の名前（下の LANGS のどれか）。色を付けないなら text
// - code：コードそのもの。outline.md では「code: |」に続けて、字下げしてそのまま書く
// - file：コードの上に出すファイル名など（任意）
// - 色は GitHub Light Default（shiki の github-light-default テーマ）。テーマの色を theme.css の --color-code-* に置き換えて出すので、
//   トークンにない色が出たら止まる。太字・斜体（テーマの fontStyle）は使わない
// - 字は Roboto Mono（theme.css の font-mono・text-code）。長い行は折り返さない。枠からはみ出したら、ビルド後の検査で止まる
// - 文中のコード（`…`）や独自の表現の <code> も同じ字と背景になる（base.html。components.md 4.3）
// ライセンス：shiki は MIT（ビルド時だけ使う）、Roboto Mono は OFL-1.1。registry.yaml に登録済み（id: shiki・roboto-mono）。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { lang: R, code: R, file: O };

// 色を付けられる言語（読み込みに時間がかかるので、よく使うものだけ）
export const LANGS = [
  "text",
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "dockerfile",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "markdown",
  "php",
  "python",
  "ruby",
  "rust",
  "sql",
  "swift",
  "toml",
  "typescript",
  "yaml",
];
const THEME = "github-light-default";
const hl = await createHighlighter({ themes: [THEME], langs: LANGS.filter((l) => l !== "text") });

// テーマの色 → theme.css のトークン（値が同じもの）。Tailwind が拾えるよう、クラス名は完全な形で書く
const CLASS = {
  "code-text": "text-code-text",
  "code-comment": "text-code-comment",
  "code-keyword": "text-code-keyword",
  "code-constant": "text-code-constant",
  "code-variable": "text-code-variable",
  "code-function": "text-code-function",
  "code-tag": "text-code-tag",
  "code-string": "text-code-string",
  "code-invalid": "text-code-invalid",
};
const theme = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "theme.css"), "utf8");
const TOKEN = new Map([...theme.matchAll(/--color-(code-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[2].toLowerCase(), CLASS[m[1]]]).filter(([, c]) => c));

export default function code(data) {
  check("code", data, schema);
  if (!LANGS.includes(data.lang)) throw new Error(`code: lang に ${data.lang} は使えない（使えるもの：${LANGS.join("・")}）`);
  const src = String(data.code).replace(/\n+$/, ""); // 「code: |」の最後の改行は出さない
  const lines =
    data.lang === "text"
      ? src.split("\n").map((l) => [{ content: l }])
      : hl.codeToTokens(src, { lang: data.lang, theme: THEME }).tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color })));
  const span = (t) => {
    const c = t.color?.toLowerCase();
    if (!c || !TOKEN.has(c) || TOKEN.get(c) === "text-code-text") return esc(t.content);
    return `<span class="${TOKEN.get(c)}">${esc(t.content)}</span>`;
  };
  for (const l of lines)
    for (const t of l)
      if (t.color && !TOKEN.has(t.color.toLowerCase()))
        throw new Error(`code: テーマの色 ${t.color} に当たるトークンが theme.css にない（「${t.content.trim()}」）`);
  const file = data.file ? `<div class="border-b border-line px-[20px] py-[8px] font-mono text-caption text-label">${esc(data.file)}</div>` : "";
  return `<figure class="m-0 rounded-panel bg-code-bg" data-kind="code">${file}<pre class="m-0 px-[20px] py-[16px] font-mono text-code text-code-text"><code>${lines
    .map((l) => l.map(span).join(""))
    .join("\n")}</code></pre></figure>`;
}
