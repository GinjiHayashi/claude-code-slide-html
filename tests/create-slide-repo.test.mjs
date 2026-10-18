// スライド用リポジトリを作るスクリプト（scripts/create-slide-repo.mjs）。GitHub の代わりに手元の bare リポジトリで確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { createSlideRepo, readConfig, toUrl } from "../scripts/create-slide-repo.mjs";

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

// ハーネスの代わり：main・develop・feature/x を持ち、decks/.gitignore がある bare リポジトリ
function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "create-slide-repo-"));
  const work = path.join(tmp, "work");
  fs.mkdirSync(path.join(work, "decks"), { recursive: true });
  fs.writeFileSync(path.join(work, "decks/.gitignore"), "*\n!.gitignore\n");
  git(work, "init", "--quiet", "-b", "main");
  git(work, "add", ".");
  git(work, "commit", "--quiet", "-m", "init");
  git(work, "branch", "develop");
  git(work, "branch", "feature/x");
  const harness = path.join(tmp, "harness.git");
  git(tmp, "clone", "--quiet", "--bare", work, harness);
  const slides = path.join(tmp, "slides.git");
  git(tmp, "init", "--quiet", "--bare", slides);
  return { tmp, harness, slides, dir: path.join(tmp, "my-slides") };
}

test("readConfig：owner/name を URL に直し、clone 先の既定は隣のフォルダ", () => {
  const c = readConfig({ SLIDE_REPO: "me/my-slides" });
  assert.equal(c.slideUrl, "https://github.com/me/my-slides.git");
  assert.equal(c.harnessUrl, "https://github.com/GinjiHayashi/claude-code-slide-html.git");
  assert.equal(path.basename(c.dir), "my-slides");
  assert.throws(() => readConfig({}), /SLIDE_REPO/);
  assert.throws(() => readConfig({ SLIDE_REPO: "your-name/my-slides" }), /SLIDE_REPO/);
  assert.equal(toUrl("/tmp/a.git"), "/tmp/a.git");
  assert.equal(toUrl("git@github.com:me/my-slides.git"), "git@github.com:me/my-slides.git");
  assert.equal(readConfig({ SLIDE_REPO: "me/my-slides", SLIDE_REPO_DIR: "~/work/s" }).dir, path.join(os.homedir(), "work/s"));
});

test("main と develop だけを送り、decks/ を管理対象にして、remote harness を足す", () => {
  const f = fixture();
  createSlideRepo({ slideRepo: f.slides, slideUrl: f.slides, harnessUrl: f.harness, dir: f.dir }, { useGh: false, log: () => {} });
  const heads = git(f.tmp, "ls-remote", "--heads", f.slides);
  assert.match(heads, /refs\/heads\/main/);
  assert.match(heads, /refs\/heads\/develop/);
  assert.doesNotMatch(heads, /feature/);
  assert.equal(fs.existsSync(path.join(f.dir, "decks/.gitignore")), false);
  assert.equal(git(f.dir, "ls-tree", "--name-only", "origin/develop", "decks/"), "");
  assert.equal(git(f.dir, "log", "-1", "--format=%s", "origin/develop"), "chore: decks/ を git で管理する（スライド用リポジトリ）");
  assert.equal(git(f.dir, "remote", "get-url", "harness"), f.harness);
});

test("中身のあるリポジトリと、すでにある clone 先には何もしない", () => {
  const f = fixture();
  const c = { slideRepo: f.harness, slideUrl: f.harness, harnessUrl: f.harness, dir: f.dir };
  assert.throws(() => createSlideRepo(c, { useGh: false, log: () => {} }), /空ではない/);
  fs.mkdirSync(f.dir);
  assert.throws(() => createSlideRepo({ ...c, slideUrl: f.slides }, { useGh: false, log: () => {} }), /すでにある/);
});

test("--dry-run では何も書かない", () => {
  const f = fixture();
  const lines = [];
  createSlideRepo({ slideRepo: f.slides, slideUrl: f.slides, harnessUrl: f.harness, dir: f.dir }, { dryRun: true, useGh: false, log: (l) => lines.push(l) });
  assert.equal(git(f.tmp, "ls-remote", f.slides), "");
  assert.equal(fs.existsSync(f.dir), false);
  assert.ok(lines.some((l) => l.startsWith("[dry-run]")));
});
