import path from "path";
import { fileURLToPath } from "url";
import { esc } from "./components/_util.mjs";
import { leadWidth, width, plain, LEAD } from "./scripts/outline.mjs";

// スライドの型（slide-outline/layout-catalog.md）を HTML にする。運用時は固定（D4）。
// renderDeck(outline) が、outline.md の各スライドを1つの <section class="slide"> にして返す。
// - 寸法・色・文字の大きさは layout-catalog の値。Tailwind が読み取れるよう、クラス名は省略せずに書く。
// - 図は components/ の部品に outline のデータと枠の大きさを渡して作る。
// - 自動で入れるもの：表紙以外のページ番号（base.html）、パンくず（直前の章の扉の title）、章の番号と進み具合の点、目次の項目。

const COMP = path.join(path.dirname(fileURLToPath(import.meta.url)), "components");
const SLIDE_W = 1280, SLIDE_H = 720, X = 54, BODY_W = SLIDE_W - 2 * X; // BODY_W = 1172
const LINE = 27.2; // text-body（16px）の1行の高さ（行の高さ 1.7）

// ---- 文字 ----
const strong = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>'); // **語句** → 太字（components.md 4.2）
const TITLE = `m-0 flex items-center gap-[24px] text-title font-bold text-primary before:block before:h-[1.25em] before:w-[8px] before:shrink-0 before:translate-y-[0.06em] before:bg-primary before:content-['']`;
const STRIP_LEFT = `<div class="absolute bottom-0 left-0 top-0 w-strip bg-primary"></div>`;
const STRIP_BOTTOM = `<div class="absolute inset-x-0 bottom-0 h-strip bg-primary"></div>`;
const bullets = (items, size = "text-heading") =>
  `<ul class="m-0 flex list-none flex-col gap-[16px] p-0 ${size} text-ink">${items.map((t) => `<li class="flex gap-[12px]"><span class="mt-[0.7em] h-[6px] w-[6px] shrink-0 rounded-full bg-primary"></span><span>${strong(t)}</span></li>`).join("")}</ul>`;

// 説明文の行数（幅を広げたあと）。ビルド後の検査（5-4）で実際の行数を測る
const leadLines = (t) => Math.ceil(width(plain(t)) / (leadWidth(t) / LEAD.px - 2));

// ---- 本文のある型の枠：パンくず・タイトル・説明文・本文・出典 ----
// 本文の枠の高さを計算し、inner(w, h) に渡す。下端は出典の上（720 − 64）
function page(s, ctx, inner) {
  const f = s.fields;
  const crumb = f.breadcrumb ?? ctx.chapter;
  let top = 63 + (crumb ? 22 + 8 : 0) + 47; // 余白の上端 slide-top ＋ パンくず ＋ タイトル（36px × 1.3）
  let lead = "";
  if (typeof f.lead === "string") {
    lead = `<p class="m-0 mt-[32px] text-body text-ink" data-lead style="width:${leadWidth(f.lead)}px">${strong(f.lead)}</p>`;
    top += 32 + leadLines(f.lead) * LINE + 32;
  } else top += 50; // 説明文がないときは title-gap
  const h = Math.floor(SLIDE_H - 64 - top);
  const body = inner(BODY_W, h);
  return section(s, ctx, `<div class="px-slide-x pt-slide-top">
${crumb ? `<div class="mb-[8px] text-breadcrumb font-bold text-primary">${esc(crumb)}</div>` : ""}<h2 class="${TITLE}">${esc(f.title)}</h2>${lead}
<div class="${lead ? "mt-[32px]" : "mt-title-gap"}" style="height:${h}px" data-frame="body">${body}</div>
</div>${f.source ? `<div class="absolute bottom-slide-bottom left-slide-x text-caption text-label">${esc(f.source)}</div>` : ""}`);
}

const section = (s, ctx, inner) => `<section class="slide" data-id="${esc(s.id)}" data-layout="${esc(s.fields.layout)}">
${inner}${s.fields.notes ? `\n<aside class="notes">${esc(s.fields.notes)}</aside>` : ""}
</section>`;

