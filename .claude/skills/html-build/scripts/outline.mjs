import fs from "fs";
import YAML from "yaml";
import { frontMatter } from "../../../lib/common.mjs";

// outline.md を読む。書き方は slide-outline/outline-template.md。
// - 先頭の --- で囲んだ部分はデッキ全体の設定（YAML）。
// - 「## S01」の見出しごとに1枚。見出しの下は「- 項目: 値」の YAML の箇条書き。
// 戻り値：{ meta, slides: [{ id, line, fields }] }。YAML として読めないときは位置つきでエラーにする。

export function parseOutline(text, file = "outline.md") {
  const m = frontMatter(text);
  if (!m) throw new Error(`${file}: 先頭に --- で囲んだ設定（deck_id など）がない`);
  const meta = load(m[1], `${file}（先頭の設定）`) ?? {};
  const body = text.slice(m[0].length);
  const offset = m[0].split("\n").length - 1; // 本文の1行目が outline.md の何行目か
  const lines = body.split("\n");
  const slides = [];
  let cur = null;
  lines.forEach((l, i) => {
    const h = l.match(/^##\s+(\S+)\s*$/);
    if (h) {
      cur = { id: h[1], line: offset + i + 1, src: [] };
      slides.push(cur);
    } else if (cur) cur.src.push(l);
    else if (l.trim() && !l.startsWith("#")) throw new Error(`${file}:${offset + i + 1}: スライドの見出し（## S01 など）より前に本文がある`);
  });
  for (const s of slides) {
    const v = load(s.src.join("\n"), `${file}:${s.line}（${s.id}）`);
    // 「- 項目: 値」の並びは、1項目ずつの対応表の配列として読めるので、1つにまとめる
    const list = v == null ? [] : Array.isArray(v) ? v : [v];
    s.fields = {};
    s.dup = [];
    for (const item of list) {
      if (item === null || typeof item !== "object" || Array.isArray(item))
        throw new Error(`${file}:${s.line}（${s.id}）: 「- 項目: 値」の形になっていない行がある`);
      for (const [k, val] of Object.entries(item)) {
        if (k in s.fields) s.dup.push(k);
        s.fields[k] = val;
      }
    }
    delete s.src;
  }
  return { meta, slides };
}

// 全角を1、半角を0.5として数える（layout-catalog の「文字数の数え方」）
export const width = (s) => [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) < 0x80 || (c >= "\uff61" && c <= "\uff9f") ? 0.5 : 1), 0);
export const plain = (s) => String(s).replace(/\*\*(.+?)\*\*/g, "$1");

// 説明文（lead）の幅：640 を基本に、3行を超える長さなら3行に収まるまで広げる（最大 1172）。
// 16px の文字を全角1字＝16px とみなし、禁則や句読点のずれの分として1行に2字の余裕をみる。
export const LEAD = { base: 640, max: 1172, lines: 3, px: 16 };
export const leadWidth = (text) => {
  const need = Math.ceil(width(plain(text)) / LEAD.lines + 2) * LEAD.px;
  return Math.min(LEAD.max, Math.max(LEAD.base, need));
};
// 幅いっぱいでも3行に収まらない長さ（全角）
export const LEAD_LIMIT = Math.floor(LEAD.max / LEAD.px - 2) * LEAD.lines;

export const readOutline = (file) => parseOutline(fs.readFileSync(file, "utf8"), file);

function load(src, where) {
  try {
    return YAML.parse(src);
  } catch (e) {
    throw new Error(`${where}: YAML として読めない（${e.message.split("\n")[0]}）`);
  }
}
