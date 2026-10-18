#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readOutline, width, plain, LEAD_LIMIT } from "./outline.mjs";
import { checkResearch } from "../../research-standards/scripts/check-research.mjs";
import { DECK_ID, isMain } from "../../../lib/common.mjs";

// 書式チェック：outline.md をビルドの前に検査する。
// 使い方：node check-outline.mjs decks/<deck-id>/outline.md
// - エラー（ビルドを止める）：型や図の名前が一覧にない、必須の項目がない、知らない項目（書き間違い）、
//   数の上限（箇条書きの数など）を超えた、図のデータが部品の決まりに合わない、スライドの番号の重複。
// - 注意（止めずに報告し、人間の確認で見る）：文字数の目安を超えた（最後はブラウザで実際の行数を測る）、
//   図が3つ以上、太字の数、独自の表現（html:）を使った。
// html: の中のスクリプト（script タグ・on〜 属性・javascript:）はエラー。
// claims：同じフォルダの research.md にある主張の ID か（ない ID、使わなくなった主張はエラー。確度が未確認・矛盾あり、推測の主張は注意）。
// 型の決まりは slide-outline/layout-catalog.md、図は diagram-catalog.md と html-build/components.md。
// 終了コード：0＝エラーなし（注意はあってもよい）、2＝エラーあり（ほかのチェックと同じ）

const COMP = path.join(path.dirname(fileURLToPath(import.meta.url)), "../components");
export const KINDS = ["kpi", "bar", "hbar", "table", "stacked-bar", "line", "area", "combo", "donut", "scatter", "steps", "flowchart", "timeline", "roadmap", "matrix", "pyramid", "tree", "compare", "heatmap", "venn", "sequence", "er", "map", "math"];

// 型ごとの項目。text：1行の文字数の目安。list：箇条書きの数の上限と、1項目の文字数の目安（最後はブラウザで実際の行数を測る）
const BODY = ["breadcrumb", "source"];
export const LAYOUTS = {
  title: { required: ["title", "date"], optional: ["subtitle", "author"], text: { title: 44, subtitle: 50, date: 20 } },
  toc: { required: [], optional: ["title"], text: { title: 30 } },
  section: { required: ["title"], optional: ["description", "topics"], text: { title: 16, description: 120 }, list: { topics: [3, 6, 20] } },
  "title-body": { required: ["title", "body"], optional: BODY, text: { title: 30 }, list: { body: [1, 5, 110] } },
  "text-diagram": { required: ["title", "body"], visual: true, optional: [...BODY, "caption"], text: { title: 30 }, list: { body: [1, 4, 68] } },
  "title-diagram": { required: ["title"], visual: true, optional: [...BODY, "caption"], text: { title: 30 } },
  "two-column": { required: ["title", "left", "right"], optional: BODY, text: { title: 30 }, columns: ["left", "right"] },
  "do-dont": { required: ["title", "do", "dont"], optional: ["breadcrumb"], text: { title: 30 }, columns: ["do", "dont"] },
  "grid-4": { required: ["title", "items"], optional: ["breadcrumb"], text: { title: 30 } },
  checklist: { required: ["title", "items"], optional: ["breadcrumb"], text: { title: 30 } },
  closing: { required: [], optional: ["contact", "email"], text: { contact: 50, email: 50 } },
};
const COMMON = ["layout", "notes", "claims", "html"];
// 説明文（lead）が必須の型（本文のある型）。要らないスライドだけ lead: false
export const WITH_LEAD = ["title-body", "text-diagram", "title-diagram", "two-column", "do-dont", "grid-4", "checklist"];
const VISUAL = ["diagram", "diagrams"]; // 図の型を使う項目。html: と合わせて、図のある型ではどれか1つが必須

