import { esc } from "./_util.mjs";

// SVG のグラフで共通に使う目盛と軸。座標の計算は d3-scale に任せる。

/** 横の目盛線と左の数値。目盛線は最小限の薄い線にする（charts.md 4章） */
export const yGrid = (y, x0, x1, fmt = (v) => v.toLocaleString("ja-JP"), side = "left") =>
  y
    .ticks(5)
    .map((t) => {
      const ty = y(t).toFixed(1);
      const label =
        side === "left"
          ? `<text class="fill-label text-caption" x="${x0 - 10}" y="${ty}" text-anchor="end" dominant-baseline="middle">${fmt(t)}</text>`
          : `<text class="fill-label text-caption" x="${x1 + 10}" y="${ty}" text-anchor="start" dominant-baseline="middle">${fmt(t)}</text>`;
      return `<line class="stroke-line" x1="${x0}" x2="${x1}" y1="${ty}" y2="${ty}" stroke-width="1"/>${label}`;
    })
    .join("");

/** 下の項目名。多いときは間引く */
export const xLabels = (labels, xOf, yPos) => {
  const step = labels.length > 12 ? Math.ceil(labels.length / 12) : 1;
  return labels
    .map((l, i) =>
      i % step === 0 || i === labels.length - 1
        ? `<text class="fill-ink text-caption" x="${xOf(l, i).toFixed(1)}" y="${yPos}" text-anchor="middle">${esc(l)}</text>`
        : "",
    )
    .join("");
};

/** 右端に直接書く系列名が重ならないよう、上下に押し広げる */
export const spread = (items, minGap = 20, top = 0, bottom = Infinity) => {
  const s = [...items].sort((a, b) => a.y - b.y);
  if (s.length) s[0].y = Math.max(top, s[0].y); // 上の端より上には出さない
  for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < minGap) s[i].y = s[i - 1].y + minGap;
  const over = s.length ? s.at(-1).y - bottom : 0;
  if (over > 0) s.forEach((it) => (it.y = Math.max(top, it.y - over)));
  return s;
};
