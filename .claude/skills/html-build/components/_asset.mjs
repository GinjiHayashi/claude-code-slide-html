import fs from "fs";
import path from "path";
import { createRequire } from "module";

// デッキの素材（画像・アイコン）を読む。素材は人間が decks/<deck-id>/inputs/ に置き、outline.md の先頭の assets に
// 出どころとライセンスを書いたものだけを使う（license-notice/policy.md 5章）。部品は素材を data: URL か SVG にして埋め込み、
// data-deck-asset="<src>" を付ける（license-notice の走査が見つけ、credits スライドに載せる）。

// アイコン集のアイコン（「phosphor:<名前>」）。registry.yaml に登録したアイコン集（id: phosphor）の塗りのアイコンを使う。
// AI は scripts/icons.mjs でタグから探し、outline.md に名前を書く。素材は人間が用意しなくてよく、assets にも書かない。
// 埋め込むときは data-asset-id="phosphor:<名前>" を付ける（license-notice の走査が registry の id として見つける）。
const ICON_REF = /^phosphor:([a-z0-9]+(?:-[a-z0-9]+)*)$/;
export const isIconRef = (src) => typeof src === "string" && src.startsWith("phosphor:");
const PHOSPHOR = () => path.join(path.dirname(createRequire(import.meta.url).resolve("@phosphor-icons/core")), "..", "assets", "fill"); // dist/ の隣

/** アイコン集のアイコンを読む */
export function readIcon(kind, ref) {
  const name = String(ref).match(ICON_REF)?.[1];
  if (!name) throw new Error(`${kind}: アイコン「${ref}」の書き方が違う（phosphor:<名前>。名前は scripts/icons.mjs で探す）`);
  const file = path.join(PHOSPHOR(), `${name}-fill.svg`);
  if (!fs.existsSync(file)) throw new Error(`${kind}: アイコン「${ref}」がない（scripts/icons.mjs で名前を探す）`);
  const buf = fs.readFileSync(file);
  return { type: "image/svg+xml", buf, ...size("image/svg+xml", buf, ref, kind), assetId: `phosphor:${name}` };
}

/** デッキの素材かアイコン集のアイコンを読む */
export const loadAsset = (kind, src, deck) => (isIconRef(src) ? readIcon(kind, src) : readAsset(kind, src, deck));

export const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

/** outline.md の assets にある素材を読む。deck：{ dir, assets }（layouts.mjs と check-outline.mjs が渡す） */
export function readAsset(kind, src, deck) {
  if (!deck) throw new Error(`${kind}: デッキのフォルダがわからない（ビルドか書式チェックから呼ぶ）`);
  const a = (deck.assets ?? []).find((x) => x?.src === src);
  if (!a) throw new Error(`${kind}: ${src} が outline.md の先頭の assets にない（出どころとライセンスを書く）`);
  const file = path.join(deck.dir, src);
  if (!fs.existsSync(file)) throw new Error(`${kind}: ${src} のファイルがない`);
  const type = TYPES[path.extname(src).toLowerCase()];
  if (!type) throw new Error(`${kind}: ${src} は使えない形式（${Object.keys(TYPES).join("・")}）`);
  const buf = fs.readFileSync(file);
  return { type, buf, ...size(type, buf, src, kind) };
}

// 画像の縦横の大きさ（px）。PNG は IHDR、JPEG は SOF、SVG は viewBox（なければ width・height）から読む
function size(type, buf, src, kind) {
  if (type === "image/png") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (type === "image/jpeg") {
    for (let i = 2; i < buf.length - 9; ) {
      if (buf[i] !== 0xff) break;
      const m = buf[i + 1],
        len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  if (type === "image/svg+xml") {
    const tag = String(buf).match(/<svg\b[^>]*>/i)?.[0] ?? "";
    const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (vb) return { w: +vb[1], h: +vb[2] };
    const wh = [/\swidth\s*=\s*["']([\d.]+)/i, /\sheight\s*=\s*["']([\d.]+)/i].map((re) => +(tag.match(re)?.[1] ?? 0));
    if (wh[0] && wh[1]) return { w: wh[0], h: wh[1] };
  }
  throw new Error(`${kind}: ${src} の縦横の大きさを読めない`);
}

/** data: URL */
export const dataUrl = (a) => `data:${a.type};base64,${a.buf.toString("base64")}`;

/**
 * 1色のアイコン（SVG）を、色を差し替えられる形にして埋め込む。
 * - 塗りと線の色（fill・stroke。none 以外）を currentColor にし、外側の要素の文字色（theme.css のトークン）で描く
 * - スクリプト・外部の参照・foreignObject は外す。width・height は size（px）にそろえる
 */
export function inlineSvg(a, src, size) {
  let s = String(a.buf)
    .replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/gi, "")
    .replace(/<(script|foreignObject|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\s(on\w+|xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s(fill|stroke)\s*=\s*("(?!none")[^"]*"|'(?!none')[^']*')/gi, ' $1="currentColor"')
    .replace(/(fill|stroke)\s*:\s*(?!none)[^;"']+/gi, "$1:currentColor")
    .trim();
  const open = s.match(/<svg\b[^>]*>/i);
  if (!open) throw new Error(`icon: ${src} は SVG ではない`);
  const attrs = open[0]
    .replace(/\s(width|height|class|style|data-[\w-]+)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(
      /^<svg/i,
      `<svg width="${size}" height="${size}" aria-hidden="true" ${a.assetId ? "data-asset-id" : "data-deck-asset"}="${(a.assetId ?? src).replace(/"/g, "&quot;")}"`,
    );
  return s.replace(open[0], attrs);
}
