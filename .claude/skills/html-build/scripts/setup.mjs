#!/usr/bin/env node
// セットアップ：ビルドに要るものをまとめて入れる。リポジトリの直下で `npm run setup`（CI では `npm run setup -- --with-deps`）
// 1. npm のパッケージ（版は package-lock.json で固定）
// 2. 検査と PDF に使う Chromium（Playwright）。--with-deps なら OS のライブラリも入れる
// 3. フォントのサブセット化に使う Python とパッケージ。uv が .venv に入れる（版は pyproject.toml と uv.lock で固定。Python がなければ uv が入れる）
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });

run("npm", ["ci"]);
run(process.execPath, [
  path.join(ROOT, "node_modules/playwright/cli.js"),
  "install",
  ...(process.argv.includes("--with-deps") ? ["--with-deps"] : []),
  "chromium",
]);
try {
  execFileSync("uv", ["--version"], { stdio: "ignore" });
} catch {
  console.error("uv が見つからない。README「0. 必要なツールを入れる」の手順で入れてから、もう一度 npm run setup を実行する");
  process.exit(1);
}
run("uv", ["sync", "--locked"]);
console.log("セットアップが済んだ。確かめるには：npm run build -- examples/sample-deck");
