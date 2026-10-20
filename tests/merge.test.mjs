// PR のマージの承認（request.mjs --merge → approve-hook → merge.mjs）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { SKILLS, tempDeck, rootOf, fakeGh } from "./helpers.mjs";

const SCRIPTS = path.join(SKILLS, "make-slides/scripts");
const { mergePr, nextTag } = await import(path.join(SCRIPTS, "merge.mjs"));
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

// デッキのあるリポジトリ（origin は一時の bare リポジトリ）と、テスト用の gh
function setup(pr) {
  const dir = tempDeck();
  const root = rootOf(dir);
  const origin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "origin-")), "origin.git");
  execFileSync("git", ["init", "-q", "--bare", origin]);
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "tester");
  git(root, "config", "user.email", "tester@example.com");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  git(root, "remote", "add", "origin", origin);
  git(root, "push", "-q", "origin", "main");
  const g = fakeGh(pr);
  Object.assign(process.env, g.env);
  return { dir, root, origin, ...g };
}
const request = (dir) => execFileSync(process.execPath, [path.join(SCRIPTS, "request.mjs"), dir, "--merge", "7"], { encoding: "utf8" });
const answer = (root, prompt) =>
  execFileSync(process.execPath, [path.join(SCRIPTS, "approve-hook.mjs")], {
    input: JSON.stringify({ prompt }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
const merged = (state) => JSON.parse(fs.readFileSync(state, "utf8")).merged_with ?? null;
const quiet = () => {};

test("merge.mjs：承認がなければマージしない", () => {
  const { dir, state } = setup();
  const r = mergePr(dir, 7, quiet);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /マージの承認がない/);
  assert.equal(merged(state), null);
});

test("merge.mjs：承認のあとに PR へ push されたら止める", () => {
  const { dir, root, state } = setup();
  request(dir);
  answer(root, "承認");
  const st = JSON.parse(fs.readFileSync(state, "utf8"));
  fs.writeFileSync(state, JSON.stringify({ ...st, headRefOid: "b".repeat(40) }));
  const r = mergePr(dir, 7, quiet);
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /承認のあとに PR #7 へ push された/);
  assert.equal(merged(state), null);
});

test("merge.mjs：承認でない答えでは記録されず、マージしない", () => {
  const { dir, root, state } = setup();
  request(dir);
  answer(root, "承認もします。README も直して");
  assert.equal(mergePr(dir, 7, quiet).ok, false);
  assert.equal(merged(state), null);
});

test("merge.mjs：develop へは承認した head で squash マージする（タグは付けない）", () => {
  const { dir, root, state, origin } = setup();
  request(dir);
  answer(root, "承認");
  const r = mergePr(dir, 7, quiet);
  assert.equal(r.ok, true);
  assert.deepEqual(merged(state), ["7", "--squash", "--match-head-commit", "a".repeat(40)]);
  assert.equal(r.tag, null);
  assert.equal(git(origin, "tag", "--list"), "");
});

test("merge.mjs：ハーネスの更新の取り込み（feature/harness-update）は develop へもマージコミット", () => {
  const { dir, root, state } = setup({ headRefName: "feature/harness-update" });
  request(dir);
  answer(root, "承認");
  assert.equal(mergePr(dir, 7, quiet).ok, true);
  assert.equal(merged(state)[1], "--merge");
});

test("merge.mjs：main へはマージコミットでマージし、main の最新のコミットにタグを付けて push する", () => {
  const { dir, root, state, origin } = setup({ baseRefName: "main", headRefName: "develop" });
  request(dir);
  answer(root, "承認");
  const r = mergePr(dir, 7, quiet);
  assert.equal(r.ok, true);
  assert.equal(merged(state)[1], "--merge");
  const id = path.basename(dir);
  assert.equal(r.tag, id);
  assert.equal(git(origin, "rev-parse", `refs/tags/${id}`), git(origin, "rev-parse", "main"));
});

test("nextTag：<deck-id> があれば -2、-3 …", () => {
  assert.equal(nextTag("2026-10-17-x", []), "2026-10-17-x");
  assert.equal(nextTag("2026-10-17-x", ["2026-10-17-x"]), "2026-10-17-x-2");
  assert.equal(nextTag("2026-10-17-x", ["2026-10-17-x", "2026-10-17-x-2"]), "2026-10-17-x-3");
});
