// S4b：HTML/Tailwind の部品でスライドを組み立てる（スパイク用）
// 部品にはデータだけを渡し、寸法（棒の長さなど）はこのスクリプトが計算する
import fs from 'fs';
const dir = new URL('.', import.meta.url).pathname;

// outline.md の内容（スパイクでは手で写す。本番では outline.md をパースする）
const deck = { title: 'データ基盤の導入提案', subtitle: '2026年10月 データ基盤チーム（試作）' };
const slides = [
  { id: 'S01', layout: 'title', title: deck.title, subtitle: deck.subtitle },
  { id: 'S02', layout: 'title-diagram', title: '全体構成', caption: '図1 データの流れ',
    diagram: { kind: 'flow', nodes: [
      { label: '業務システム', type: 'system' }, { label: 'GCS', type: 'store' },
      { label: 'BigQuery raw', type: 'store' }, { label: 'dbt で変換', type: 'process' },
      { label: 'BigQuery mart', type: 'store' }, { label: 'ダッシュボード', type: 'system' } ] },
    notes: '左から右へ、データが集まって加工される流れを説明する' },
  { id: 'S03', layout: 'title-diagram', title: '月次レポート作成時間の比較', caption: '図2 月次レポートの作成時間',
    source: '架空のサンプルデータ（スパイク用）', claims: ['C-001'],
    diagram: { kind: 'bar', unit: '時間／月', data: [
      { label: '現状（手作業）', value: 40 }, { label: '導入後（自動化）', value: 6, highlight: true } ] },
    notes: '作成時間が約7分の1になる見込みを示す' },
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- 部品（components.md に載せる候補） ----
const arrow = `<svg class="w-8 h-8 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-origin="generated"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

const flow = ({ nodes }) => {
  const style = {
    system: 'bg-white border-2 border-ink text-ink',
    store: 'bg-accent-soft border-2 border-accent-soft text-accent-ink',
    process: 'bg-accent border-2 border-accent text-white',
  };
  const items = nodes.map((n, i) => `
    <div class="w-36 h-28 rounded-xl ${style[n.type]} flex items-center justify-center px-2 text-center text-[18px] font-bold leading-snug [word-break:auto-phrase]">${esc(n.label)}</div>`);
  const nums = nodes.map((_, i) => `<span class="w-36 text-center text-xs font-bold tracking-widest text-muted">${String(i + 1).padStart(2, '0')}</span>`);
  const legend = [['system', 'システム'], ['store', 'データの保管'], ['process', '変換処理']]
    .map(([t, l]) => `<span class="flex items-center gap-2"><span class="w-4 h-4 rounded ${style[t]}"></span>${l}</span>`).join('');
  return `<div class="flex flex-col items-center gap-10">
    <div class="flex flex-col gap-3">
      <div class="flex gap-2">${nums.join('<span class="w-8"></span>')}</div>
      <div class="flex items-center gap-2">${items.join(arrow)}</div>
    </div>
    <div class="flex gap-8 text-sm text-sub">${legend}</div></div>`;
};

const bar = ({ data, unit }) => {
  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const rows = data.map(d => {
    const w = (d.value / max * 75).toFixed(1); // 寸法はスクリプトが計算する（右25%は数値ラベル用）
    return `<div class="grid grid-cols-[200px_1fr] items-center gap-6">
      <span class="text-[20px] font-bold ${d.highlight ? 'text-accent' : 'text-sub'} text-right">${esc(d.label)}</span>
      <div class="flex items-center gap-4">
        <div class="h-16 rounded-r-lg ${d.highlight ? 'bg-accent' : 'bg-line'}" style="width:${w}%"></div>
        <span class="whitespace-nowrap text-[36px] font-bold ${d.highlight ? 'text-accent' : 'text-ink'} tabular-nums">${d.value}<span class="text-base font-normal text-sub ml-1">${esc(unit)}</span></span>
      </div></div>`;
  }).join('');
  const ratio = Math.round(max / min);
  return `<div class="grid grid-cols-[1fr_260px] gap-12 items-center w-full">
    <div class="flex flex-col gap-8">${rows}</div>
    <div class="rounded-2xl bg-surface border border-line p-8 flex flex-col gap-2">
      <span class="text-sm font-bold text-sub">作成時間（現状比）</span>
      <span class="text-[72px] leading-none font-bold text-accent tabular-nums">1/${ratio}</span>
      <span class="text-sm text-muted">${max} → ${min} ${esc(unit)}</span>
    </div></div>`;
};

const diagrams = { flow, bar };

// ---- レイアウト（layout-catalog.md に載せる候補） ----
const layouts = {
  title: s => `<section class="slide flex bg-white" data-slide="${s.id}">
    <div class="w-4 bg-accent"></div>
    <div class="flex-1 flex flex-col justify-center px-24 gap-6">
      <h1 class="text-[64px] font-bold text-ink tracking-tight leading-tight">${esc(s.title)}</h1>
      <div class="w-24 h-1.5 bg-accent rounded-full"></div>
      <p class="text-[24px] text-sub">${esc(s.subtitle)}</p>
    </div></section>`,
  'title-diagram': (s, n, total) => `<section class="slide flex flex-col bg-white px-20 pt-16 pb-10" data-slide="${s.id}"${s.claims ? ` data-claims="${s.claims.join(' ')}"` : ''}>
    <header class="flex items-center gap-4 pb-6 border-b border-line">
      <span class="w-2 h-9 bg-accent rounded-full"></span>
      <h1 class="text-[40px] font-bold text-ink tracking-tight">${esc(s.title)}</h1>
    </header>
    <div class="flex-1 flex items-center justify-center py-8">${diagrams[s.diagram.kind](s.diagram)}</div>
    <footer class="flex items-end justify-between text-sm text-muted">
      <span>${esc(s.caption ?? '')}${s.source ? `　出典：${esc(s.source)}` : ''}</span>
      <span class="tabular-nums">${n} / ${total}</span>
    </footer>
    ${s.notes ? `<aside class="hidden" data-notes>${esc(s.notes)}</aside>` : ''}
  </section>`,
};

// キーボードでのページ送り（スパイクでは方式A の deck.html から流用していたものをここに置いた）
const nav = `
const slides = [...document.querySelectorAll(".slide")];
let current = 0;
function show(i) {
  current = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, k) => s.classList.toggle("active", k === current));
}
function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  document.documentElement.style.setProperty("--scale", s);
}
addEventListener("resize", fit);
addEventListener("keydown", e => {
  if (e.key === "p") { document.body.classList.toggle("present"); fit(); show(current); }
  if (["ArrowRight", "PageDown", " "].includes(e.key)) show(current + 1);
  if (["ArrowLeft", "PageUp"].includes(e.key)) show(current - 1);
});
`;
const body = slides.map((s, i) => layouts[s.layout](s, i + 1, slides.length)).join('\n');
const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deck.title)}（スパイク：HTML/Tailwind）</title>
<style>/*TAILWIND*/</style>
</head><body class="font-sans">
${body}
<script>
// キーボードでのページ送り${nav}</script>
</body></html>`;
fs.writeFileSync(dir + 'src.html', html);
console.log('src.html written');
