#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readOutline, width, plain, LEAD, LEAD_LIMIT } from "./outline.mjs";
import { checkResearch } from "../../research-standards/scripts/check-research.mjs";
import { DECK_ID, isMain, researchFile } from "../../../lib/common.mjs";
import { readSources } from "../../slide-intake/scripts/reference.mjs";
import { MATCHES, KINDS, LAYOUTS, SUB_ITEMS, BOLD, LEAD_BOLD, BULLETS, VARIETY, SLIDE_ID, IDEA, allowedFields } from "./spec.mjs";
import { isIconRef, readIcon } from "../components/_asset.mjs";
import { KNOWLEDGE, parseKnowledge, conceptFieldErrors, checkConcepts } from "../../slide-outline/scripts/check-knowledge.mjs";

// 書式チェック：outline.md をビルドの前に検査する。
// 使い方：node check-outline.mjs decks/<deck-id>/outline.md
// - エラー（ビルドを止める）：型や図の名前が一覧にない、必須の項目がない、知らない項目（書き間違い）、
//   数の上限（箇条書きの数など）を超えた、図のデータが部品の決まりに合わない、スライドの番号の重複。
// - 注意（止めずに報告し、人間の確認で見る）：文字数の目安を超えた（最後はブラウザで実際の行数を測る）、
//   図が3つ以上、太字の数、独自の表現（html:）を使った、図のイメージ（idea・match）がない、match と描き方が合わない、idea に順序がないと書いたのに steps で描いた、
//   idea が長い（spec.mjs の IDEA）、図の変更の指示（change）が残っている。
// match は そのまま・意味が欠ける・描けない のどれかで始める（そのまま以外は「：」のあとに理由）。違えばエラー。
// html: の中のスクリプト（script タグ・on〜 属性・javascript:）はエラー。
// claims：C-001 は research.md（reference/research.md か、前からのデッキは直下）にある主張の ID か（ない ID、使わなくなった主張はエラー。確度が未確認・矛盾あり、推測の主張は注意）。
//   R-001 は reference/ の資料の md にある ID か（ないとエラー）。
// question・new・uses・adept（構成のフレームワーク）：knowledge-map.md があれば突き合わせる（前方参照、new にならない Must はエラー。問いがないなどは注意）。
//   知識マップの検査そのもの（循環など）は check-knowledge.mjs。知識マップが読めないときは突き合わせない。
// 型の決まり（項目・数・文字数）は spec.mjs、図の項目は各部品の schema。
// 終了コード：0＝エラーなし（注意はあってもよい）、2＝エラーあり（ほかのチェックと同じ）

const COMP = path.join(path.dirname(fileURLToPath(import.meta.url)), "../components");

