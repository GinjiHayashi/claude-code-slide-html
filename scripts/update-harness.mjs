#!/usr/bin/env node
// ハーネスの更新を取り込む（README「ハーネスの更新を取り込む」）。スライド用リポジトリの直下で `npm run update-harness`
// 1. remote harness がなければ足す（.env の HARNESS_REPO。空なら GinjiHayashi/claude-code-slide-html）
// 2. develop から feature/harness-update を作り、harness/main を merge する。衝突したら止め、直し方を表示する
// 3. push して、develop への PR を作る（gh にログインしているとき。なければ作り方を表示する）
// マージは人間が、squash ではなくマージコミットで行う
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { DEFAULT_HARNESS, toUrl } from "./create-slide-repo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BRANCH = "feature/harness-update";
const TITLE = "chore: ハーネスの更新を取り込む";

const sh = (cwd, cmd, args) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ok = (cwd, cmd, args) => {
  try {
    sh(cwd, cmd, args);
    return true;
  } catch {
    return false;
  }
};

export function updateHarness({ cwd = ROOT, harnessUrl = toUrl(DEFAULT_HARNESS) } = {}, { useGh, log = console.log } = {}) {
  const git = (...args) => sh(cwd, "git", args);
  if (ok(cwd, "git", ["ls-files", "--error-unmatch", "decks/.gitignore"]))
    throw new Error("ここはハーネスのリポジトリ（decks/.gitignore がある）。スライド用リポジトリで実行する");
  // 作業記録（decks/*/worklog.jsonl）は hook がターンごとに足すので、変更があっても止めない
  if (git("status", "--porcelain", "--untracked-files=no", "--", ".", ":(exclude)decks/*/worklog.jsonl"))
    throw new Error("コミットしていない変更がある。コミットするか戻してから実行する");

  // 1. remote harness
  if (!git("remote").split("\n").includes("harness")) {
    log(`remote harness（${harnessUrl}）を足す`);
    git("remote", "add", "harness", harnessUrl);
  }
  git("fetch", "--quiet", "harness", "main");
  git("fetch", "--quiet", "origin", "develop");

  // 2. develop から作業用のブランチを作り、harness/main を merge する
  if (ok(cwd, "git", ["merge-base", "--is-ancestor", "harness/main", "origin/develop"])) {
    log("取り込む更新はない（develop はハーネスの main を含んでいる）");
    return { updated: false };
  }
  if (ok(cwd, "git", ["rev-parse", "--verify", "--quiet", BRANCH]) || git("ls-remote", "--heads", "origin", BRANCH))
    throw new Error(`${BRANCH} がすでにある。前回の取り込みの PR をマージしてブランチを消すか、続きをそのブランチで行う`);
  git("switch", "--quiet", "--no-track", "-c", BRANCH, "origin/develop");
  try {
    git("merge", "--quiet", "--no-ff", "-m", TITLE, "harness/main");
  } catch {
    const files = git("diff", "--name-only", "--diff-filter=U");
    throw new Error(
      [
        `衝突したので止めた（ブランチ ${BRANCH} で merge の途中）。衝突したファイル：`,
        files,
        "ハーネスのファイルは、ハーネスの側に合わせて直す（README「ハーネスの更新を取り込む」）。直したら：",
        `  git add <ファイル> && git commit --no-edit && git push -u origin ${BRANCH}`,
        "やめるときは：git merge --abort && git switch develop && git branch -D " + BRANCH,
      ].join("\n"),
    );
  }
  const lockChanged = !ok(cwd, "git", ["diff", "--quiet", "origin/develop", "HEAD", "--", "package-lock.json"]);

  // 3. push と PR
  log(`${BRANCH} を push する`);
  git("push", "--quiet", "-u", "origin", BRANCH);
  const gh = useGh ?? ok(cwd, "gh", ["auth", "status"]);
  const body = "ハーネスの main を取り込む。**squash ではなくマージコミットでマージする**（squash にすると、次の取り込みで衝突する）。";
  if (gh) log(`PR を作った：${sh(cwd, "gh", ["pr", "create", "--base", "develop", "--head", BRANCH, "--title", TITLE, "--body", body])}`);
  else log(`GitHub で ${BRANCH} から develop への PR を作る（マージコミットでマージする。squash にしない）`);

  log("マージの前に確かめる：npm run build -- examples/sample-deck" + (lockChanged ? "（package-lock.json が変わったので、先に npm run setup）" : ""));
  return { updated: true, lockChanged };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  try {
    updateHarness({ harnessUrl: toUrl((process.env.HARNESS_REPO ?? "").trim() || DEFAULT_HARNESS) });
  } catch (e) {
    console.error(`止めた：${e.stderr?.trim() || e.message}`);
    process.exit(1);
  }
}