// ---- 図 ----
async function diagram(d, w, h, comps) {
  const { kind, ...data } = d;
  comps[kind] ??= (await import(path.join(COMP, `${kind}.mjs`))).default;
  return comps[kind](data, { width: Math.floor(w), height: Math.floor(h) });
}
// 図の枠：diagram（1つ）・diagrams（左右に2つ）・html（独自の表現）。caption は図の下に書く
async function visual(f, w, h, comps) {
  const cap = f.caption ? `<div class="mt-[8px] text-caption text-label">${esc(f.caption)}</div>` : "";
  const H = f.caption ? h - 26 : h;
  let v;
  if (f.html) v = `<div class="h-full w-full" data-custom>${f.html}</div>`; // 独自の表現（components.md 4.1）
  else if (f.diagrams) {
    const [a, b] = f.diagrams;
    if (a.kind === "kpi") {
      // 案B：kpi を左に縦に積み、もう1つを右に置く（components.md 4章）
      const stack = (await Promise.all(a.items.map((it) => diagram({ kind: "kpi", items: [it] }, 360, H, comps)))).join('<div class="h-[16px]"></div>');
      v = `<div class="flex h-full gap-[48px]"><div class="flex w-[360px] shrink-0 flex-col justify-center">${stack}</div><div class="min-w-0 flex-1">${await diagram(b, w - 408, H, comps)}</div></div>`;
    } else {
      const half = (w - 48) / 2;
      v = `<div class="flex h-full gap-[48px]"><div class="min-w-0 flex-1">${await diagram(a, half, H, comps)}</div><div class="min-w-0 flex-1">${await diagram(b, half, H, comps)}</div></div>`;
    }
  } else v = await diagram(f.diagram, w, H, comps);
  return `<div class="flex h-full flex-col"><div class="min-h-0 flex-1">${v}</div>${cap}</div>`;
}

