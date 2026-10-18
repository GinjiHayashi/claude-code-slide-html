#!/usr/bin/env node
// 図の部品に書ける項目を出す。項目の正は各部品の schema（components/<kind>.mjs）で、文書には書き写さない
// 使い方：node .claude/skills/html-build/scripts/schema.mjs [kind]（kind を省くと全部）
// 「?」の付いた項目は任意。[ ] は並び、{ } はまとまり。値の意味と既定は、各部品の冒頭のコメントにある
import path from "path";
import { fileURLToPath } from "url";
import { KINDS } from "./check-outline.mjs";
import { describe } from "../components/_util.mjs";
import { isMain } from "../../../lib/common.mjs";

const COMP = path.join(path.dirname(fileURLToPath(import.meta.url)), "../components");

export async function schemaOf(kind) {
  return (await import(path.join(COMP, `${kind}.mjs`))).schema;
}

if (isMain(import.meta.url)) {
  const kinds = process.argv[2] ? [process.argv[2]] : KINDS;
  for (const k of kinds) {
    if (!KINDS.includes(k)) { console.error(`図の型「${k}」は一覧にない（${KINDS.join("・")}）`); process.exit(2); }
    console.log(`${k}: { ${describe(await schemaOf(k))} }`);
  }
}
