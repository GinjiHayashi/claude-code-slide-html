// 部品で共通に使う小さな関数。
// 部品は「データを受け取り HTML の文字列を返す」関数にする（要求文書 11章）。
// Tailwind はソースの文字列からクラス名を拾うため、クラス名は組み立てずに完全な形で書く。

/** HTML に埋め込む文字を安全にする */
export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 数値を3桁区切りにする。数値でなければそのまま返す */
export const num = (v) => (typeof v === "number" ? v.toLocaleString("ja-JP") : esc(v));

/** 必須の項目がなければ止める（書式チェックの前の最後の守り） */
export const need = (kind, data, keys) => {
  for (const k of keys) {
    if (data?.[k] === undefined || data?.[k] === null) throw new Error(`${kind}: 必須の項目 ${k} がない`);
  }
};

/** 強調表示（outline.md に書いた値をそのまま出す。部品は計算しない） */
export const callout = (c) =>
  c
    ? `<div class="flex w-[240px] shrink-0 flex-col justify-center gap-[8px] border-l-[4px] border-primary pl-[24px]">
  <div class="text-kpi font-bold text-primary">${esc(c.value)}</div>
  <div class="text-body text-label">${esc(c.label)}</div>
</div>`
    : "";

/** 単位の表示（図の左上） */
export const unitLabel = (unit) => (unit ? `<div class="text-caption text-label">単位：${esc(unit)}</div>` : "");