export async function checkOutline(file) {
  const errors = [],
    warnings = [];
  let o;
  try {
    o = readOutline(file);
  } catch (e) {
    return { errors: [e.message], warnings, slides: 0 };
  }
  const at = (s) => `${s.id}（${path.basename(file)}:${s.line}）`;
  const err = (s, m) => errors.push(`${at(s)}: ${m}`);
  const warn = (s, m) => warnings.push(`${at(s)}: ${m}`);

  // デッキ全体の設定
  if (!o.meta.deck_id) errors.push("先頭の設定に deck_id がない");
  else if (!DECK_ID.test(o.meta.deck_id)) errors.push(`deck_id「${o.meta.deck_id}」は YYYY-MM-DD-<短い英語名> の形にする`);
  if (!o.meta.title) errors.push("先頭の設定に title（デッキの題名）がない");
  for (const k of Object.keys(o.meta)) if (!["deck_id", "title", "pdf", "assets"].includes(k)) errors.push(`先頭の設定に知らない項目「${k}」がある`);
  // デッキの素材（画像・アイコン）：license-notice/policy.md 5章。スライドに載せる画像は assets/ に置く（inputs/ は git の管理外）
  const assets = o.meta.assets ?? [];
  const deck = { dir: o.dir, assets: Array.isArray(assets) ? assets : [] };
  const usedAssets = new Set();
  if (!Array.isArray(assets)) errors.push("assets は素材の並び（- で始まる行）にする");
  else
    assets.forEach((a, n) => {
      const where = `assets の${n + 1}つ目`;
      if (!a || typeof a !== "object" || Array.isArray(a)) return errors.push(`${where} は { src, credit, license, url? } の形にする`);
      for (const k of Object.keys(a))
        if (!["src", "credit", "license", "url"].includes(k)) errors.push(`${where} に知らない項目「${k}」がある（src・credit・license・url）`);
      for (const k of ["src", "credit", "license"]) if (!a[k]) errors.push(`${where} に ${k} がない（出どころとライセンスを書く）`);
      if (!a.src) return;
      if (!/^(assets|inputs)\/[^/].*/.test(a.src) || a.src.includes("..")) errors.push(`${where} の src「${a.src}」は assets/ の中のファイルにする`);
      else if (a.src.startsWith("inputs/"))
        warnings.push(`${where} の src「${a.src}」は inputs/ にある。inputs/ は git に入らず、ほかの端末でビルドできないので、assets/ に移して src を直す`);
      else if (!fs.existsSync(path.join(o.dir, a.src))) errors.push(`${where} の src「${a.src}」のファイルがない`);
      if (assets.findIndex((x) => x?.src === a.src) !== n) errors.push(`${where} の src「${a.src}」が重複している`);
    });
  if (!o.slides.length) errors.push("スライドが1枚もない");
  const nch = o.slides.filter((s) => s.fields.layout === "section").length;
  if (nch > LAYOUTS.toc.chapters && o.slides.some((s) => s.fields.layout === "toc"))
    errors.push(`章が${nch}ある。目次（toc）に載せられるのは${LAYOUTS.toc.chapters}章まで`);

  const seen = new Set(),
    names = new Set();
  const comps = {};
  for (const [i, s] of o.slides.entries()) {
    const f = s.fields;
    if (!/^S\d{2,3}$/.test(s.id)) err(s, "見出しは S01 のように S と2〜3桁の番号にする");
    if (seen.has(s.id)) err(s, "スライドの番号が重複している");
    seen.add(s.id);
    if (s.id !== `S${String(i + 1).padStart(2, "0")}`) warn(s, `${i + 1}枚目だが番号が ${s.id}（番号は並び順と合わせると直しやすい）`);
    for (const k of s.dup) err(s, `項目「${k}」が2回書かれている`);
    if (f.id !== undefined) {
      if (typeof f.id !== "string" || !SLIDE_ID.test(f.id)) err(s, "id は英小文字・数字とハイフンで書く（例：tdd-intro）");
      else if (names.has(f.id)) err(s, `id「${f.id}」がほかのスライドと重複している`);
      names.add(f.id);
    }
    const L = LAYOUTS[f.layout];
    if (!f.layout) {
      err(s, "layout がない");
      continue;
    }
    if (!L) {
      err(s, `layout「${f.layout}」は一覧にない（${Object.keys(LAYOUTS).join("・")}）`);
      continue;
    }
    if (i === 0 && f.layout !== "title") warn(s, "1枚目が表紙（title）ではない");

    // 項目の有無
    const lead = !!L.lead;
    const allowed = allowedFields(L);
    for (const k of Object.keys(f))
      if (!allowed.has(k)) err(s, `${f.layout} に項目「${k}」は書けない（書けるもの：${[...allowed].filter((x) => x !== "layout").join("・")}）`);
    for (const k of L.required) if (f[k] === undefined || f[k] === null || f[k] === "") err(s, `${f.layout} に必須の項目「${k}」がない`);
    if (L.visual && !f.diagram && !f.diagrams && !f.html) err(s, `${f.layout} には diagram・diagrams・html のどれかが必要`);
    if (f.diagram && f.diagrams) err(s, "diagram と diagrams は片方だけにする");

    // 文字数の目安
    for (const [k, max] of Object.entries(L.text ?? {})) {
      if (f[k] == null) continue;
      const lines = String(f[k]).replace(/\n+$/, "").split("\n"); // 「|」で書くと最後に改行が付くので外す
      if (L.lines?.[k]) {
        if (lines.length > L.lines[k]) err(s, `${k} は${L.lines[k]}行まで`);
        lines.forEach((l, n) => width(plain(l)) > max && warn(s, `${k} の${n + 1}行目が全角${max}字の目安を超えている（${width(plain(l))}字）`));
      } else if (lines.length > 1 && k === "title") err(s, "title は1行にする");
      else if (width(plain(f[k])) > max) warn(s, `${k} が全角${max}字の目安を超えている（${width(plain(f[k]))}字）`);
    }
    if (f.layout === "title" && f.author != null) {
      if (typeof f.author !== "object" || Array.isArray(f.author)) err(s, "author は { org: 所属, name: 氏名 } の形にする（どちらか片方でもよい）");
      else
        for (const [k, v] of Object.entries(f.author)) {
          if (!(k in L.author)) err(s, `author に知らない項目「${k}」がある（org・name）`);
          else if (width(String(v)) > L.author[k]) warn(s, `author.${k} が全角${L.author[k]}字の目安を超えている`);
        }
    }

    // 箇条書き（太字を数えるため）
    const bullets = [];
    if (lead) {
      if (f.lead === undefined || f.lead === null || f.lead === "") err(s, "説明文（lead）がない。要らないスライドは lead: false と書く");
      else if (f.lead !== false && typeof f.lead !== "string") err(s, "lead は文章か false にする");
      else if (typeof f.lead === "string") {
        if (f.lead.trim().includes("\n")) err(s, "lead は改行せずに1つの文章で書く（行の折り返しはビルドが決める）");
        const n = width(plain(f.lead));
        if (n > LEAD_LIMIT) err(s, `lead が3行に収まらない（全角${n}字。${LEAD_LIMIT}字まで）`);
        else if (n < LEAD.short && !f.lead_short)
          warn(s, `lead が短い（全角${n}字。目安は${LEAD.target[0]}〜${LEAD.target[1]}字）。表や大きな図のために短くするなら lead_short: <理由> と書く`);
        else if (n >= LEAD.short && f.lead_short) warn(s, "lead が短くないので lead_short は要らない");
      }
    }
    const list = (k, [min, max, each, nest = false], arr = f[k]) => {
      if (arr == null) return;
      if (!Array.isArray(arr)) return err(s, `${k} は箇条書き（- で始まる行の並び）にする`);
      const top = arr.filter((t) => !Array.isArray(t));
      if (top.length < min || top.length > max) err(s, `${k} は${min}〜${max}項目（今は${top.length}項目）`);
      arr.forEach((t, n) => {
        if (Array.isArray(t)) {
          // 下の階層：書ける欄だけ（spec の list の4つ目）。すぐ前が文字の項目で、中身は文字だけ
          if (!nest) return err(s, `${k} には下の階層を書けない（書けるのは title-body・text-diagram の body だけ）`);
          if (n === 0 || Array.isArray(arr[n - 1])) return err(s, `${k} の${n + 1}つ目の並び（下の階層）は、文字の項目のすぐあとに書く`);
          if (!t.length || t.length > SUB_ITEMS) err(s, `${k} の下の階層は1〜${SUB_ITEMS}項目`);
          return t.forEach((c) => {
            if (typeof c !== "string") return err(s, `${k} の下の階層は文字だけ（3つ目の階層は書けない）`);
            bullets.push(c);
            if (width(plain(c)) > each) warn(s, `${k} の下の階層の「${c.slice(0, 10)}…」が全角${each}字の目安を超えている`);
          });
        }
        if (typeof t !== "string") return err(s, `${k} の${n + 1}項目目が文字ではない`);
        bullets.push(t);
        if (width(plain(t)) > each) warn(s, `${k} の${n + 1}項目目が全角${each}字の目安を超えている（${width(plain(t))}字）`);
        else if (BULLETS.layouts.includes(f.layout) && width(plain(t)) < BULLETS.minItem)
          warn(
            s,
            `${k} の${n + 1}項目目が短すぎる（全角${width(plain(t))}字）。1項目で意味が通る長さにする（目安は全角${BULLETS.goodItem}字以上。principles.md 5章）`,
          );
      });
    };
    if (f.numbered != null && typeof f.numbered !== "boolean") err(s, "numbered は true か false にする");
    for (const [k, rule] of Object.entries(L.list ?? {})) list(k, rule);
    for (const k of L.columns?.keys ?? []) {
      const c = f[k],
        C = L.columns;
      if (c == null) continue;
      if (typeof c !== "object" || Array.isArray(c)) {
        err(s, `${k} は { heading: 小見出し, items: [箇条書き] } の形にする`);
        continue;
      }
      for (const x of Object.keys(c)) if (!["heading", "items"].includes(x)) err(s, `${k} に知らない項目「${x}」がある（heading・items）`);
      if (!c.items) err(s, `${k} に items（箇条書き）がない`);
      list(`${k}.items`, [...C.items, C.each], c.items);
      if (c.heading && width(c.heading) > C.heading) warn(s, `${k}.heading が全角${C.heading}字の目安を超えている`);
    }
    if (L.grid && f.items != null) {
      const G = L.grid;
      if (!Array.isArray(f.items) || f.items.length !== G.count) err(s, `${f.layout} の items はちょうど${G.count}つ`);
      else
        f.items.forEach((it, n) => {
          if (!it?.heading || !it?.text) return err(s, `items の${n + 1}つ目に heading（小見出し）と text（説明）が要る`);
          for (const x of Object.keys(it)) if (!["heading", "text", "icon"].includes(x)) err(s, `items の${n + 1}つ目に知らない項目「${x}」がある`);
          if (it.icon !== undefined && isIconRef(it.icon)) {
            try {
              readIcon("grid-4", it.icon);
            } catch (e) {
              err(s, `items の${n + 1}つ目の${e.message.replace(/^grid-4: /, " ")}`);
            }
          } else if (it.icon !== undefined) {
            usedAssets.add(it.icon);
            if (!deck.assets.some((a) => a?.src === it.icon)) err(s, `items の${n + 1}つ目の icon「${it.icon}」が先頭の assets にない`);
            else if (!/\.svg$/i.test(it.icon)) err(s, `items の${n + 1}つ目の icon は SVG にする（色を theme.css の色に差し替えるため）`);
          }
          if (width(it.heading) > G.heading) warn(s, `items の${n + 1}つ目の heading が全角${G.heading}字を超えている`);
          if (width(plain(it.text)) > G.text) warn(s, `items の${n + 1}つ目の text が3行の目安（全角${G.text}字）を超えている`);
          bullets.push(it.text);
        });
    }
    if (L.checks && f.items != null) {
      const K = L.checks;
      if (!Array.isArray(f.items) || f.items.length < K.min || f.items.length > K.max) err(s, `${f.layout} の items は${K.min}〜${K.max}項目`);
      else
        f.items.forEach((it, n) => {
          if (typeof it?.text !== "string" || typeof it?.done !== "boolean")
            return err(s, `items の${n + 1}つ目は { text: 項目, done: true か false } の形にする`);
          for (const x of Object.keys(it)) if (!["text", "done"].includes(x)) err(s, `items の${n + 1}つ目に知らない項目「${x}」がある`);
          if (width(it.text) > K.text) warn(s, `items の${n + 1}つ目が全角${K.text}字の目安を超えている`);
        });
    }

    // 太字（components.md 4.2、数は spec.mjs の BOLD）
    const bolds = (t) => (String(t).match(/\*\*(.+?)\*\*/g) ?? []).length;
    bullets.forEach((t) => bolds(t) > BOLD.perItem && warn(s, `太字が1項目に${bolds(t)}か所ある（目安は${BOLD.perItem}か所）：${plain(t).slice(0, 20)}…`));
    const total = bullets.reduce((a, t) => a + bolds(t), 0);
    if (total > BOLD.perSlide) warn(s, `太字が1枚に${total}か所ある（目安は${BOLD.perSlide}か所まで）`);
    // 説明文の強調（components.md 4.2、数は spec.mjs の LEAD_BOLD）。本文の太字とは別に数える
    if (typeof f.lead === "string") {
      const em = (f.lead.match(/\*\*(.+?)\*\*/g) ?? []).map((t) => width(plain(t)));
      if (em.length > LEAD_BOLD.max) warn(s, `lead の強調が${em.length}か所ある（${LEAD_BOLD.max}か所まで。目安は${LEAD_BOLD.good}か所）`);
      em.forEach((n) => n > LEAD_BOLD.chars && warn(s, `lead の強調に全角${n}字のものがある（1か所は${LEAD_BOLD.chars}字まで。文ではなく語句を囲む）`));
      const sum = em.reduce((a, n) => a + n, 0);
      const all = width(plain(f.lead));
      if (all && sum / all > LEAD_BOLD.ratio)
        warn(s, `lead の強調が全体の${Math.round((sum / all) * 100)}%ある（${Math.round(LEAD_BOLD.ratio * 100)}%まで。強調ばかりだと目立たない）`);
    }

    // 図：名前が一覧にあるか、データが部品の決まりに合うか（部品を実際に呼んで確かめる）
    const ds = f.diagrams ?? (f.diagram ? [f.diagram] : []);
    if (f.diagrams && (!Array.isArray(f.diagrams) || f.diagrams.length !== 2)) err(s, "diagrams は図を2つ並べるときに使い、ちょうど2つ書く（1つなら diagram）");
    if (Array.isArray(ds))
      for (const d of ds) {
        if (!d || typeof d !== "object") {
          err(s, "diagram は kind と、その型の項目を書く");
          continue;
        }
        if (!KINDS.includes(d.kind)) {
          err(s, `図の型「${d.kind}」は一覧にない（${KINDS.join("・")}）`);
          continue;
        }
        const { kind, ...data } = d;
        try {
          const load = async (k) => {
            if (!KINDS.includes(k)) throw new Error(`図の型「${k}」は一覧にない`);
            return (comps[k] ??= (await import(path.join(COMP, `${k}.mjs`))).default);
          };
          await load(kind);
          if (kind === "canvas") for (const k of (await import(path.join(COMP, "canvas.mjs"))).chartKinds(data)) await load(k);
          if (kind === "image") usedAssets.add(data.src);
          comps[kind](data, { deck, comps });
        } catch (e) {
          err(s, `図 ${kind} のデータが決まりに合わない：${e.message}`);
        }
      }
    const n = (Array.isArray(ds) ? ds : []).filter((d) => d?.kind !== "kpi").length + (f.html && (f.diagram || f.diagrams) ? 1 : 0);
    if (n > 2) warn(s, `図が${n}つある（1枚に2つまで。人間の確認で見る）`);
    // 図のイメージ（slide-outline の手順 6）：先に idea で絵を書き、match で部品で描けるかを決める
    const hasFigure = !!(f.diagram || f.diagrams || f.html);
    const match = f.match == null ? null : String(f.match).trim();
    const matchKind = match && MATCHES.find((x) => match.startsWith(x));
    if (hasFigure && !f.idea) warn(s, "図のイメージ（idea）がない。部品を選ぶ前に、見せたい絵を1〜3行で書く");
    if (hasFigure && match == null) warn(s, `match がない（${MATCHES.join("・")}）`);
    if (!hasFigure && (f.idea || match != null)) warn(s, "idea・match があるのに図がない");
    // idea は足していかず、今の絵の説明に書き換える（change の統合。make-slides の「直すとき」）
    if (typeof f.idea === "string") {
      const lines = f.idea.replace(/\n+$/, "").split("\n").length;
      const n = width(plain(f.idea));
      if (lines > IDEA.lines || n > IDEA.chars)
        warn(s, `idea が長い（${lines}行、全角${n}字。目安は${IDEA.lines}行・${IDEA.chars}字まで）。足していかず、今の絵の説明に書き換える`);
    }
    // change：人間が書く図の変更の指示。図を直したら idea に統合して空にする
    if (f.change != null && typeof f.change !== "string") err(s, "change は文章で書く（図の変更の指示）");
    else if (typeof f.change === "string" && f.change.trim())
      warn(s, "図の変更の指示（change）が残っている。図を直して idea に統合し、change を空にする（make-slides の「直すとき」）");
    if (match != null && !matchKind) err(s, `match は ${MATCHES.join("・")} のどれかで始める`);
    else if (matchKind && matchKind !== MATCHES[0] && !/^[^：:]+[：:]\s*\S/.test(match))
      err(s, `match が「${matchKind}」のときは「：」のあとに、何が欠けるか・なぜ描けないかを書く`);
    // 自由図（canvas）は、一覧の型で描けないときの描き方（「そのまま」以外）。一覧の型と同じ扱いにしない
    const kinds = (Array.isArray(ds) ? ds : []).map((d) => d?.kind).filter((k) => k && k !== "kpi");
    const listed = kinds.filter((k) => k !== "canvas");
    if (matchKind === MATCHES[0] && f.html && !f.diagram && !f.diagrams) warn(s, "match が「そのまま」なのに独自の表現（html:）で描いている。部品を使う");
    if (matchKind === MATCHES[0] && kinds.includes("canvas")) warn(s, "match が「そのまま」なのに自由図（canvas）で描いている。一覧の型を使う");
    if (matchKind && matchKind !== MATCHES[0] && !f.html && !kinds.includes("canvas") && listed.length)
      warn(s, `match が「${matchKind}」なのに一覧の型（${listed.join("・")}）で描いている。自由図（canvas）か独自の表現で描く`);
    // steps は順序があるときだけ（diagram-catalog.md 4章）。idea に「順序なし」と書いたのに steps で描いたら注意
    if (/順序(が|は)?(なし|ない|無)/.test(String(f.idea ?? "")) && kinds.includes("steps"))
      warn(s, "idea に順序がないと書いたのに steps で描いている。同じ重さの項目を並べるだけなら cards にする（diagram-catalog.md 4章）");
    if (f.html)
      warn(
        s,
        `独自の表現（html:）を使っている${matchKind && matchKind !== MATCHES[0] ? `（match：${matchKind}）` : ""}。トークンだけを使い、枠に収める。人間の確認で見る`,
      );
    if (f.html && /<script\b|\son\w+\s*=|javascript:/i.test(String(f.html)))
      err(s, "html: にスクリプト（script タグ・on〜 属性・javascript:）は書けない。スライドに動く処理は入れない");
    if (f.claims != null && (!Array.isArray(f.claims) || f.claims.some((c) => !/^[CR]-\d{3,}$/.test(c))))
      err(s, "claims は [C-001, R-002] の形にする（C は research.md の主張、R は reference/ の資料）");
    for (const m of conceptFieldErrors(f)) err(s, m);
  }
  // claims と research.md・reference/ の突き合わせ（ファクトチェックが同じ ID で主張と出典を読むため）
  // C-001：AI の調査の主張（reference/research.md。前からのデッキは直下の research.md）。R-001：人が渡した資料の md（reference/sources/・chat/）
  const withClaims = o.slides.filter((s) => s.fields.claims !== undefined);
  if (withClaims.length) {
    const rf = researchFile(path.dirname(file));
    const sources = new Set(readSources(path.dirname(file)).map((x) => x.meta.id));
    const claims = fs.existsSync(rf) ? Object.fromEntries(checkResearch(fs.readFileSync(rf, "utf8")).claims.map((c) => [c.id, c.fields])) : null;
    for (const s of withClaims) {
      const ids = s.fields.claims;
      if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) continue; // 形の誤りは上で出している
      for (const id of ids.filter((x) => x.startsWith("R-")))
        if (!sources.has(id)) err(s, `claims の ${id} が reference/ の資料にない（slide-intake/reference-format.md）`);
      const cs = ids.filter((x) => x.startsWith("C-"));
      if (cs.length && !claims) {
        err(s, `claims（${cs.join("・")}）があるのに research.md がない`);
        continue;
      }
      for (const id of cs) {
        const c = claims[id];
        if (!c) err(s, `claims の ${id} が research.md にない`);
        else if (c.dropped) err(s, `claims の ${id} は research.md で使わなくなった主張（dropped：${c.dropped}）`);
        else {
          if (["未確認", "矛盾あり"].includes(c.confidence)) warn(s, `claims の ${id} は確度が「${c.confidence}」。人間に伝える`);
          if (c.kind === "推測") warn(s, `claims の ${id} は推測の主張。スライドで事実のように書いていないか確かめる`);
        }
      }
    }
  }
  // 知識マップとの突き合わせ（slide-outline/structure-framework.md 3-4・4-2・5-2）
  const km = path.join(path.dirname(file), KNOWLEDGE);
  const conceptual = o.slides.some((s) => ["question", "new", "uses", "adept"].some((k) => s.fields[k] != null));
  if (fs.existsSync(km)) {
    const k = parseKnowledge(fs.readFileSync(km, "utf8"));
    if (k.errors.length || !k.nodes.length) warnings.push(`${KNOWLEDGE} が読めないので、new・uses を確かめていない（check-knowledge.mjs で直す）`);
    else {
      const r = checkConcepts(o.slides, k.nodes);
      for (const [s, m] of r.errors) s ? err(s, m) : errors.push(m);
      for (const [s, m] of r.warnings) s ? warn(s, m) : warnings.push(m);
    }
  } else if (conceptual) warnings.push(`question・new・uses・adept を書いているが ${KNOWLEDGE} がないので、前方参照を確かめていない`);
  for (const a of deck.assets) if (a?.src && !usedAssets.has(a.src)) warnings.push(`assets の ${a.src} はどのスライドでも使っていない`);
  warnings.push(...layoutBalance(o.slides));
  return { errors, warnings, slides: o.slides.length };
}

