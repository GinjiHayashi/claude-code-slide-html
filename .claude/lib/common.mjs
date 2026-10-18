// スキルのスクリプトで共通に使う小さな処理
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

// コマンドとして呼ばれたか（import されたときは false）。シンボリックリンク越しに呼ばれても判定できるよう、実体のパスで比べる
// 使い方：if (isMain(import.meta.url)) { … }
export const isMain = (metaUrl) => !!process.argv[1] && fs.realpathSync(fileURLToPath(metaUrl)) === fs.realpathSync(process.argv[1]);

// 空（まだ書いていない）か。「なし」は空ではない
export const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export const sha256File = (file) => sha256(fs.readFileSync(file));

// デッキの ID：YYYY-MM-DD-<短い英語名>（小文字・数字・ハイフン）
export const DECK_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

// 先頭の --- で囲んだ設定。戻り値は match の結果（[0] が --- を含む全体、[1] が中の YAML）。なければ null
export const frontMatter = (text) => text.match(/^---\n([\s\S]*?)\n---\n/);
