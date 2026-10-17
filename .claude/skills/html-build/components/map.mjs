import fs from "fs";
import { fileURLToPath } from "url";
import { esc, need, num, unitLabel, seqStep } from "./_util.mjs";

// 都道府県の境界（Natural Earth v5.1.2 を scripts/make-japan-map.mjs で加工したもの。registry.yaml の natural-earth）
const SHAPES = fileURLToPath(new URL("../../license-notice/assets/natural-earth/japan-prefectures.json", import.meta.url));

// map：都道府県ごとの値を青の濃淡で示す（コロプレス）。
// data: { data: [{ pref, value }], unit, style?: "shape" | "tile", steps?: 3〜5, highlight?: [pref] }
// opt:  { width, height, shapes?（境界を差し替えるとき） }
// - shape（既定）：実際の形で描く。境界は Natural Earth（ユーザーが決定）。沖縄は左上の枠に描く。
//   小さい都府県（東京・香川など）は色が読みにくいので、強調や数値は本文や callout で補う。
// - tile：47都道府県を同じ大きさの正方形で並べる（タイルグリッド地図）。小さい県も読め、マスに名前を書ける。
// - pref は「東京都」「東京」のどちらでもよい。値のない都道府県は灰色。
// - 濃淡の段階と凡例は heatmap と同じ。

// タイルの位置（列, 行）。左が西、上が北。沖縄は左下。
const TILE = {
  北海道: [13, 0], 青森: [13, 1], 秋田: [12, 2], 岩手: [13, 2], 山形: [12, 3], 宮城: [13, 3],
  石川: [10, 4], 富山: [11, 4], 新潟: [12, 4], 福島: [13, 4],
  福井: [9, 5], 岐阜: [10, 5], 長野: [11, 5], 群馬: [12, 5], 栃木: [13, 5],
  島根: [5, 6], 鳥取: [6, 6], 兵庫: [7, 6], 京都: [8, 6], 滋賀: [9, 6], 愛知: [10, 6], 山梨: [11, 6], 埼玉: [12, 6], 茨城: [13, 6],
  山口: [4, 7], 広島: [5, 7], 岡山: [6, 7], 大阪: [7, 7], 奈良: [8, 7], 三重: [9, 7], 静岡: [10, 7], 神奈川: [11, 7], 東京: [12, 7], 千葉: [13, 7],
  佐賀: [1, 8], 福岡: [2, 8], 愛媛: [5, 8], 香川: [6, 8], 和歌山: [7, 8],
  長崎: [1, 9], 熊本: [2, 9], 大分: [3, 9], 高知: [5, 9], 徳島: [6, 9],
  鹿児島: [2, 10], 宮崎: [3, 10], 沖縄: [0, 10],
};
const short = (p) => (p === "北海道" ? p : p.replace(/[都府県]$/, ""));

export default function map(data, opt = {}) {
  need("map", data, ["data", "unit"]);
  const W = opt.width ?? 1172, H = opt.height ?? 440;
  const val = new Map(data.data.map((d) => {
    const k = short(d.pref);
    if (!TILE[k]) throw new Error(`map: ${d.pref} という都道府県がない`);
    return [k, d.value];
  }));
  const { shades, step, legend } = seqStep([...val.values()], data.steps ?? 5);
  const hi = new Set((data.highlight ?? []).map(short));
  const look = (k) => (val.has(k) ? shades[step(val.get(k))] : { bg: "bg-gray-200", fill: "fill-gray-200", text: "text-label", onFill: "fill-label" });
  let body;
  if (data.style === "tile") {
    const s = Math.floor(Math.min((H - 8) / 11, 600 / 14)), g = 3;
    const tiles = Object.entries(TILE).map(([k, [c, r]]) => {
      const L = look(k);
      return `<div class="absolute flex items-center justify-center ${k.length > 2 ? "text-footer" : "text-caption"} font-bold ${L.bg} ${L.text} ${hi.has(k) ? "outline outline-[3px] outline-ink z-10" : ""}" style="left:${c * s}px;top:${r * s}px;width:${s - g}px;height:${s - g}px" title="${esc(k)} ${val.has(k) ? num(val.get(k)) : "値なし"}">${esc(k)}</div>`;
    }).join("");
    body = `<div class="relative shrink-0" style="width:${14 * s}px;height:${11 * s}px">${tiles}</div>`;
  } else {
    const S = opt.shapes ?? JSON.parse(fs.readFileSync(SHAPES, "utf8"));
    const paths = Object.entries(S.paths).map(([p, d]) => {
      const k = short(p), L = look(k);
      return `<path class="${L.fill} ${hi.has(k) ? "stroke-ink" : "stroke-canvas"}" stroke-width="${hi.has(k) ? 2.5 : 0.8}" stroke-linejoin="round" d="${d}"><title>${esc(k)} ${val.has(k) ? num(val.get(k)) : "値なし"}</title></path>`;
    }).join("");
    const [ix, iy, iw, ih] = S.inset;
    const k = Math.min(1, H / S.height); // 説明文があって本文が低いときは、高さに合わせて縮める
    body = `<svg class="block shrink-0" width="${Math.floor(S.width * k)}" height="${Math.floor(S.height * k)}" viewBox="0 0 ${S.width} ${S.height}" role="img" aria-label="都道府県の地図"><rect class="fill-none stroke-gray-400" stroke-width="1" x="${ix + 0.5}" y="${iy + 0.5}" width="${iw}" height="${ih}"/>${paths}</svg>`;
  }
  return `<div class="flex h-full w-full items-center justify-center gap-[48px]" data-kind="map" style="max-width:${W}px">
${body}
<div class="flex flex-col gap-[8px]">${unitLabel(data.unit)}${legend}<div class="flex items-center gap-[6px]"><span class="inline-block h-[16px] w-[24px] border border-line bg-gray-200"></span><span class="text-caption text-label">値なし</span></div></div>
</div>`;
}
