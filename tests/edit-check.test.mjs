// 図の変更の指示（change）のテスト：edit-check.mjs、check-outline の注意、request.mjs の止め方、承認の sha256
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { SKILLS, tempDeck } from "./helpers.mjs";

const SCRIPTS = path.join(SKILLS, "make-slides/scripts");
const { start, end, SNAPSHOT } = await import(path.join(SCRIPTS, "edit-check.mjs"));
const { slideDigests } = await import(path.join(SCRIPTS, "approvals.mjs"));
const { checkOutline } = await import(path.join(SKILLS, "html-build/scripts/check-outline.mjs"));

const IDEA = "- idea: 6つの部署の作成時間を長さで並べ、窓口サービスだけが飛び抜けて長いことを一目で見せる。合計の40時間は右上に大きく出す";
const CHANGE = "- change: 窓口サービスの棒の横に「全体の3割」と書き添える\n";
const read = (dir) => fs.readFileSync(path.join(dir, "outline.md"), "utf8");
const write = (dir, t) => fs.writeFileSync(path.join(dir, "outline.md"), t);
// S05 に change を書いたデッキ
function deck() {
  const dir = tempDeck();
  write(dir, read(dir).replace(IDEA + "\n", IDEA + "\n" + CHANGE));
  return dir;
}

test("edit-check：change のスライドの図と idea だけを直し、change を空にすれば合格。写しは消える", () => {
  const dir = deck();
  const s = start(dir);
  assert.deepEqual(s.errors, []);
  assert.deepEqual(
    s.changes.map((c) => c.slide),
    ["S05"],
  );
  assert.ok(fs.existsSync(path.join(dir, SNAPSHOT)));
  write(
    dir,
    read(dir)
      .replace(CHANGE, "- change:\n")
      .replace(IDEA, "- idea: 6つの部署の作成時間を長さで並べ、窓口サービスの棒に「全体の3割」と添える。合計の40時間は右上に大きく出す")
      .replace("{label: 窓口サービス, value: 12, highlight: true}", "{label: 窓口サービス（全体の3割）, value: 12, highlight: true}"),
  );
  const r = end(dir);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.ideas[0].slide, "S05");
  assert.match(r.ideas[0].after, /全体の3割/);
  assert.equal(fs.existsSync(path.join(dir, SNAPSHOT)), false);
});

test("edit-check：change のないスライド・図のほかの項目が変わった、change が残った、枚数が変わったらエラー。写しは残す", () => {
  const dir = deck();
  start(dir);
  write(
    dir,
    read(dir)
      .replace("- title: 作成時間の内訳", "- title: 作成時間の内訳（部署別）") // S05 の文
      .replace("- title: 今の作成手順", "- title: 今の作成の手順"), // S06（change なし）
  );
  const r = end(dir);
  assert.ok(r.errors.some((e) => e.startsWith("S05：図のほかの項目が変わった（title）")));
  assert.ok(r.errors.some((e) => e.startsWith("S05：change が空になっていない")));
  assert.ok(r.errors.some((e) => e.startsWith("S06：change のないスライドが変わった（title）")));
  assert.ok(r.warnings.some((w) => w.startsWith("S05：idea が前と同じ")));
  assert.ok(fs.existsSync(path.join(dir, SNAPSHOT)));

  write(dir, read(dir) + "\n## S99\n- layout: closing\n");
  assert.ok(end(dir).errors[0].startsWith("スライドの数か並びが変わった"));
  assert.deepEqual(start(tempDeck()).errors, ["change が書かれたスライドがない（直す指示がない）"]);
});

test("change：書式チェックは残っていると注意。承認の sha256 には入らない。残っている間は outline.md の承認を頼めない", async () => {
  const dir = deck();
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.startsWith("S05") && w.includes("change）が残っている")));

  const before = slideDigests(read(tempDeck()));
  const after = slideDigests(read(dir));
  assert.deepEqual(after, before);

  assert.throws(
    () => execFileSync(process.execPath, [path.join(SCRIPTS, "request.mjs"), dir, "outline.md"], { stdio: "pipe" }),
    (e) => /change）が残っている：S05/.test(e.stderr.toString()),
  );
  assert.equal(fs.existsSync(path.join(dir, "approval-request.yaml")), false);
});

test("idea：3行か全角120字を超えたら注意（足さずに書き換える）", async () => {
  const dir = tempDeck();
  write(
    dir,
    read(dir).replace(
      IDEA,
      IDEA +
        "。" +
        "さらに窓口サービスの棒の横に注記を足し、本部の棒は灰色にして、合計の位置も左上に動かし、凡例を下に置き、単位を時間から分に変えて目盛りも細かくする",
    ),
  );
  const r = await checkOutline(path.join(dir, "outline.md"));
  assert.ok(r.warnings.some((w) => w.startsWith("S05") && w.includes("idea が長い")));
});
