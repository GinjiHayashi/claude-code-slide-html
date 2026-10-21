#!/usr/bin/env node
// 知識マップの検査と、説明の順序の候補（structure-framework.md 2章・3章）
// 使い方：node .claude/skills/slide-outline/scripts/check-knowledge.mjs decks/<deck-id>
// - 知識マップ：decks/<deck-id>/knowledge-map.md。先頭の設定に deck_id と goal（持ち帰りの1文に当たる概念の ID）、本文に表
//   | ID | 概念 | 1文の定義 | 前提 | 優先度 | 抽象度 |（前提は K-001 の並び。なければ「-」。優先度は Must・Should・Could、抽象度は具体・抽象）
// - エラー：表の書式、ID の重複、知らない前提、定義がない、優先度・抽象度の値、循環、格上げ漏れ（Must の前提が Must でない）、goal がない・Must でない
// - 注意：goal につながらない Must（Must＝ゴールへの道の上にある概念のため）
// - 「構成の進め方」が「相談して決めたい」「たたき台がある」なのに知識マップがなければエラー。「決まっている」ならなくてよい
// - 出力：Must の概念の層（層0＝Must の前提がない概念）と、同じ層の中の並べ方の候補
//   （1. 次の層でより多くの概念の前提になるもの → 2. 具体 → 抽象。ストーリー上の都合（直前の問いに答えるもの）は AI と人が決める）
// - 終了コード：0＝エラーなし、2＝エラーあり
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { checkBrief } from "../../slide-hearing/scripts/check-brief.mjs";
import { frontMatter, isMain } from "../../../lib/common.mjs";

export const KNOWLEDGE = "knowledge-map.md";
export const KID = /^K-\d{3,}$/;
export const PRIORITY = ["Must", "Should", "Could"];
export const ABSTRACTION = ["具体", "抽象"];
const COLUMNS = ["ID", "概念", "1文の定義", "前提", "優先度", "抽象度"];
// 知識マップが必要な構成の進め方（「決まっている」では人の並びを変えないので作らない）
export const NEEDS_MAP = ["たたき台がある", "相談して決めたい"];

// 表を読む。戻り値：{ meta, nodes: [{ id, name, def, pre: [], priority, abstraction, line }], errors }
export function parseKnowledge(text) {
  const errors = [];
  const m = frontMatter(text);
  let meta = {};
  if (!m) errors.push("先頭に --- で囲んだ設定（deck_id・goal）がない");
  else
    try {
      meta = YAML.parse(m[1]) ?? {};
    } catch (e) {
      errors.push(`先頭の設定が YAML として読めない：${e.message.split("\n")[0]}`);
    }
  const offset = m ? m[0].split("\n").length - 1 : 0;
  const lines = (m ? text.slice(m[0].length) : text).split("\n");
  const cells = (l) =>
    l
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const head = lines.findIndex((l) => l.trim().startsWith("|") && cells(l)[0] === "ID");
  const nodes = [];
  if (head < 0) return { meta, nodes, errors: [...errors, `表がない（見出しの行：| ${COLUMNS.join(" | ")} |）`] };
  if (cells(lines[head]).join("|") !== COLUMNS.join("|")) errors.push(`表の見出しは | ${COLUMNS.join(" | ")} | にする`);
  for (let i = head + 2; i < lines.length && lines[i].trim().startsWith("|"); i++) {
    const [id, name, def, pre, priority, abstraction] = cells(lines[i]);
    nodes.push({
      id,
      name,
      def,
      pre: !pre || pre === "-" || pre === "なし" ? [] : pre.split(/[、,\s]+/).filter(Boolean),
      priority,
      abstraction,
      line: offset + i + 1,
    });
  }
  return { meta, nodes, errors };
}

// 循環を1つ探す（見つからなければ null）。戻り値は ID の並び（最初と最後が同じ）
function findCycle(nodes) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 1);
    stack.push(id);
    for (const p of by.get(id)?.pre ?? []) {
      if (!by.has(p)) continue;
      if (state.get(p) === 1) return [...stack.slice(stack.indexOf(p)), p];
      if (!state.get(p)) {
        const c = visit(p);
        if (c) return c;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const n of nodes)
    if (!state.get(n.id)) {
      const c = visit(n.id);
      if (c) return c;
    }
  return null;
}

// Must の概念の層と、同じ層の中の並べ方の候補
export function layers(nodes) {
  const must = nodes.filter((n) => n.priority === "Must");
  const ids = new Set(must.map((n) => n.id));
  const layer = new Map();
  const depth = (n, seen = new Set()) => {
    if (layer.has(n.id)) return layer.get(n.id);
    if (seen.has(n.id)) return 0; // 循環（エラーは別に出す）
    seen.add(n.id);
    const ps = n.pre
      .filter((p) => ids.has(p))
      .map((p) =>
        depth(
          must.find((x) => x.id === p),
          seen,
        ),
      );
    const d = ps.length ? Math.max(...ps) + 1 : 0;
    layer.set(n.id, d);
    return d;
  };
  must.forEach((n) => depth(n));
  const out = [];
  for (const n of must) (out[layer.get(n.id)] ??= []).push(n);
  return out.map((list, d) => {
    const next = out[d + 1] ?? [];
    const uses = (n) => next.filter((x) => x.pre.includes(n.id)).length;
    return list
      .map((n) => ({ ...n, layer: d, uses: uses(n) }))
      .sort((a, b) => b.uses - a.uses || ABSTRACTION.indexOf(a.abstraction) - ABSTRACTION.indexOf(b.abstraction));
  });
}

