// 知識マップのテスト：check-knowledge.mjs（書式、循環、格上げ漏れ、goal、層と並べ方、構成の進め方による要否）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { SKILLS, tempDeck } from "./helpers.mjs";

const { checkKnowledge, layers, parseKnowledge, KNOWLEDGE } = await import(path.join(SKILLS, "slide-outline/scripts/check-knowledge.mjs"));

const HEAD = "| ID | 概念 | 1文の定義 | 前提 | 優先度 | 抽象度 |\n|---|---|---|---|---|---|\n";
const map = (goal, rows) => `---\ndeck_id: x\ngoal: ${goal}\n---\n\n${HEAD}${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;
function deck(text, plan = "たたき台がある（outline.md）") {
  const dir = tempDeck("2026-10-17-report-automation", ["brief.md"]);
  const brief = path.join(dir, "brief.md");
  fs.writeFileSync(brief, fs.readFileSync(brief, "utf8").replace("たたき台がある（outline.md）", plan));
  if (text !== null) fs.writeFileSync(path.join(dir, KNOWLEDGE), text);
  return dir;
}

test("check-knowledge：見本の知識マップはエラー0件で、層が goal まで続く", () => {
  const r = checkKnowledge(deck(fs.readFileSync(path.join(SKILLS, "../../examples/sample-deck", KNOWLEDGE), "utf8")));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.layers.at(-1)[0].id, r.goal);
});

test("check-knowledge：構成の進め方が相談・たたき台なら知識マップが要る。決まっているなら要らない", () => {
  assert.match(checkKnowledge(deck(null)).errors.join("\n"), /knowledge-map\.md を作る/);
  assert.match(checkKnowledge(deck(null, "相談して決めたい")).errors.join("\n"), /相談して決めたい/);
  assert.deepEqual(checkKnowledge(deck(null, "決まっている（outline-draft.md）")).errors, []);
});

test("check-knowledge：循環、知らない前提、格上げ漏れ、値の誤り、ID の重複はエラー", () => {
  const r = checkKnowledge(
    deck(
      map("K-003", [
        ["K-001", "A", "a", "K-002", "Must", "具体"],
        ["K-002", "B", "b", "K-001", "Must", "具体"],
        ["K-003", "C", "c", "K-001、K-009、K-004", "Must", "抽象"],
        ["K-004", "D", "d", "-", "Should", "具体"],
        ["K-004", "E", "", "-", "必須", "中"],
      ]),
    ),
  );
  const e = r.errors.join("\n");
  assert.match(e, /循環している：K-001 → K-002 → K-001/);
  assert.match(e, /K-009 が表にない/);
  assert.match(e, /Must の前提の K-004 が Should/);
  assert.match(e, /ID が重複/);
  assert.match(e, /1文の定義がない/);
  assert.match(e, /優先度は Must・Should・Could/);
  assert.match(e, /抽象度は 具体・抽象/);
  assert.deepEqual(r.layers, []); // 循環があれば層を出さない
});

test("check-knowledge：goal がない・Must でないとエラー、goal につながらない Must は注意", () => {
  const rows = [
    ["K-001", "A", "a", "-", "Must", "具体"],
    ["K-002", "B", "b", "-", "Should", "具体"],
  ];
  assert.match(checkKnowledge(deck(map("K-009", rows))).errors.join("\n"), /goal の K-009 が表にない/);
  assert.match(checkKnowledge(deck(map("K-002", rows))).errors.join("\n"), /goal の K-002 は Must/);
  const r = checkKnowledge(deck(map("K-001", [...rows, ["K-003", "C", "c", "-", "Must", "抽象"]])));
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join("\n"), /K-003.*goal（K-001）につながらない/);
});

test("layers：Must だけで層を作り、同じ層は次の層で前提になる数が多い順 → 具体 → 抽象", () => {
  const { nodes, errors } = parseKnowledge(
    map("K-006", [
      ["K-001", "抽象で1回", "a", "-", "Must", "抽象"],
      ["K-002", "具体で1回", "b", "-", "Must", "具体"],
      ["K-003", "抽象で2回", "c", "-", "Must", "抽象"],
      ["K-004", "x", "d", "K-001、K-003", "Must", "具体"],
      ["K-005", "y", "e", "K-002、K-003", "Must", "具体"],
      ["K-006", "goal", "f", "K-004、K-005", "Must", "抽象"],
      ["K-007", "Could", "g", "-", "Could", "具体"],
    ]),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    layers(nodes).map((l) => l.map((n) => n.id)),
    [["K-003", "K-002", "K-001"], ["K-004", "K-005"], ["K-006"]],
  );
});
