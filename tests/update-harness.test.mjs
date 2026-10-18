// ハーネスの更新を取り込むスクリプト（scripts/update-harness.mjs）。GitHub の代わりに手元の bare リポジトリで確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { createSlideRepo } from "../scripts/create-slide-repo.mjs";
import { BRANCH, updateHarness } from "../scripts/update-harness.mjs";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
// コミットの名前と署名は手元の git の設定によらないようにする（CI には名前の設定がない）
Object.assign(process.env, {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "commit.gpgsign",
  GIT_CONFIG_VALUE_0: "false",
});
const quiet = { useGh: false, log: () => {} };

// ハーネス（作業用の clone と bare）と、create-slide-repo で作ったスライド用リポジトリ
function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "update-harness-"));
  const work = path.join(tmp, "harness");
  fs.mkdirSync(path.join(work, "decks"), { recursive: true });
  fs.writeFileSync(path.join(work, "decks/.gitignore"), "*\n!.gitignore\n");
  fs.writeFileSync(path.join(work, "CLAUDE.md"), "v1\n");
  git(work, "init", "--quiet", "-b", "main");
  git(work, "add", ".");
  git(work, "commit", "--quiet", "-m", "init");
  git(work, "branch", "develop");
  const harness = path.join(tmp, "harness.git");
  git(tmp, "clone", "--quiet", "--bare", work, harness);
  git(work, "remote", "add", "bare", harness);
  const slides = path.join(tmp, "slides.git");
  git(tmp, "init", "--quiet", "--bare", slides);
  const dir = path.join(tmp, "my-slides");
  createSlideRepo({ slideRepo: slides, slideUrl: slides, harnessUrl: harness, dir }, quiet);
  // ハーネスの main を進める
  const release = (text) => {
    fs.writeFileSync(path.join(work, "CLAUDE.md"), text);
    git(work, "commit", "--quiet", "-am", "update");
    git(work, "push", "--quiet", "bare", "main");
  };
  return { work, slides, dir, release };
}

test("develop から作業用のブランチを作り、ハーネスの main をマージコミットで取り込んで push する", () => {
  const f = fixture();
  f.release("v2\n");
  assert.equal(updateHarness({ cwd: f.dir }, quiet).updated, true);
  assert.match(git(f.dir, "ls-remote", "--heads", "origin"), new RegExp(`refs/heads/${BRANCH}`));
  assert.equal(git(f.dir, "log", "-1", "--format=%P", `origin/${BRANCH}`).split(" ").length, 2);
  assert.equal(fs.readFileSync(path.join(f.dir, "CLAUDE.md"), "utf8"), "v2\n");
});

test("取り込む更新がなければ何もしない", () => {
  const f = fixture();
  assert.equal(updateHarness({ cwd: f.dir }, quiet).updated, false);
  assert.doesNotMatch(git(f.dir, "ls-remote", "--heads", "origin"), /harness-update/);
});

test("衝突したら止め、ハーネスのリポジトリやコミットしていない変更があるときは始めない", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.dir, "CLAUDE.md"), "local\n");
  assert.throws(() => updateHarness({ cwd: f.dir }, quiet), /コミットしていない変更/);
  git(f.dir, "commit", "--quiet", "-am", "local");
  git(f.dir, "push", "--quiet", "origin", "develop");
  f.release("v2\n");
  assert.throws(() => updateHarness({ cwd: f.dir }, quiet), /衝突した[\s\S]*CLAUDE\.md/);
  assert.throws(() => updateHarness({ cwd: f.work }, quiet), /ハーネスのリポジトリ/);
});
