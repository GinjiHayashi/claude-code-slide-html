#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readOutline, width, plain, LEAD_LIMIT } from "./outline.mjs";
import { checkResearch } from "../../research-standards/scripts/check-research.mjs";
import { DECK_ID, isMain } from "../../../lib/common.mjs";
import { MATCHES, KINDS, LAYOUTS, allowedFields } from "./spec.mjs";
import { isIconRef, readIcon } from "../components/_asset.mjs";

// 書式チェック：outline.md をビルドの前に検査する。
// 使い方：node check-outline.mjs decks/<deck-id>/outline.md
// - エラー（ビルドを止める）：型や図の名前が一覧にない、必須の項目がない、知らない項目（書き間違い）、
//   数の上限（箇条書きの数など）を超えた、図のデータが部品の決まりに合わない、スライドの番号の重複。
// - 注意（止めずに報告し、人間の確認で見る）：文字数の目安を超えた（最後はブラウザで実際の行数を測る）、
//   図が3つ以上、太字の数、独自の表現（html:）を使った、図のイメージ（idea・match）がない、match と描き方が合わない。
// match は そのまま・意味が欠ける・描けない のどれかで始める（そのまま以外は「：」のあとに理由）。違えばエラー。
// html: の中のスクリプト（script タグ・on〜 属性・javascript:）はエラー。
// claims：同じフォルダの research.md にある主張の ID か（ない ID、使わなくなった主張はエラー。確度が未確認・矛盾あり、推測の主張は注意）。
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
  // デッキの素材（画像・アイコン）：license-notice/policy.md 5章
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
      if (!/^inputs\/[^/].*/.test(a.src) || a.src.includes("..")) errors.push(`${where} の src「${a.src}」は inputs/ の中のファイルにする`);
      else if (!fs.existsSync(path.join(o.dir, a.src))) errors.push(`${where} の src「${a.src}」のファイルがない`);
      if (assets.findIndex((x) => x?.src === a.src) !== n) errors.push(`${where} の src「${a.src}」が重複している`);
    });
  if (!o.slides.length) errors.push("スライドが1枚もない");
  const nch = o.slides.filter((s) => s.fields.layout === "section").length;
  if (nch > LAYOUTS.toc.chapters && o.slides.some((s) => s.fields.layout === "toc"))
    errors.push(`章が${nch}ある。目次（toc）に載せられるのは${LAYOUTS.toc.chapters}章まで`);

  const seen = new Set();
  const comps = {};
  for (const [i, s] of o.slides.entries()) {
    const f = s.fields;
    if (!/^S\d{2,3}$/.test(s.id)) err(s, "見出しは S01 のように S と2〜3桁の番号にする");
    if (seen.has(s.id)) err(s, "スライドの番号が重複している");
    seen.add(s.id);
    if (s.id !== `S${String(i + 1).padStart(2, "0")}`) warn(s, `${i + 1}枚目だが番号が ${s.id}（番号は並び順と合わせると直しやすい）`);
    for (const k of s.dup) err(s, `項目「${k}」が2回書かれている`);
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
      if (k === "title" && f.layout === "title") {
        if (lines.length > 2) err(s, "表紙の title は2行まで");
        lines.forEach((l, n) => width(plain(l)) > 22 && warn(s, `表紙の title の${n + 1}行目が全角22字の目安を超えている（${width(plain(l))}字）`));
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

    // 箇条書き（太字を数えるため、説明文もここに入れる）
    const bullets = [];
    if (lead) {
      if (f.lead === undefined || f.lead === null || f.lead === "") err(s, "説明文（lead）がない。要らないスライドは lead: false と書く");
      else if (f.lead !== false && typeof f.lead !== "string") err(s, "lead は文章か false にする");
      else if (typeof f.lead === "string") {
        bullets.push(f.lead);
        if (f.lead.trim().includes("\n")) err(s, "lead は改行せずに1つの文章で書く（行の折り返しはビルドが決める）");
        if (width(plain(f.lead)) > LEAD_LIMIT) err(s, `lead が3行に収まらない（全角${width(plain(f.lead))}字。${LEAD_LIMIT}字まで）`);
      }
    }
    const list = (k, [min, max, each], arr = f[k]) => {
      if (arr == null) return;
      if (!Array.isArray(arr)) return err(s, `${k} は箇条書き（- で始まる行の並び）にする`);
      if (arr.length < min || arr.length > max) err(s, `${k} は${min}〜${max}項目（今は${arr.length}項目）`);
      arr.forEach((t, n) => {
        if (typeof t !== "string") return err(s, `${k} の${n + 1}項目目が文字ではない`);
        bullets.push(t);
        if (width(plain(t)) > each) warn(s, `${k} の${n + 1}項目目が全角${each}字の目安を超えている（${width(plain(t))}字）`);
      });
    };
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

    // 太字（components.md 4.2）：1項目に1か所、1枚に3か所まで
    const bolds = (t) => (String(t).match(/\*\*(.+?)\*\*/g) ?? []).length;
    bullets.forEach((t) => bolds(t) > 1 && warn(s, `太字が1項目に${bolds(t)}か所ある（目安は1か所）：${plain(t).slice(0, 20)}…`));
    const total = bullets.reduce((a, t) => a + bolds(t), 0);
    if (total > 3) warn(s, `太字が1枚に${total}か所ある（目安は3か所まで）`);

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
          comps[kind] ??= (await import(path.join(COMP, `${kind}.mjs`))).default;
          if (kind === "image") usedAssets.add(data.src);
          comps[kind](data, { deck });
        } catch (e) {
          err(s, `図 ${kind} のデータが決まりに合わない：${e.message}`);
        }
      }
    const n = (Array.isArray(ds) ? ds : []).filter((d) => d?.kind !== "kpi").length + (f.html && (f.diagram || f.diagrams) ? 1 : 0);
    if (n > 2) warn(s, `図が${n}つある（1枚に2つまで。人間の確認で見る）`);
    // 図のイメージ（slide-outline の手順 5）：先に idea で絵を書き、match で部品で描けるかを決める
    const hasFigure = !!(f.diagram || f.diagrams || f.html);
    const match = f.match == null ? null : String(f.match).trim();
    const matchKind = match && MATCHES.find((x) => match.startsWith(x));
    if (hasFigure && !f.idea) warn(s, "図のイメージ（idea）がない。部品を選ぶ前に、見せたい絵を1〜3行で書く");
    if (hasFigure && match == null) warn(s, `match がない（${MATCHES.join("・")}）`);
    if (!hasFigure && (f.idea || match != null)) warn(s, "idea・match があるのに図がない");
    if (match != null && !matchKind) err(s, `match は ${MATCHES.join("・")} のどれかで始める`);
    else if (matchKind && matchKind !== MATCHES[0] && !/^[^：:]+[：:]\s*\S/.test(match))
      err(s, `match が「${matchKind}」のときは「：」のあとに、何が欠けるか・なぜ描けないかを書く`);
    if (matchKind === MATCHES[0] && f.html && !f.diagram && !f.diagrams) warn(s, "match が「そのまま」なのに独自の表現（html:）で描いている。部品を使う");
    if (matchKind && matchKind !== MATCHES[0] && !f.html) warn(s, `match が「${matchKind}」なのに部品で描いている。独自に描く`);
    if (f.html)
      warn(
        s,
        `独自の表現（html:）を使っている${matchKind && matchKind !== MATCHES[0] ? `（match：${matchKind}）` : ""}。トークンだけを使い、枠に収め、build-log.md に記録して人間の確認で見る`,
      );
    if (f.html && /<script\b|\son\w+\s*=|javascript:/i.test(String(f.html)))
      err(s, "html: にスクリプト（script タグ・on〜 属性・javascript:）は書けない。スライドに動く処理は入れない");
    if (f.claims != null && (!Array.isArray(f.claims) || f.claims.some((c) => !/^C-\d{3,}$/.test(c)))) err(s, "claims は [C-001, C-002] の形にする");
  }
  // claims と research.md の突き合わせ（ファクトチェックが同じ ID で主張と出典を読むため）
  const withClaims = o.slides.filter((s) => s.fields.claims !== undefined);
  if (withClaims.length) {
    const rf = path.join(path.dirname(file), "research.md");
    const claims = fs.existsSync(rf) ? Object.fromEntries(checkResearch(fs.readFileSync(rf, "utf8")).claims.map((c) => [c.id, c.fields])) : null;
    for (const s of withClaims) {
      const ids = s.fields.claims;
      if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) continue; // 形の誤りは上で出している
      if (!claims) {
        err(s, `claims（${ids.join("・")}）があるのに research.md がない`);
        continue;
      }
      for (const id of ids) {
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
  for (const a of deck.assets) if (a?.src && !usedAssets.has(a.src)) warnings.push(`assets の ${a.src} はどのスライドでも使っていない`);
  return { errors, warnings, slides: o.slides.length };
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