export async function checkOutline(file) {
  const errors = [], warnings = [];
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
  for (const k of Object.keys(o.meta)) if (!["deck_id", "title", "pdf"].includes(k)) errors.push(`先頭の設定に知らない項目「${k}」がある`);
  if (!o.slides.length) errors.push("スライドが1枚もない");
  const nch = o.slides.filter((s) => s.fields.layout === "section").length;
  if (nch > 12 && o.slides.some((s) => s.fields.layout === "toc")) errors.push(`章が${nch}ある。目次（toc）に載せられるのは12章まで`);

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
    if (!f.layout) { err(s, "layout がない"); continue; }
    if (!L) { err(s, `layout「${f.layout}」は一覧にない（${Object.keys(LAYOUTS).join("・")}）`); continue; }
    if (i === 0 && f.layout !== "title") warn(s, "1枚目が表紙（title）ではない");

    // 項目の有無
    const lead = WITH_LEAD.includes(f.layout);
    const allowed = new Set([...COMMON, ...L.required, ...L.optional, ...(L.visual ? VISUAL : []), ...(lead ? ["lead"] : [])]);
    for (const k of Object.keys(f)) if (!allowed.has(k)) err(s, `${f.layout} に項目「${k}」は書けない（書けるもの：${[...allowed].filter((x) => x !== "layout").join("・")}）`);
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
      else for (const k of Object.keys(f.author)) if (!["org", "name"].includes(k)) err(s, `author に知らない項目「${k}」がある（org・name）`);
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
    for (const k of L.columns ?? []) {
      const c = f[k];
      if (c == null) continue;
      if (typeof c !== "object" || Array.isArray(c)) { err(s, `${k} は { heading: 小見出し, items: [箇条書き] } の形にする`); continue; }
      for (const x of Object.keys(c)) if (!["heading", "items"].includes(x)) err(s, `${k} に知らない項目「${x}」がある（heading・items）`);
      if (!c.items) err(s, `${k} に items（箇条書き）がない`);
      list(`${k}.items`, [1, 4, f.layout === "two-column" ? 40 : 34], c.items);
      if (c.heading && width(c.heading) > 20) warn(s, `${k}.heading が全角20字の目安を超えている`);
    }
    if (f.layout === "grid-4" && f.items != null) {
      if (!Array.isArray(f.items) || f.items.length !== 4) err(s, "grid-4 の items はちょうど4つ");
      else f.items.forEach((it, n) => {
        if (!it?.heading || !it?.text) return err(s, `items の${n + 1}つ目に heading（小見出し）と text（説明）が要る`);
        for (const x of Object.keys(it)) if (!["heading", "text"].includes(x)) err(s, `items の${n + 1}つ目に知らない項目「${x}」がある`);
        if (width(it.heading) > 15) warn(s, `items の${n + 1}つ目の heading が全角15字を超えている`);
        if (width(plain(it.text)) > 75) warn(s, `items の${n + 1}つ目の text が3行の目安（全角75字）を超えている`);
        bullets.push(it.text);
      });
    }
    if (f.layout === "checklist" && f.items != null) {
      if (!Array.isArray(f.items) || f.items.length < 1 || f.items.length > 8) err(s, "checklist の items は1〜8項目");
      else f.items.forEach((it, n) => {
        if (typeof it?.text !== "string" || typeof it?.done !== "boolean") return err(s, `items の${n + 1}つ目は { text: 項目, done: true か false } の形にする`);
        if (width(it.text) > 24) warn(s, `items の${n + 1}つ目が全角24字の目安を超えている`);
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
    if (Array.isArray(ds)) for (const d of ds) {
      if (!d || typeof d !== "object") { err(s, "diagram は kind と、その型の項目を書く"); continue; }
      if (!KINDS.includes(d.kind)) { err(s, `図の型「${d.kind}」は一覧にない（${KINDS.join("・")}）`); continue; }
      const { kind, ...data } = d;
      try {
        comps[kind] ??= (await import(path.join(COMP, `${kind}.mjs`))).default;
        comps[kind](data);
      } catch (e) {
        err(s, `図 ${kind} のデータが決まりに合わない：${e.message}`);
      }
    }
    const n = (Array.isArray(ds) ? ds : []).filter((d) => d?.kind !== "kpi").length + (f.html && (f.diagram || f.diagrams) ? 1 : 0);
    if (n > 2) warn(s, `図が${n}つある（1枚に2つまで。人間の確認で見る）`);
    if (f.html) warn(s, "独自の表現（html:）を使っている。トークンだけを使い、枠に収め、build-log.md に記録して人間の確認で見る");
    if (f.html && /<script\b|\son\w+\s*=|javascript:/i.test(String(f.html))) err(s, "html: にスクリプト（script タグ・on〜 属性・javascript:）は書けない。スライドに動く処理は入れない");
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
      if (!claims) { err(s, `claims（${ids.join("・")}）があるのに research.md がない`); continue; }
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
  return { errors, warnings, slides: o.slides.length };
}

// コマンドとして呼ばれたとき
if (isMain(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("使い方：node check-outline.mjs <outline.md>"); process.exit(2); }
  const r = await checkOutline(file);
  for (const e of r.errors) console.log(`エラー  ${e}`);
  for (const w of r.warnings) console.log(`注意    ${w}`);
  console.log(`${r.slides}枚：エラー ${r.errors.length}件、注意 ${r.warnings.length}件`);
  process.exit(r.errors.length ? 2 : 0);
}