// ---- 型ごと ----
const LAYOUTS = {
  // 表紙：下端に横の帯。タイトルと副題は縦の中央、発表者は左下・日付は右下（layout-catalog 3.1）
  title: (s) => {
    const f = s.fields, a = f.author ?? {};
    const who = [a.org, a.name].filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join("");
    return section(s, null, `${STRIP_BOTTOM}
<div class="absolute inset-y-0 left-[80px] right-[80px] flex flex-col justify-center"><div class="-translate-y-[0.04em]">
<h1 class="m-0 text-cover font-bold text-primary">${esc(String(f.title).trim()).replace(/\n/g, "<br>")}</h1>${f.subtitle ? `<div class="mt-[16px] text-heading text-ink">${esc(f.subtitle)}</div>` : ""}
</div></div>
<div class="absolute bottom-[60px] left-[80px] right-[80px] flex items-end justify-between border-t border-line pt-[16px] text-body text-label"><div class="flex flex-col">${who}</div><span>${esc(f.date)}</span></div>`);
  },
  // 目次：後ろの章の扉の title から自動で作る
  toc: (s, ctx) => section(s, ctx, `<div class="px-slide-x pt-slide-top"><h2 class="${TITLE}">${esc(s.fields.title ?? "目次")}</h2>
<ol class="m-0 mt-title-gap flex list-none flex-col p-0">${ctx.chapters.map((c, i) => `<li class="flex items-baseline gap-[32px] border-b border-line py-[20px]"><span class="w-[48px] text-heading font-bold text-blue-600">${String(i + 1).padStart(2, "0")}</span><span class="text-heading font-bold text-ink">${esc(c)}</span></li>`).join("")}</ol></div>`),
  // 章の扉：左に章番号・進み具合の点・タイトル・説明、右にトピック（layout-catalog 3.2）
  section: (s, ctx) => {
    const f = s.fields, n = ctx.chapterNo;
    const dots = ctx.chapters.map((_, i) => `<span class="inline-block h-[8px] w-[8px] rounded-full ${i + 1 === n ? "bg-primary" : "bg-gray-200"}"></span>`).join("");
    const topics = f.topics?.length ? `<div class="border-l-2 border-line pl-[32px]"><div class="text-body font-bold text-label">トピック</div><ol class="m-0 mt-[8px] list-decimal pl-[24px] text-body text-ink">${f.topics.map((t) => `<li class="py-[4px]">${esc(t)}</li>`).join("")}</ol></div>` : "<div></div>";
    return section(s, ctx, `${STRIP_LEFT}
<div class="absolute inset-y-0 left-[80px] right-slide-x grid grid-cols-[1fr_400px] items-center gap-[64px]">
<div><div class="text-heading font-bold text-blue-600">CHAPTER ${n}<span class="ml-[16px] inline-flex gap-[6px] align-middle">${dots}</span></div>
<h2 class="m-0 mt-[8px] text-section font-bold text-primary">${esc(f.title)}</h2>${f.description ? `<p class="m-0 mt-[24px] text-body text-ink">${strong(f.description)}</p>` : ""}</div>
${topics}</div>`);
  },
  "title-body": (s, ctx) => page(s, ctx, () => `<div class="max-w-[960px]">${bullets(s.fields.body)}</div>${s.fields.html ? `<div class="mt-[24px]" data-custom>${s.fields.html}</div>` : ""}`),
  "text-diagram": async (s, ctx) => {
    let out;
    const html = page(s, ctx, (w, h) => (out = { w, h }, "@@VISUAL@@"));
    const v = await visual(s.fields, out.w - 560 - 40, out.h, ctx.comps);
    return html.replace("@@VISUAL@@", `<div class="flex h-full gap-[40px]"><div class="w-column shrink-0">${bullets(s.fields.body, "text-body")}</div><div class="min-w-0 flex-1">${v}</div></div>`);
  },
  "title-diagram": async (s, ctx) => {
    let out;
    const html = page(s, ctx, (w, h) => (out = { w, h }, "@@VISUAL@@"));
    return html.replace("@@VISUAL@@", await visual(s.fields, out.w, out.h, ctx.comps));
  },
  "two-column": (s, ctx) => page(s, ctx, () => `<div class="grid h-full grid-cols-2 gap-[48px]">${["left", "right"].map((k, i) => {
    const c = s.fields[k];
    return `<div class="rounded-panel ${i ? "bg-highlight" : "bg-panel"} p-[32px]">${c.heading ? `<div class="mb-[24px] text-heading font-bold ${i ? "text-primary" : "text-ink"}">${esc(c.heading)}</div>` : ""}${bullets(c.items)}</div>`;
  }).join("")}</div>`),
  "do-dont": (s, ctx) => page(s, ctx, () => `<div class="grid h-full grid-cols-2 gap-[48px]">${["do", "dont"].map((k) => {
    const ok = k === "do", c = s.fields[k];
    return `<div class="flex h-full flex-col rounded-panel bg-panel"><div class="h-[8px] rounded-t-panel ${ok ? "bg-success" : "bg-error"}"></div><div class="p-[32px]"><div class="mb-[24px] flex items-center gap-[12px] text-heading font-bold ${ok ? "text-success" : "text-error"}"><span class="text-title leading-none">${ok ? "◯" : "×"}</span>${esc(c.heading ?? (ok ? "良い例" : "悪い例"))}</div>${bullets(c.items)}</div></div>`;
  }).join("")}</div>`),
  "grid-4": (s, ctx) => page(s, ctx, () => `<div class="grid h-full grid-cols-2 grid-rows-2 gap-[24px]">${s.fields.items.map((it, i) => `<div class="rounded-panel bg-panel p-[24px]"><div class="flex items-center gap-[12px] text-heading font-bold text-ink"><span class="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-primary text-body text-on-primary">${i + 1}</span>${esc(it.heading)}</div><p class="m-0 mt-[12px] text-body text-ink">${strong(it.text)}</p></div>`).join("")}</div>`),
  // チェックリスト：済みは青の塗りとチェック、未済みは空の枠と太字（形でも区別する）
  checklist: (s, ctx) => {
    const ck = (done) => done
      ? `<svg width="24" height="24" viewBox="0 0 24 24" class="shrink-0" role="img" aria-label="済み"><rect x="1" y="1" width="22" height="22" rx="4" class="fill-primary"/><path d="M6 12.5l4 4 8-9" class="fill-none stroke-canvas" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg width="24" height="24" viewBox="0 0 24 24" class="shrink-0" role="img" aria-label="未済み"><rect x="2" y="2" width="20" height="20" rx="4" class="fill-canvas stroke-lightblue-1200" stroke-width="2"/></svg>`;
    const it = s.fields.items, done = it.filter((x) => x.done).length;
    return page(s, ctx, () => `<div class="grid grid-cols-2 gap-x-[48px]">${it.map((x) => `<div class="flex items-center gap-[16px] border-b border-line py-[16px]">${ck(x.done)}<span class="text-heading ${x.done ? "text-label" : "font-bold text-ink"}">${esc(x.text)}</span></div>`).join("")}</div><div class="mt-[24px] text-body text-label">${it.length}項目のうち${done}項目が済み</div>`);
  },
  // 締め：表紙と同じく下端の帯。問い合わせ先とメールは、あるときだけ
  closing: (s) => {
    const f = s.fields, c = [f.contact, f.email && `メール：${f.email}`].filter(Boolean);
    return section(s, null, `${STRIP_BOTTOM}
<div class="absolute inset-y-0 left-[80px] right-[80px] flex flex-col justify-center"><div class="-translate-y-[0.04em]">
<h2 class="m-0 text-cover font-bold text-primary">ありがとうございました</h2>${c.length ? `<div class="mt-[32px] text-body text-label">${c.map((t) => `<div>${esc(t)}</div>`).join("")}</div>` : ""}
</div></div>`);
  },
};

/** outline（parseOutline の戻り値）から、スライドの HTML を順に返す */
export async function renderDeck(outline) {
  const chapters = outline.slides.filter((s) => s.fields.layout === "section").map((s) => s.fields.title);
  const ctx = { chapters, chapter: null, chapterNo: 0, comps: {} };
  const out = [];
  for (const s of outline.slides) {
    if (s.fields.layout === "section") { ctx.chapterNo++; ctx.chapter = s.fields.title; }
    out.push(await LAYOUTS[s.fields.layout](s, ctx));
  }
  return out;
}
