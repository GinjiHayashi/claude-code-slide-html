import { esc, check, R, O } from "./_util.mjs";
import { loadAsset, isIconRef, dataUrl, inlineSvg } from "./_asset.mjs";

// image：画像（写真、画面の写し、アイコン）を1つ置く。素材は人間が decks/<deck-id>/inputs/ に置き、
// outline.md の先頭の assets に出どころとライセンスを書いたものだけを使う（license-notice/policy.md 5章）。
// data: { src, alt, fit?: "cover" | "contain" }
// - src：デッキのフォルダからのパス（inputs/… 。assets の src と同じ）。形式は PNG・JPEG・SVG
// - alt：何が写っているか（読み上げに使う。必須）
// - fit：cover（既定。枠いっぱいに広げ、はみ出す分を切り抜く）／contain（切らずに縦横の比を保って枠に収める）
// - どちらも角を rounded-panel（8）で切り抜き、罫線と同じ色（line）の 1px の枠を付ける。画像をそのまま置かない
// - 1色のアイコン（SVG）は、色を theme.css の primary に差し替えて、枠の中央に置く（icon: true）
// - src に「phosphor:<名前>」と書くと、アイコン集のアイコンを置く（icon: true と同じ。assets には書かない）
// 寸法は部品が計算する（枠の大きさ opt.width・opt.height と、画像の縦横の比から）。

// data の決まり（書けるのはここにある項目だけ。R：必須、O：任意）
export const schema = { src: R, alt: R, fit: O, icon: O };

export default function image(data, opt = {}) {
  check("image", data, schema);
  if (data.fit !== undefined && !["cover", "contain"].includes(data.fit)) throw new Error("image: fit は cover か contain");
  const a = loadAsset("image", data.src, opt.deck);
  const W = opt.width ?? 1172,
    H = opt.height ?? 440;
  if (data.icon || isIconRef(data.src)) {
    if (a.type !== "image/svg+xml") throw new Error("image: icon: true は SVG だけ（色を差し替えるため）");
    const size = Math.min(W, H, 240);
    return `<figure class="m-0 flex h-full items-center justify-center text-primary" data-kind="image" role="img" aria-label="${esc(data.alt)}">${inlineSvg(a, data.src, size)}</figure>`;
  }
  // contain：画像の比のまま、枠に収まる大きさの箱を作る。cover：枠いっぱいの箱
  const s = data.fit === "contain" ? Math.min(W / a.w, H / a.h) : null;
  const w = s ? Math.floor(a.w * s) : W,
    h = s ? Math.floor(a.h * s) : H;
  return `<figure class="m-0 flex h-full items-center justify-center" data-kind="image"><img src="${dataUrl(a)}" alt="${esc(data.alt)}" class="block rounded-panel border border-line object-cover" style="width:${w}px;height:${h}px" data-deck-asset="${esc(data.src)}"></figure>`;
}
