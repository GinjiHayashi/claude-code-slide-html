import fs from "fs";
import YAML from "yaml";

// outline.md を読む。書き方は slide-outline/outline-template.md。
// - 先頭の --- で囲んだ部分はデッキ全体の設定（YAML）。
// - 「## S01」の見出しごとに1枚。見出しの下は「- 項目: 値」の YAML の箇条書き。
// 戻り値：{ meta, slides: [{ id, line, fields }] }。YAML として読めないときは位置つきでエラーにする。

export function parseOutline(text, file = "outline.md") {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
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
      if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error(`${file}:${s.line}（${s.id}）: 「- 項目: 値」の形になっていない行がある`);
      for (const [k, val] of Object.entries(item)) {
        if (k in s.fields) s.dup.push(k);
        s.fields[k] = val;
      }
    }
    delete s.src;
  }
  return { meta, slides };
}

export const readOutline = (file) => parseOutline(fs.readFileSync(file, "utf8"), file);

function load(src, where) {
  try {
    return YAML.parse(src);
  } catch (e) {
    throw new Error(`${where}: YAML として読めない（${e.message.split("\n")[0]}）`);
  }
}