// 型の偏り（principles.md 5章）：箇条書きの型が、本文のあるスライドの BULLETS.ratio を超えたら注意を返す
export function layoutBalance(slides) {
  const body = slides.filter((s) => LAYOUTS[s.fields.layout]?.lead);
  const list = body.filter((s) => BULLETS.layouts.includes(s.fields.layout));
  const out = [];
  if (body.length && list.length / body.length > BULLETS.ratio)
    out.push(
      `箇条書きの型（${BULLETS.layouts.join("・")}）が、本文のあるスライド${body.length}枚のうち${list.length}枚（${Math.round((100 * list.length) / body.length)}%）。${Math.round(BULLETS.ratio * 100)}%以下を目安に、図で表せるものは図にする（principles.md 5章）`,
    );
  return [...out, ...variety(body)];
}

// 型と部品の偏り：同じスライドの型・同じ図の型の連続と、1つの図の型の割合（本文のあるスライドで数える）
function variety(body) {
  const out = [];
  const runs = (key, what) => {
    for (let i = 0; i < body.length; ) {
      let j = i;
      while (j + 1 < body.length && key(body[j + 1]) && key(body[j + 1]) === key(body[i])) j++;
      if (key(body[i]) && j - i + 1 >= VARIETY.run)
        out.push(`${body[i].id}〜${body[j].id} の${j - i + 1}枚が、同じ${what}（${key(body[i])}）。続けて同じ形にしない`);
      i = j + 1;
    }
  };
  const kinds = (s) => (s.fields.diagrams ?? (s.fields.diagram ? [s.fields.diagram] : [])).map((d) => d?.kind).filter(Boolean);
  runs((s) => s.fields.layout, "スライドの型");
  runs((s) => kinds(s).join("・"), "図の型");
  const withFig = body.filter((s) => kinds(s).length);
  if (withFig.length >= VARIETY.min) {
    const n = {};
    for (const s of withFig) for (const k of new Set(kinds(s))) n[k] = (n[k] ?? 0) + 1;
    for (const [k, c] of Object.entries(n))
      if (c / withFig.length > VARIETY.ratio)
        out.push(
          `図の型 ${k} が、図のあるスライド${withFig.length}枚のうち${c}枚（${Math.round((100 * c) / withFig.length)}%）。${Math.round(VARIETY.ratio * 100)}%以下を目安に、ほかの型も使う（diagram-catalog.md 4章）`,
        );
  }
  return out;
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("使い方：node check-outline.mjs <outline.md>");
    process.exit(2);
  }
  const r = await checkOutline(file);
  for (const e of r.errors) console.log(`エラー  ${e}`);
  for (const w of r.warnings) console.log(`注意    ${w}`);
  console.log(`${r.slides}枚：エラー ${r.errors.length}件、注意 ${r.warnings.length}件`);
  process.exit(r.errors.length ? 2 : 0);
}
