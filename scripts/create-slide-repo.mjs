#!/usr/bin/env node
// スライド用リポジトリを作る（README「1. スライド用リポジトリを作る」）。ハーネスの直下で `npm run create-slide-repo`
// 設定は .env（.env.sample を写して書く）か環境変数。`-- --dry-run` なら、することを表示するだけ
// 1. private の空リポジトリを作る（gh にログインしているとき。なければ、空のリポジトリを先に作っておく）
// 2. ハーネスの main と develop を履歴ごと送る（--mirror にしないのは、feature/* まで送らないため）
// 3. 既定ブランチを develop にする（gh があるとき。なければ手順を表示する）
// 4. 手元に clone し、decks/.gitignore を消してコミット・push する
// 5. ハーネスの更新を取り込むための remote（harness）を足す
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_HARNESS = "GinjiHayashi/claude-code-slide-html";

// owner/name は GitHub の URL に直す。URL や手元のパス（テスト用）はそのまま使う
const isGitHubName = (v) => /^[\w.-]+\/[\w.-]+$/.test(v);
export const toUrl = (v) => (isGitHubName(v) ? `https://github.com/${v}.git` : v);

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
const ok = (cmd, args) => {
  try {
    sh(cmd, args);
    return true;
  } catch {
    return false;
  }
};

export function readConfig(env = process.env) {
  const slideRepo = (env.SLIDE_REPO ?? "").trim();
  if (!slideRepo || slideRepo === "your-name/my-slides") throw new Error("SLIDE_REPO が未設定（.env.sample を .env に写し、owner/リポジトリ名 を書く）");
  const harnessRepo = (env.HARNESS_REPO ?? "").trim() || DEFAULT_HARNESS;
  const name = path.basename(slideRepo).replace(/\.git$/, "");
  // ~/ はホームのフォルダに直す（.env では ~ が展開されないため）
  const dirSetting = (env.SLIDE_REPO_DIR ?? "").trim().replace(/^~(?=\/|$)/, os.homedir());
  const dir = path.resolve(ROOT, dirSetting || path.join("..", name));
  return { slideRepo, harnessRepo, slideUrl: toUrl(slideRepo), harnessUrl: toUrl(harnessRepo), dir };
}

export function createSlideRepo(config, { dryRun = false, useGh, log = console.log } = {}) {
  const { slideRepo, slideUrl, harnessUrl, dir } = config;
  const gh = useGh ?? (isGitHubName(slideRepo) && ok("gh", ["auth", "status"]));
  const step = (msg, fn) => {
    log(`${dryRun ? "[dry-run] " : ""}${msg}`);
    if (!dryRun) return fn();
  };

  if (fs.existsSync(dir)) throw new Error(`clone 先がすでにある：${dir}（SLIDE_REPO_DIR で別の場所を指定する）`);

  // 1. 空の private リポジトリを用意する。中身があるリポジトリには送らない（上書きを防ぐ）
  const exists = gh && ok("gh", ["repo", "view", slideRepo]);
  if (gh) {
    if (!exists) step(`private のリポジトリ ${slideRepo} を作る`, () => sh("gh", ["repo", "create", slideRepo, "--private"]));
    else if (sh("gh", ["repo", "view", slideRepo, "--json", "visibility", "--jq", ".visibility"]) !== "PRIVATE")
      throw new Error(`${slideRepo} が private ではない。スライドの中身が公開されるので止める`);
  }
  if (!gh || exists || !dryRun) {
    let refs;
    try {
      refs = sh("git", ["ls-remote", slideUrl]);
    } catch {
      throw new Error(`${slideUrl} に届かない。GitHub で private の空リポジトリを先に作るか、gh にログインする（gh auth login）`);
    }
    if (refs) throw new Error(`${slideUrl} が空ではない。上書きしないよう止める（README やライセンスを足さずに作り直す）`);
  }

  // 2. ハーネスの main と develop を履歴ごと送る
  step(`${harnessUrl} の main と develop を ${slideUrl} へ送る`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "slide-repo-"));
    try {
      sh("git", ["clone", "--bare", "--quiet", harnessUrl, tmp]);
      sh("git", ["push", "--quiet", slideUrl, "main", "develop"], { cwd: tmp });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // 3. 既定ブランチを develop にする
  if (gh) step("既定ブランチを develop にする", () => sh("gh", ["repo", "edit", slideRepo, "--default-branch", "develop"]));

  // 4. 手元に clone し、decks/ を git で管理する
  step(`${dir} に clone し、decks/.gitignore を消してコミット・push する`, () => {
    sh("git", ["clone", "--quiet", "--branch", "develop", slideUrl, dir]);
    sh("git", ["rm", "--quiet", "decks/.gitignore"], { cwd: dir });
    sh("git", ["commit", "--quiet", "-m", "chore: decks/ を git で管理する（スライド用リポジトリ）"], { cwd: dir });
    sh("git", ["push", "--quiet", "origin", "develop"], { cwd: dir });
  });

  // 5. ハーネスの更新を取り込むための remote
  step(`remote harness（${harnessUrl}）を足す`, () => sh("git", ["remote", "add", "harness", harnessUrl], { cwd: dir }));

  if (!gh) log(`残りの手順：GitHub の Settings → General → Default branch を develop にする`);
  log(`次は：cd ${dir} && npm run setup`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  try {
    createSlideRepo(readConfig(), { dryRun: process.argv.includes("--dry-run") });
  } catch (e) {
    console.error(`止めた：${e.stderr?.trim() || e.message}`);
    process.exit(1);
  }
}
