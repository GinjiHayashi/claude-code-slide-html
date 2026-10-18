// 走査：deck.html から、使っている素材と外部への読み込みを洗い出す。
// AI の自己申告ではなく、HTML の中身だけから決める。結果は assets-manifest.yaml の元になる。
// 見つけるもの
// - 素材：@font-face のフォント名、data-asset-id="<registry の id>:<名前>" の付いた要素、KaTeX の数式（class="katex"）
// - デッキの素材：data-deck-asset="<src>" の付いた画像・アイコン（outline.md の先頭の assets に出どころを書いたもの。policy.md 5章）
// - 外部への読み込み：script・link・img・iframe・object・embed・video・audio・source の src・href・srcset、
//   CSS の @import と url()（data: と #… は除く）、SVG の href（#… は除く）
// - 識別子のない SVG：部品が作る SVG には data-origin="generated"、素材には data-asset-id を付ける。どちらもないものは注意
// - Tailwind が出力する CSS の先頭のライセンス表記（registry.yaml の条件：消さない）

// フォント名 → registry.yaml の id
const FONT_FAMILIES = [
  [/^Noto Sans JP$/, "noto-sans-jp"],
  [/^Roboto Mono$/, "roboto-mono"],
  [/^KaTeX_/, "katex"],
];

export function scanDeck(html) {
  const assets = new Map(); // id → 見つけた根拠の一覧
  const found = (id, why) => (assets.get(id) ?? assets.set(id, new Map()).get(id)).set(why, (assets.get(id).get(why) ?? 0) + 1);
  const external = [];
  const unknown = [];
  const untaggedSvg = [];
  const deckAssets = new Set();

  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");

  // フォント
  for (const m of styles.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const fam = (m[1].match(/font-family:\s*["']?([^"';]+?)["']?\s*;/) || [])[1];
    const hit = FONT_FAMILIES.find(([re]) => re.test(fam ?? ""));
    if (hit) found(hit[1], `@font-face ${hit[1] === "katex" ? "KaTeX_*" : fam}`);
    else unknown.push(`登録のないフォント：${fam ?? "（名前なし）"}`);
  }
  // CSS の外部読み込み（@font-face の中の data: は上で数えた）
  for (const m of styles.matchAll(/@import\s+[^;]+;/g)) external.push(`CSS の @import：${m[0].slice(0, 80)}`);
  for (const m of styles.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const u = m[1].trim();
    if (!u.startsWith("data:") && !u.startsWith("#")) external.push(`CSS の url()：${u.slice(0, 80)}`);
  }
  for (const m of body.matchAll(/style="[^"]*url\(\s*['"]?([^'")]+)/gi)) {
    const u = m[1].trim();
    if (!u.startsWith("#")) (u.startsWith("data:") ? unknown : external).push(`style 属性の url()：${u.slice(0, 80)}`);
  }

  // 要素の読み込み
  for (const m of body.matchAll(/<(script|link|img|iframe|object|embed|video|audio|source|image|use|track)\b([^>]*)>/gi)) {
    const tag = m[1].toLowerCase();
    const deck = tag === "img" && (m[2].match(/\sdata-deck-asset="([^"]+)"/) || [])[1]; // デッキの素材の画像（data: で埋め込む）
    for (const a of m[2].matchAll(/\s(src|href|xlink:href|srcset|data|poster)\s*=\s*["']([^"']*)["']/gi)) {
      const u = a[2].trim();
      if (u.startsWith("#") || u === "") continue;
      if (u.startsWith("data:") && deck) deckAssets.add(deck);
      else if (u.startsWith("data:")) unknown.push(`<${tag}> に埋め込まれた素材（data:）。registry.yaml に登録して data-asset-id を付ける`);
      else external.push(`<${tag} ${a[1]}="${u.slice(0, 80)}">`);
    }
  }

  // 素材の識別子
  for (const m of body.matchAll(/data-asset-id="([^":]+):([^"]+)"/g)) found(m[1], `data-asset-id ${m[1]}:${m[2]}`);
  for (const m of body.matchAll(/<svg\b[^>]*\sdata-deck-asset="([^"]+)"/g)) deckAssets.add(m[1]); // デッキの素材のアイコン（SVG をそのまま埋め込む）
  // KaTeX：数式の HTML（フォントがなくても、数式があれば KaTeX を使っている）
  const katex = (body.match(/class="katex"/g) || []).length;
  if (katex) found("katex", "KaTeX の数式");

  // SVG の識別子。スライドごとに見て、どのスライドかを記録する
  for (const sec of body.split(/(?=<section\b[^>]*class="slide")/)) {
    const id = (sec.match(/^<section\b[^>]*data-id="([^"]+)"/) || [])[1];
    if (!id) continue;
    for (const m of sec.matchAll(/<svg\b([^>]*)>/gi)) if (!/data-origin=|data-asset-id=|data-deck-asset=/.test(m[1])) untaggedSvg.push(id);
  }

  const tailwind = (styles.match(/\/\*! tailwindcss v([\d.]+) \| MIT License \| https:\/\/tailwindcss\.com \*\//) || [])[1] ?? null;

  return {
    assets: [...assets].map(([id, why]) => ({ id, found: [...why].map(([w, n]) => (n > 1 ? `${w}（${n}）` : w)) })),
    external,
    unknown,
    untaggedSvg: [...new Set(untaggedSvg)],
    deckAssets: [...deckAssets],
    tailwind,
  };
}
