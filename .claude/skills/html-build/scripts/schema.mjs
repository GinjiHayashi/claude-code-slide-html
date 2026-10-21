#!/usr/bin/env node
// スライドの型と図の型に書ける項目を出す。正はコード（スライドの型は spec.mjs、図は各部品の schema）で、文書には書き写さない
// 使い方：node .claude/skills/html-build/scripts/schema.mjs [型の名前]（省くと全部。layout の名前でも、図の kind でもよい）
// 図：「?」の付いた項目は任意。[ ] は並び、{ } はまとまり。値の意味と既定は、各部品の冒頭のコメントにある
// 図の「数」：並びの数の決まり（各部品の limits。「〜まで」は最小なし）。超えるとエラー
// スライドの型：（ ）の字数は全角の目安。超えると注意になり、最後はビルド後の検査で実際の行数を測る
import path from "path";
import { fileURLToPath } from "url";
import { KINDS, LAYOUTS, LEAD, BOLD, LEAD_BOLD, SUB_ITEMS, describeLayout } from "./spec.mjs";
import { LEAD_LIMIT } from "./outline.mjs";
import { describe, describeLimits } from "../components/_util.mjs";
import { isMain } from "../../../lib/common.mjs";

const COMP = path.join(path.dirname(fileURLToPath(import.meta.url)), "../components");

export async function schemaOf(kind) {
  return (await import(path.join(COMP, `${kind}.mjs`))).schema;
}
// 数の決まり（各部品の limits）。ない部品は null
export async function limitsOf(kind) {
  return (await import(path.join(COMP, `${kind}.mjs`))).limits ?? null;
}

if (isMain(import.meta.url)) {
  const name = process.argv[2];
  if (name && !LAYOUTS[name] && !KINDS.includes(name)) {
    console.error(`「${name}」はスライドの型（${Object.keys(LAYOUTS).join("・")}）にも図の型（${KINDS.join("・")}）にもない`);
    process.exit(2);
  }
  const layouts = name ? (LAYOUTS[name] ? [name] : []) : Object.keys(LAYOUTS);
  const kinds = name ? (KINDS.includes(name) ? [name] : []) : KINDS;
  if (!name) {
    console.log("# どの型にも共通");
    console.log(
      `字数：全角を1、半角を0.5と数える｜lead：全角${LEAD.target[0]}〜${LEAD.target[1]}字が目安で、${LEAD.short}字未満は注意（表や大きな図で短くするなら lead_short: <理由>）。${LEAD.lines}行まで（全角${LEAD_LIMIT}字を超えるとエラー）｜太字：1項目に${BOLD.perItem}か所、1枚に${BOLD.perSlide}か所まで（lead は数えない）｜lead の強調（青の太字）：${LEAD_BOLD.max}か所まで（目安${LEAD_BOLD.good}か所、0でもよい）、1か所は全角${LEAD_BOLD.chars}字まで、合計は lead の${Math.round(LEAD_BOLD.ratio * 100)}%まで｜下の階層：1項目に${SUB_ITEMS}つまで`,
    );
    console.log("");
    console.log("# スライドの型（layout）");
  }
  for (const l of layouts) console.log(`${l}: ${describeLayout(l)}`);
  if (layouts.length && kinds.length) console.log("");
  if (kinds.length && !name) console.log("# 図の型（diagram の kind）");
  for (const k of kinds) {
    const lim = await limitsOf(k);
    console.log(`${k}: { ${describe(await schemaOf(k))} }${lim ? `｜数：${describeLimits(lim)}` : ""}`);
  }
  // 自由図は形ごとに書ける項目が違うので、形ごとにも出す（正は canvas.mjs の FIELDS）
  if (name === "canvas") {
    const { FIELDS } = await import(path.join(COMP, "canvas.mjs"));
    console.log("\n# canvas の形（type）ごとの項目");
    for (const [t, F] of Object.entries(FIELDS)) console.log(`${t}: ${[...F.req, ...F.opt.map((o) => `${o}?`)].join(", ")}`);
  }
}
