#!/usr/bin/env node
// セットアップ：ビルドに要るものをまとめて入れる。リポジトリの直下で `npm run setup`（CI では `npm run setup -- --with-deps`）
// 1. npm のパッケージ（版は package-lock.json で固定）
// 2. 検査と PDF に使う Chromium（Playwright）。--with-deps なら OS のライブラリも入れる
// 3. フォントのサブセット化に使う Python のパッケージ。版は license-notice/registry.yaml の package（pypi:）から読む
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });

run("npm", ["ci"]);
run(process.execPath, [path.join(ROOT, "node_modules/playwright/cli.js"), "install", ...(process.argv.includes("--with-deps") ? ["--with-deps"] : []), "chromium"]);
// registry.yaml を読むのに yaml が要るので、npm ci のあとで読み込む
const { readRegistry } = await import("../../license-notice/scripts/verify.mjs");
const pypi = readRegistry().flatMap((e) => String(e.package ?? "").split(/,\s*/)).filter((s) => s.startsWith("pypi:")).map((s) => s.slice(5));
run("python3", ["-m", "pip", "install", ...pypi]);
console.log("セットアップが済んだ。確かめるには：npm run build -- examples/sample-deck");
