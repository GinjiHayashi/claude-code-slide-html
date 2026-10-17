// 承認の記録（decks/<deck-id>/approvals.yaml）を読む・書く共通の処理（要求文書 4章）。
// - 1件の承認＝対象のファイル、その時点の sha256、承認者、承認日時。outline.md はスライドごとの sha256 も残す
//   （承認後にどのスライドが変わったかを示し、ファクトチェックをそのスライドだけやり直せるようにするため）
// - 記録は追記だけ。同じ対象の承認が複数あれば、最後のものを使う
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const HB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "html-build");
export const YAML = createRequire(path.join(HB, "package.json"))("yaml");

// 承認できるもの（工程の順）
export const TARGETS = ["brief.md", "outline.md", "factcheck.md", "deck.html"];

export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// outline.md をスライドの見出し（## S01）ごとに分けて sha256 を取る。先頭の設定は「meta」
export function slideHashes(text) {
  const out = {};
  const m = text.match(/^---\n[\s\S]*?\n---\n/);
  out.meta = sha256(m ? m[0] : "");
  const body = m ? text.slice(m[0].length) : text;
  for (const part of body.split(/^(?=##\s+\S+\s*$)/m)) {
    const h = part.match(/^##\s+(\S+)/);
    if (h) out[h[1]] = sha256(part.trimEnd());
  }
  return out;
}

export function readApprovals(deckDir) {
  const f = path.join(deckDir, "approvals.yaml");
  if (!fs.existsSync(f)) return [];
  return YAML.parse(fs.readFileSync(f, "utf8")) ?? [];
}

// 対象ごとの最後の承認
export function latest(approvals, target) {
  return [...approvals].reverse().find((a) => a.target === target) ?? null;
}
