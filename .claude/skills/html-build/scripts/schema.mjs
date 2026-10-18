#!/usr/bin/env node
// スライドの型と図の型に書ける項目を出す。正はコード（スライドの型は spec.mjs、図は各部品の schema）で、文書には書き写さない
// 使い方：node .claude/skills/html-build/scripts/schema.mjs [型の名前]（省くと全部。layout の名前でも、図の kind でもよい）
// 図：「?」の付いた項目は任意。[ ] は並び、{ } はまとまり。値の意味と既定は、各部品の冒頭のコメントにある
// スライドの型：（ ）の字数は全角の目安。超えると注意になり、最後はビルド後の検査で実際の行数を測る
import path from "path";
import { fileURLToPath } from "url";
import { KINDS, LAYOUTS, describeLayout } from "./spec.mjs";
import { describe } from "../components/_util.mjs";
import { isMain } from "../../../lib/common.mjs";

const COMP = path.join(path.dirname(fileURLToPath(import.meta.url)), "../components");

export async function schemaOf(kind) {
  return (await import(path.join(COMP, `${kind}.mjs`))).schema;
}

if (isMain(import.meta.url)) {
  const name = process.argv[2];
  if (name && !LAYOUTS[name] && !KINDS.includes(name)) {
    console.error(`「${name}」はスライドの型（${Object.keys(LAYOUTS).join("・")}）にも図の型（${KINDS.join("・")}）にもない`);
    process.exit(2);
  }
  const layouts = name ? (LAYOUTS[name] ? [name] : []) : Object.keys(LAYOUTS);
  const kinds = name ? (KINDS.includes(name) ? [name] : []) : KINDS;
  if (!name) console.log("# スライドの型（layout）");
  for (const l of layouts) console.log(`${l}: ${describeLayout(l)}`);
  if (layouts.length && kinds.length) console.log("");
  if (kinds.length && !name) console.log("# 図の型（diagram の kind）");
  for (const k of kinds) console.log(`${k}: { ${describe(await schemaOf(k))} }`);
}
