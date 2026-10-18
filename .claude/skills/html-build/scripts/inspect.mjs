import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { SLIDE, SPACE } from "./spec.mjs";

// 機械的なチェック：deck.html をブラウザ（Playwright の Chromium）で開いて測る。
// 内容を変える自動修正はしない。結果は build.mjs が build-log.md に書く。
// - overflow  はみ出し：スライドの外、本文の枠（data-frame）の外に出た要素。部品・文章・独自の表現を区別しない（components.md 4.1）
// - overlap   重なり：文字どうしが重なっている
// - margin    余白不足：左右 slide-x・上下 slide-bottom（theme.css）の余白に入り込んだ要素（表紙・扉の帯など、data-deco の飾りは除く）
// - color     トークン外の色：theme.css の色（--color-*）以外が使われている
// - text      文字が小さすぎる：11px 未満（フッターの 11px が最小。図の中は 12px 以上）
// - lead      説明文が3行を超えた
// - network   外部への通信：file: と data: 以外の読み込み（すべて止めて記録する）
// - count     スライドの枚数が outline.md と合わない
// - script    ページのスクリプトのエラー
// ブラウザは、環境変数 CHROMIUM_PATH があればそれを、なければ Playwright が入れた Chromium を使う。

const HB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// theme.css の --color-* を rgb(…) の形にして返す
export function tokenColors() {
  const css = fs.readFileSync(path.join(HB, "theme.css"), "utf8");
  const hex = [...css.matchAll(/--color-[\w-]+:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1]);
  return [...new Set(hex)].map((h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`);
}

export async function inspect(deckHtml, expectedSlides) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const ctx = await browser.newContext({ viewport: SLIDE });
    const network = [];
    await ctx.route("**/*", (r) => {
      const u = r.request().url();
      if (u.startsWith("file:") || u.startsWith("data:")) return r.continue();
      network.push(u);
      return r.abort();
    });
    const page = await ctx.newPage();
    const script = [];
    page.on("pageerror", (e) => script.push(e.message));
    await page.goto("file://" + path.resolve(deckHtml));
    await page.evaluate(() => document.fonts.ready);
    const found = await page.evaluate(measure, { tokens: tokenColors(), mx: SPACE.x, my: SPACE.bottom });
    const res = { network, script, ...found };
    res.count = found.slides === expectedSlides ? [] : [`deck.html は ${found.slides}枚、outline.md は ${expectedSlides}枚`];
    return res;
  } finally {
    await browser.close();
  }
}

// ブラウザの中で動く。各スライドを測り、問題を種類ごとの配列で返す
function measure({ tokens, mx, my }) {
  const SVG = "http://www.w3.org/2000/svg";
  const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan"]);
  const ok = new Set([...tokens, "rgba(0, 0, 0, 0)"]);
  const out = { overflow: [], overlap: [], margin: [], color: [], text: [], lead: [] };
  const slides = [...document.querySelectorAll(".slide")];
  const hidden = (e) => e.closest(".notes") || e.closest(".katex-mathml") || (e.closest(".katex") && e.closest("svg"));
  const name = (e) => {
    const t = (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 20);
    return `${e.tagName.toLowerCase()}${t ? `「${t}」` : ""}`;
  };
  slides.forEach((sl) => {
    const id = sl.dataset.id;
    const S = sl.getBoundingClientRect();
    const els = [...sl.querySelectorAll("*")].filter((e) => !hidden(e));
    const box = (e) => {
      const r = e.getBoundingClientRect();
      return { l: r.left - S.left, t: r.top - S.top, r: r.right - S.left, b: r.bottom - S.top, w: r.width, h: r.height };
    };
    const seen = { overflow: new Set(), margin: new Set(), color: new Set() };
    const add = (k, msg) => !seen[k]?.has(msg) && (seen[k]?.add(msg), out[k].push(`${id}: ${msg}`));

    // はみ出し：スライドの外
    for (const e of els) {
      const q = box(e);
      if (!q.w && !q.h) continue;
      if (q.l < -0.5 || q.t < -0.5 || q.r > S.width + 0.5 || q.b > S.height + 0.5) add("overflow", `${name(e)} がスライドの外に出ている`);
    }
    // はみ出し：本文の枠の外
    for (const f of sl.querySelectorAll("[data-frame]")) {
      const F = box(f);
      for (const e of f.querySelectorAll("*")) {
        if (hidden(e)) continue;
        const q = box(e);
        if (!q.w && !q.h) continue;
        const d = Math.max(F.l - q.l, q.r - F.r, F.t - q.t, q.b - F.b);
        if (d > 0.5) add("overflow", `${name(e)} が本文の枠から ${Math.ceil(d)}px はみ出している`);
      }
    }
    // 余白不足：見えるもの（文字・図・背景や枠線のある箱）だけを測る。飾り（data-deco）と、スライド全体を覆う背景は除く
    const visible = (e) => {
      if (e.namespaceURI === SVG) return e.tagName.toLowerCase() === "svg";
      if (["img", "canvas", "video"].includes(e.tagName.toLowerCase())) return true;
      if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return true;
      const cs = getComputedStyle(e);
      return cs.backgroundColor !== "rgba(0, 0, 0, 0)" || ["Top", "Right", "Bottom", "Left"].some((d) => parseFloat(cs[`border${d}Width`]) > 0);
    };
    for (const e of els) {
      if (e.closest("[data-deco]") || !visible(e)) continue;
      const q = box(e);
      if (!q.w || !q.h) continue;
      if (q.w >= S.width - 1 && q.h >= S.height - 1) continue;
      if (q.l < mx - 0.5 || q.r > S.width - mx + 0.5 || q.t < my - 0.5 || q.b > S.height - my + 0.5)
        add("margin", `${name(e)} が余白（左右 ${mx}・上下 ${my}）に入っている`);
    }
    // 色と文字の大きさ
    const texts = [];
    for (const e of els) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const props = [
        "color",
        "backgroundColor",
        "borderTopColor",
        "borderBottomColor",
        "borderLeftColor",
        "borderRightColor",
        "fill",
        "stroke",
        "outlineColor",
      ];
      for (const p of props) {
        const v = cs[p];
        if (!v || v === "none" || v.startsWith("url(")) continue;
        if (p === "color" && !own && e.namespaceURI !== SVG) continue; // 文字のない要素の color は見た目に出ない
        if ((p === "fill" || p === "stroke") && (!SHAPES.has(e.tagName.toLowerCase()) || e.closest("defs, clipPath, mask"))) continue; // fill・stroke は SVG の図形と文字でだけ見た目に出る（切り抜きの形は描かれない）
        if (p === "fill" && e.tagName.toLowerCase() === "line") continue; // 線に塗りはない
        if (p.startsWith("border") && parseFloat(cs[p.replace("Color", "Width")]) === 0) continue;
        if (p === "outlineColor" && (cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) === 0)) continue;
        if (!ok.has(v)) add("color", `${name(e)} の ${p} が ${v}（theme.css のトークンにない色）`);
      }
      if (own && !e.closest(".katex")) {
        const px = parseFloat(cs.fontSize);
        if (px < 11 - 0.01) out.text.push(`${id}: ${name(e)} が ${px}px（11px 未満）`);
        // 重なりを測るため、文字そのものの範囲を集める（要素の箱ではなく文字の範囲で測る）
        for (const n of e.childNodes) {
          if (n.nodeType !== 3 || !n.textContent.trim()) continue;
          const rg = document.createRange();
          rg.selectNodeContents(n);
          // 文字の範囲の上下には、字そのものより広い余白（1em あたり約 0.25）がある。そこを除いて、字の形どうしの重なりだけを見る
          const pad = px * 0.25;
          for (const r of rg.getClientRects()) if (r.width > 1 && r.height > 1) texts.push({ e, l: r.left, t: r.top + pad, r: r.right, b: r.bottom - pad });
        }
      }
    }
    // 重なり：別の要素の文字どうしが 2px 以上重なっている
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i],
          b = texts[j];
        if (a.e === b.e || a.e.contains(b.e) || b.e.contains(a.e)) continue;
        const w = Math.min(a.r, b.r) - Math.max(a.l, b.l),
          h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (w > 2 && h > 2) {
          const msg = `${id}: ${name(a.e)} と ${name(b.e)} が重なっている`;
          if (!out.overlap.includes(msg)) out.overlap.push(msg);
        }
      }
    // 説明文の行数
    for (const e of sl.querySelectorAll("[data-lead]")) {
      const lines = Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
      if (lines > 3) out.lead.push(`${id}: 説明文が ${lines}行（3行まで）`);
    }
  });
  return { slides: slides.length, ...out };
}
