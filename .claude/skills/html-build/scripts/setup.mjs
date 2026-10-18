#!/usr/bin/env node
// セットアップ：ビルドに要るものをまとめて入れる。リポジトリの直下で `npm run setup`
// 1. npm のパッケージ（版は package-lock.json で固定）
// 2. 検査と PDF に使う Chromium（Playwright）。Linux では、Chromium が使う OS のライブラリ（libnss3 など）も apt で入れる。
//    Playwright が自分で sudo を呼ぶので、途中でパスワードを聞かれる。sudo が使えない環境では --no-deps で飛ばす
// 3. フォントのサブセット化に使う Python とパッケージ。uv が .venv に入れる（版は pyproject.toml と uv.lock で固定。Python がなければ uv が入れる）
// 4. Chromium が起動するかを確かめる（ライブラリが足りなければ、ここで止まる）
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
const PLAYWRIGHT = path.join(ROOT, "node_modules/playwright/cli.js");
const withDeps = process.platform === "linux" && !process.argv.includes("--no-deps");

run("npm", ["ci"]);
if (withDeps) console.log("Chromium が使う OS のライブラリを入れる。sudo のパスワードを聞かれたら入力する");
run(process.execPath, [PLAYWRIGHT, "install", ...(withDeps ? ["--with-deps"] : []), "chromium"]);
try {
  execFileSync("uv", ["--version"], { stdio: "ignore" });
} catch {
  console.error("uv が見つからない。README「0. 必要なツールを入れる」の手順で入れてから、もう一度 npm run setup を実行する");
  process.exit(1);
}
run("uv", ["sync", "--locked"]);

const { chromium } = await import("playwright");
try {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  await browser.close();
} catch (e) {
  // 起動の引数まで並ぶ長いメッセージなので、1行目と、足りないライブラリの行だけを出す
  const lines = String(e.message).split("\n");
  const missing = lines
    .filter((l) => /shared libraries|^\s+lib\S+\.so/.test(l))
    .map((l) =>
      l
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/^.*\[err\]\s*/, "")
        .trim(),
    );
  console.error([lines[0], ...new Set(missing)].join("\n"));
  console.error("\nChromium が起動しない。OS のライブラリが足りないときは、次を実行してから、もう一度 npm run setup を実行する（sudo のパスワードを聞かれる）");
  console.error("  npx playwright install-deps chromium");
  process.exit(1);
}
console.log("セットアップが済んだ。確かめるには：npm run build -- examples/sample-deck");