export function checkKnowledge(deckDir) {
  const errors = [],
    warnings = [];
  const file = path.join(deckDir, KNOWLEDGE);
  const brief = path.join(deckDir, "brief.md");
  const plan = fs.existsSync(brief) ? (checkBrief(fs.readFileSync(brief, "utf8")).sections["構成の進め方"] ?? "") : "";
  const mode = NEEDS_MAP.find((p) => plan.replace(/^[-*]\s*/, "").startsWith(p));
  if (!fs.existsSync(file)) {
    if (mode) errors.push(`構成の進め方が「${mode}」なので、${KNOWLEDGE} を作る（structure-framework.md 2章）`);
    return { errors, warnings, layers: [], exists: false };
  }
  const k = parseKnowledge(fs.readFileSync(file, "utf8"));
  errors.push(...k.errors);
  const at = (n) => `${n.id || "（ID なし）"}（${KNOWLEDGE}:${n.line}）`;
  const by = new Map();
  for (const n of k.nodes) {
    if (!KID.test(n.id)) errors.push(`${at(n)}：ID は K-001 の形にする`);
    else if (by.has(n.id)) errors.push(`${at(n)}：ID が重複している`);
    else by.set(n.id, n);
    if (!n.name) errors.push(`${at(n)}：概念がない`);
    if (!n.def) errors.push(`${at(n)}：1文の定義がない（書けないなら粒度が粗すぎる。分ける）`);
    if (!PRIORITY.includes(n.priority)) errors.push(`${at(n)}：優先度は ${PRIORITY.join("・")}`);
    if (!ABSTRACTION.includes(n.abstraction)) errors.push(`${at(n)}：抽象度は ${ABSTRACTION.join("・")}`);
  }
  for (const n of k.nodes)
    for (const p of n.pre) {
      if (!by.has(p)) errors.push(`${at(n)}：前提の ${p} が表にない`);
      else if (n.priority === "Must" && by.get(p).priority !== "Must")
        errors.push(`${at(n)}：Must の前提の ${p} が ${by.get(p).priority}。Must に格上げする（前提が欠けると前方参照になる）`);
    }
  const cycle = findCycle(k.nodes);
  if (cycle) errors.push(`前提が循環している：${cycle.join(" → ")}（どちらかの定義があいまい。概念を分けるか、片方を簡単な形で先に出す）`);
  const goal = k.meta.goal;
  if (!goal) errors.push("先頭の設定に goal（持ち帰りの1文に当たる概念の ID）がない");
  else if (!by.has(goal)) errors.push(`goal の ${goal} が表にない`);
  else if (by.get(goal).priority !== "Must") errors.push(`goal の ${goal} は Must にする`);
  // goal につながらない Must
  if (by.has(goal) && !cycle) {
    const reach = new Set();
    const walk = (id) => {
      if (reach.has(id)) return;
      reach.add(id);
      for (const p of by.get(id)?.pre ?? []) walk(p);
    };
    walk(goal);
    for (const n of k.nodes)
      if (n.priority === "Must" && !reach.has(n.id)) warnings.push(`${at(n)}：Must なのに goal（${goal}）につながらない。Should にするか、前提の関係を足す`);
  }
  return { errors, warnings, layers: cycle ? [] : layers(k.nodes), exists: true, goal };
}

if (isMain(import.meta.url)) {
  const deckDir = process.argv[2];
  if (!deckDir) {
    console.error("使い方：node check-knowledge.mjs decks/<deck-id>");
    process.exit(2);
  }
  const r = checkKnowledge(deckDir);
  if (r.exists && r.layers.length) {
    console.log("説明の順序の候補（Must の概念。層の小さい順。同じ層の中は、次の層で前提になる数が多い順 → 具体 → 抽象）\n");
    console.log("| 層 | ID | 概念 | 抽象度 | 次の層で前提になる数 |");
    console.log("|---|---|---|---|---|");
    for (const l of r.layers) for (const n of l) console.log(`| ${n.layer} | ${n.id} | ${n.name} | ${n.abstraction} | ${n.uses} |`);
    console.log("");
  }
  for (const w of r.warnings) console.log(`注意：${w}`);
  for (const e of r.errors) console.error(`エラー：${e}`);
  if (!r.exists && !r.errors.length) console.log(`${KNOWLEDGE} はない（構成の進め方が「決まっている」なら要らない）`);
  process.exit(r.errors.length ? 2 : 0);
}
