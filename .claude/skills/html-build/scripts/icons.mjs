// アイコン集（Phosphor の塗り。registry.yaml の id: phosphor）から、英語の語でアイコンを探す。外部に通信しない。
// 使い方：node .claude/skills/html-build/scripts/icons.mjs <英語の語> [<英語の語> ...]
//   例：node .claude/skills/html-build/scripts/icons.mjs people team
// 出力：合う順に、outline.md に書く形（phosphor:<名前>）と、カテゴリ・タグ。最大 20 件
// - タグは英語だけ。日本語の意味は、AI が英語の語に直してから探す（同じ意味の語を2〜3個並べると見つかりやすい）
// - 名前で決めず、カテゴリとタグを見て、スライドの意味に合うものを選ぶ
import { icons } from "@phosphor-icons/core";
import { isMain } from "../../../lib/common.mjs";

/** 語ごとに、名前・タグ・カテゴリとの合い方で点を付け、合計の高い順に返す */
export function searchIcons(words, limit = 20) {
  const ws = words.map((w) => w.toLowerCase().trim()).filter(Boolean);
  const score = (ic) =>
    ws.reduce((sum, w) => {
      const parts = ic.name.split("-");
      if (ic.name === w) return sum + 100;
      if (parts.includes(w)) return sum + 40;
      if (ic.tags.some((t) => t.toLowerCase() === w)) return sum + 30;
      if (ic.name.includes(w)) return sum + 15;
      if (ic.tags.some((t) => t.toLowerCase().includes(w))) return sum + 10;
      if (ic.categories.some((c) => c.includes(w))) return sum + 5;
      return sum;
    }, 0);
  return icons
    .map((ic) => ({ ic, s: score(ic) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.ic.name.length - b.ic.name.length || a.ic.name.localeCompare(b.ic.name))
    .slice(0, limit)
    .map(({ ic }) => ({ ref: `phosphor:${ic.name}`, categories: ic.categories, tags: ic.tags.filter((t) => !t.startsWith("*")) }));
}

if (isMain(import.meta.url)) {
  const words = process.argv.slice(2);
  if (!words.length) {
    console.error("使い方：node .claude/skills/html-build/scripts/icons.mjs <英語の語> [<英語の語> ...]");
    process.exit(2);
  }
  const hits = searchIcons(words);
  if (!hits.length) {
    console.log("見つからない。別の英語の語で探す");
    process.exit(1);
  }
  for (const h of hits) console.log(`${h.ref}\t${h.categories.join(",")}\t${h.tags.join(", ")}`);
}
