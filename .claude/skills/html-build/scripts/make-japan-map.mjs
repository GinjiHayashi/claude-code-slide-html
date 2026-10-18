// Natural Earth の都道府県の境界から、map 部品（style: shape）が使う SVG の path を作る。
// 使い方：node make-japan-map.mjs <ne_10m_admin_1_states_provinces.geojson> <出力の json>
// - 元データ：Natural Earth v5.1.2（パブリックドメイン）。取得元と sha256 は license-notice/registry.yaml に書く。
// - 加工：日本の47都道府県だけを取り出し、円錐図法で 620×440 に投影し、座標を小数1桁に丸める。
//   地図を大きく見せるため、東京都の伊豆諸島・小笠原諸島（北緯 35 度より南）と、鹿児島県の北緯 30 度より南の島を除く。
//   沖縄県は本島の周り（東経 126.5〜128.5 度、北緯 25.9〜27 度）だけを、左上の枠に別の縮尺で描く。
import fs from "fs";
import { geoConicConformal, geoPath } from "d3-geo";

const src = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const feats = src.features.filter((f) => f.properties.iso_a2 === "JP").map((f) => ({ type: "Feature", properties: { name: f.properties.name_ja }, geometry: f.geometry }));
if (feats.length !== 47) throw new Error(`都道府県が ${feats.length} 件（47 のはず）`);
const keep = (f, ok) => {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const c = (poly) => { const r = poly[0]; return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; };
  return { ...f, geometry: { type: "MultiPolygon", coordinates: polys.filter((poly) => ok(c(poly))) } };
};
const trimmed = feats.map((f) =>
  f.properties.name === "東京都" ? keep(f, ([, y]) => y > 35)
  : f.properties.name === "鹿児島県" ? keep(f, ([, y]) => y > 30)
  : f.properties.name === "沖縄県" ? keep(f, ([x, y]) => x > 126.5 && x < 128.5 && y > 25.9 && y < 27)
  : f);
const W = 620, H = 440;
const main = { type: "FeatureCollection", features: trimmed.filter((f) => f.properties.name !== "沖縄県") };
const oki = trimmed.find((f) => f.properties.name === "沖縄県");
const p1 = geoConicConformal().rotate([-137, 0]).parallels([33, 44]).fitExtent([[150, 4], [W - 4, H - 4]], main);
const p2 = geoConicConformal().rotate([-127.8, 0]).parallels([25, 28]).fitExtent([[16, 16], [124, 104]], oki);
const round = (d) => d.replace(/(\d+\.\d)\d+/g, "$1");
const out = { source: "Natural Earth v5.1.2 ne_10m_admin_1_states_provinces（加工：make-japan-map.mjs）", width: W, height: H, inset: [0, 0, 140, 120], paths: {} };
for (const f of main.features) out.paths[f.properties.name] = round(geoPath(p1)(f));
out.paths["沖縄県"] = round(geoPath(p2)(oki));
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(`${Object.keys(out.paths).length} 都道府県、${fs.statSync(process.argv[3]).size} バイト`);
