// スキルのスクリプトで共通に使う小さな処理
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

// コマンドとして呼ばれたか（import されたときは false）。シンボリックリンク越しに呼ばれても判定できるよう、実体のパスで比べる
// 使い方：if (isMain(import.meta.url)) { … }
export const isMain = (metaUrl) => !!process.argv[1] && fs.realpathSync(fileURLToPath(metaUrl)) === fs.realpathSync(process.argv[1]);

// 空（まだ書いていない）か。「なし」は空ではない
export const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export const sha256File = (file) => sha256(fs.readFileSync(file));

// ハーネスの開発中か（true）、スライド作成中か（false）。ハーネスのファイルを守る hook が、開発中は確認を出さないために使う
// - 環境変数 SLIDE_HARNESS_MODE が dev なら開発中、slides ならスライド作成中（人間が切り替えたいとき）
// - それ以外は、decks/.gitignore が git で管理されていれば開発中（ハーネスのリポジトリ）。スライド用リポジトリでは消してある（README「1. スライド用リポジトリを作る」）
//   git で管理されているものだけを見るので、AI がファイルを置くだけでは開発中にならない
export function harnessDev(root) {
  const mode = process.env.SLIDE_HARNESS_MODE;
  if (mode === "dev" || mode === "slides") return mode === "dev";
  try {
    execFileSync("git", ["-C", root, "ls-files", "--error-unmatch", "decks/.gitignore"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Python：uv がリポジトリの直下に作る .venv の Python（npm run setup で uv sync して作る。パッケージは pyproject.toml と uv.lock）
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export function python() {
  const bin = path.join(ROOT, ".venv", ...(process.platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"]));
  if (!fs.existsSync(bin)) throw new Error(`${bin} がない。リポジトリの直下で npm run setup を実行する`);
  return bin;
}

// デッキの ID：YYYY-MM-DD-<短い英語名>（小文字・数字・ハイフン）
export const DECK_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

// 先頭の --- で囲んだ設定。戻り値は match の結果（[0] が --- を含む全体、[1] が中の YAML）。なければ null
export const frontMatter = (text) => text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
