import { esc, check, R } from "./_util.mjs";
import { loadAsset, inlineSvg } from "./_asset.mjs";

// dirtree：ディレクトリツリー（フォルダとファイルの階層）。階層の深さ・数は自由（行は MAX_ROWS まで）。
// data: { tree: 字下げで書いた階層（複数行の文字） }
//   - 1行に1つ。字下げ（半角スペース）で階層を表す。深さは前の行より1段だけ深くできる（段の幅は行ごとに違ってもよい）
//   - 名前の最後が「/」ならフォルダ（紺のアイコンと紺の文字）、ほかはファイル（灰色のアイコンと黒の文字）。「...」だけの行は省略を表す（アイコンなし）
//   - 「名前  # 説明」で、右の列に短い説明を書く
//   - 行の頭に「* 」を付けると、その行を強調する（太字の青。背景は塗らない）
//   書き方の例（outline.md）：
//     tree: |
//       project/
//         src/
//           * main.py  # 入口
//           utils.py
//         README.md
// opt: { width, height, deck }（置く枠の大きさ。既定は 1172×440）
// - 線は、親のアイコンの下から子の行へ、縦と横の線でつなぐ（灰色の細い線）。アイコンは 24px（文字の横の大きさ）。
// - 字は Roboto Mono（font-mono）。全体を枠の左右の中央に置く。

export const schema = { tree: R };

// 色：フォルダはアイコンと名前を紺、ファイルは灰色のアイコンと黒の名前。強調は太字の青
const DIR = "text-lightblue-1200",
  FILE_ICON = "text-gray-400",
  HI = "font-bold text-primary";

const MAX_ROWS = 16,
  ROW_MIN = 26,
  ROW_MAX = 40,
  STEP = 32, // 1段の字下げ（px）
  ICON = 24,
  GAP = 8; // アイコンと名前のすき間
const f1 = (v) => v.toFixed(1);
// 文字の幅の見積もり（px）。英数字は Roboto Mono の 0.6em、ほかは 1em（16px の字）
const textWidth = (s, size = 16) => [...s].reduce((w, c) => w + (c.charCodeAt(0) < 0x2e80 ? 0.6 : 1) * size, 0);

export default function dirtree(data, opt = {}) {
  check("dirtree", data, schema);
  if (typeof data.tree !== "string") throw new Error("dirtree: tree は字下げで書いた複数行の文字にする（tree: | のあとに書く）");
  const W = opt.width ?? 1172,
    H = opt.height ?? 440;
  const icon = (ref) => inlineSvg(loadAsset("dirtree", ref, opt.deck), ref, ICON);

  // 行を読む：字下げの深さ・名前・説明・強調
  const lines = data.tree.split("\n").filter((l) => l.trim());
  if (!lines.length) throw new Error("dirtree: tree が空");
  if (lines.length > MAX_ROWS) throw new Error(`dirtree: 行は${MAX_ROWS}まで（今は${lines.length}行。「...」で省略する）`);
  const stack = []; // 祖先の字下げの幅
  const rows = lines.map((l, i) => {
    if (/\t/.test(l)) throw new Error(`dirtree: ${i + 1}行目にタブがある。字下げは半角スペースで書く`);
    const ind = l.match(/^ */)[0].length;
    while (stack.length && stack.at(-1) >= ind) stack.pop();
    if (i === 0 && ind) throw new Error("dirtree: 1行目は字下げしない（いちばん上の階層）");
    const depth = stack.length;
    stack.push(ind);
    let body = l.trim();
    const hi = body.startsWith("* ");
    if (hi) body = body.slice(2).trim();
    const [name, ...note] = body.split(/\s+#\s*/);
    if (!name) throw new Error(`dirtree: ${i + 1}行目に名前がない`);
    return { depth, name: name.trim(), note: note.join(" # ").trim(), hi, dir: name.trim().endsWith("/"), more: name.trim() === "..." };
  });
  rows.forEach((r, i) => {
    if (i && r.depth > rows[i - 1].depth + 1) throw new Error(`dirtree: ${i + 1}行目の字下げが深すぎる（前の行より1段だけ深くできる）`);
    if (i && r.depth > rows[i - 1].depth && !rows[i - 1].dir)
      throw new Error(`dirtree: ${i}行目「${rows[i - 1].name}」はファイルなので、その下に行を書けない（フォルダは名前の最後に「/」を付ける）`);
  });

  const rh = Math.min(ROW_MAX, H / rows.length);
  if (rh < ROW_MIN) throw new Error(`dirtree: 行が多く、枠の高さに収まらない（${Math.floor(H / ROW_MIN)}行まで）`);
  // 名前の右端の最大から、説明の列の位置を決める
  const nameEnd = (r) => r.depth * STEP + ICON + GAP + textWidth(r.name) + 16;
  const noteX = Math.max(...rows.map(nameEnd)) + 24;
  const noteW = Math.max(0, ...rows.map((r) => (r.note ? textWidth(r.note, 14) : 0)));
  const CW = Math.min(W, noteW ? noteX + noteW + 16 : Math.max(...rows.map(nameEnd)));
  const CH = rh * rows.length;

  const svg = [],
    html = [];
  rows.forEach((r, i) => {
    const y = i * rh,
      cy = y + rh / 2,
      x = r.depth * STEP;
    // 親へつなぐ線：親のアイコンの中心の真下から縦に下り、横に曲がって子のアイコンの左へ
    if (r.depth) {
      let p = i - 1;
      while (rows[p].depth >= r.depth) p--;
      const px = (r.depth - 1) * STEP + ICON / 2,
        py = p * rh + rh / 2 + ICON / 2 + 2;
      svg.push(`<path class="fill-none stroke-gray-400" stroke-width="1.5" d="M${f1(px)},${f1(py)}V${f1(cy)}H${f1(x - 4)}"/>`);
    }
    const ic = r.more ? "" : `<span class="flex shrink-0 ${r.dir ? DIR : FILE_ICON}">${icon(r.dir ? "phosphor:folder" : "phosphor:file")}</span>`;
    const name = `<span class="whitespace-nowrap font-mono text-body ${r.hi ? HI : r.dir ? DIR : "text-ink"}">${esc(r.name)}</span>`;
    html.push(`<div class="absolute flex items-center gap-[8px]" style="left:${f1(x)}px;top:${f1(y)}px;height:${f1(rh)}px">${ic}${name}</div>`);
    if (r.note)
      html.push(
        `<div class="absolute flex items-center whitespace-nowrap text-caption text-label" style="left:${f1(noteX)}px;top:${f1(y)}px;height:${f1(rh)}px">${esc(r.note)}</div>`,
      );
  });

  return `<div class="relative mx-auto" style="width:${f1(CW)}px;height:${f1(CH)}px" data-kind="dirtree">
<svg data-origin="generated" class="absolute left-0 top-0 overflow-visible" width="${f1(CW)}" height="${f1(CH)}" viewBox="0 0 ${f1(CW)} ${f1(CH)}" aria-hidden="true">${svg.join("")}</svg>
${html.join("")}
</div>`;
}
