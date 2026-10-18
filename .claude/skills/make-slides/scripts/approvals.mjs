// 承認の記録（decks/<deck-id>/approvals.yaml）を読む・書く共通の処理。
// - 1件の承認＝対象のファイル、その時点の sha256、承認者、承認日時。outline.md はスライドごとの sha256 も残す
//   （承認後にどのスライドが変わったかを示し、ファクトチェックをそのスライドだけやり直せるようにするため）
// - 記録は追記だけ。同じ対象の承認が複数あれば、最後のものを使う
// - factcheck.md の承認には、そのときの outline.md のスライドごとの sha256（outline_slides）も残す
//   （ファクトチェックのあとに変わったスライドを、ゲートが見つけられるようにするため）
// - 流れ：AI が request.mjs で承認を依頼する（approval-request.yaml に、その時点の sha256 を残す）→ 人間が自由な言葉で答える
//   → approve-hook.mjs（人間のプロンプトを受けた hook）が答えを判定し、承認なら approvals.yaml に答えの原文ごと記録する
// - approvals.yaml を書くのは hook だけ。AI は書かない（.claude/settings.json で禁止）
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { frontMatter, sha256 } from "../../../lib/common.mjs";

export { YAML };

// 承認できるもの（工程の順）
export const TARGETS = ["brief.md", "outline-draft.md", "outline.md", "factcheck.md", "build/deck.html"]; // デッキのフォルダからの相対パス

export { sha256 };

// outline.md をスライドの見出し（## S01）ごとに分けて sha256 を取る。先頭の設定は「meta」
export function slideHashes(text) {
  const out = {};
  const m = frontMatter(text);
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

// 承認を1件追記する。前回の承認から変わったところ（outline.md はスライドの番号）も返す
export function recordApproval(deckDir, target, info) {
  const buf = fs.readFileSync(path.join(deckDir, target));
  const entry = { target, sha256: sha256(buf), ...info };
  if (target === "outline.md") entry.slides = slideHashes(buf.toString("utf8"));
  const outline = path.join(deckDir, "outline.md");
  if (target === "factcheck.md" && fs.existsSync(outline)) entry.outline_slides = slideHashes(fs.readFileSync(outline, "utf8"));
  const prev = latest(readApprovals(deckDir), target);
  let changed = prev ? "前回の承認から変わっている" : "初めての承認";
  if (prev?.sha256 === entry.sha256) changed = "前回の承認から変わっていない";
  else if (prev?.slides && entry.slides) {
    const ids = new Set([...Object.keys(prev.slides), ...Object.keys(entry.slides)]);
    changed = `前回の承認から変わったところ：${[...ids].filter((k) => prev.slides[k] !== entry.slides[k]).join("、")}`;
  }
  const f = path.join(deckDir, "approvals.yaml");
  const head = fs.existsSync(f) ? "" : "# approvals.yaml：承認の記録。承認の依頼に人間が答えると、hook（approve-hook.mjs）が答えの原文ごと追記する。手で書き換えない\n";
  fs.appendFileSync(f, head + YAML.stringify([entry]));
  return { entry, changed };
}

// 承認の依頼（AI が書く。承認そのものではない）
export const REQUEST = "approval-request.yaml";
export function readRequest(deckDir) {
  const f = path.join(deckDir, REQUEST);
  return fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, "utf8")) : null;
}

// 人間の答えを判定する（AI ではなく、決まった語で判定する）
// - 直す・待つ・否定の語や疑問符があれば「承認ではない」。なければ、同意の語があるときだけ「承認」。どちらもなければ「判断できない」
// - 否定の言い方（「承認しません」「まだ承認しないで」「あとで」）は、同意の語を含んでいても承認ではない。
//   迷う言い方は承認ではない側に倒す（承認されないだけなら、AI がもう一度聞けば済むため）。「問題ありません」は否定の語に当たらない
const NO = /直し|直して|修正|変更|変えて|だめ|ダメ|駄目|NG|待って|まって|やめ|違う|ちがう|保留|却下|いいえ|ではな|じゃな|しない|しません|できな|できません|ないで(?!す)|まだ|あとで|後で|[?？]/i;
const YES = /承認|OK|オーケー|はい|いいです|いいよ|良いです|よいです|大丈夫|問題な|問題ありません|かまいません|構いません|了解|進めて|進めましょう|お願いします|LGTM|👍/i;
export function judge(text) {
  if (NO.test(text)) return "reject";
  if (YES.test(text)) return "approve";
  return "unclear";
}
