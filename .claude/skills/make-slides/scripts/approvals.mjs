// 承認の記録（decks/<deck-id>/approvals.yaml）を読む・書く共通の処理。
// - 1件の承認＝対象のファイル、その時点の sha256、承認者、承認日時。outline.md はスライドごとの sha256 も残す
//   （承認後にどのスライドが変わったかを示し、ファクトチェックをそのスライドだけやり直せるようにするため）
// - 記録は追記だけ。同じ対象の承認が複数あれば、最後のものを使う
// - factcheck.md の承認には、そのときの outline.md のスライドごとの sha256（outline_slides）も残す
//   （ファクトチェックのあとに変わったスライドを、ゲートが見つけられるようにするため）
// - スライドごとの「文」と「全体」の sha256（slideDigests。outline.md の承認は slide_text、factcheck.md の承認は outline_text）も残す。
//   文が変わったスライドだけファクトチェックをやり直し、見た目だけの変更は承認のやり直しだけにするため（文と見た目の分け方は spec.mjs の LOOK）。
//   スライドは見出しの番号ではなく、id（- id: tdd-intro）か文の sha256 で対応づける（途中に1枚足しても、後ろのスライドを変わった扱いにしない）
// - 古い記録（slide_text・outline_text がないもの）は、これまでどおり見出しごとの sha256 で比べる
// - 流れ：AI が request.mjs で承認を依頼する（approval-request.yaml に、その時点の sha256 を残す）→ 人間が答える
//   → approve-hook.mjs（人間のプロンプトを受けた hook）が答えを判定し、承認なら approvals.yaml に答えの原文ごと記録する
// - approvals.yaml を書くのは hook だけ。AI は書かない（.claude/settings.json で禁止）
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { frontMatter, sha256 } from "../../../lib/common.mjs";
import { parseOutline, plain } from "../../html-build/scripts/outline.mjs";
import { LOOK } from "../../html-build/scripts/spec.mjs";

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

// outline.md のスライドごとに { slide（見出し）, id?, text（文の sha256）, all（見出しを除いた全体の sha256） } を返す。
// 読めない outline.md なら null（古い比べ方に戻す）
const LOOK_KEYS = new Set(LOOK);
const words = (v, key, out) => {
  if (v == null || typeof v === "boolean" || LOOK_KEYS.has(key)) return out;
  if (Array.isArray(v)) v.forEach((x) => words(x, key, out));
  else if (typeof v === "object") for (const [k, x] of Object.entries(v)) words(x, k, out);
  else {
    const t = plain(v).replace(/\s+/g, ""); // 太字とコードの印、空白と改行は比べない
    if (t) out.push(`${key}=${t}`);
  }
  return out;
};
export function slideDigests(text) {
  let o;
  try {
    o = parseOutline(text);
  } catch {
    return null;
  }
  return o.slides.map((s) => ({
    slide: s.id,
    ...(typeof s.fields.id === "string" ? { id: s.fields.id } : {}),
    text: sha256(JSON.stringify(Object.entries(s.fields).flatMap(([k, v]) => words(v, k, [])))),
    all: sha256(JSON.stringify(s.fields)),
  }));
}

// 前の記録（then）と今（now）のスライドを対応づけて、変わったものを返す。
// 対応づけ：id が同じもの → 文の sha256 が同じもの（同じ見出し、同じ全体のものを先に）。どれとも対応しないスライドは「文が変わった」
// 戻り値：{ text：文が変わった（ファクトチェックをやり直す）, look：見た目だけ変わった, removed：消えた }（どれも見出しの並び）
export function slideChanges(then, now) {
  const used = new Set(),
    text = new Set(),
    look = new Set();
  const pair = (c, p) => {
    used.add(p);
    if (p.text !== c.text) text.add(c);
    else if (p.all !== c.all) look.add(c);
  };
  const rest = [];
  for (const c of now) {
    const p = c.id && then.find((t) => !used.has(t) && t.id === c.id);
    if (p) pair(c, p);
    else rest.push(c);
  }
  for (const c of rest) {
    const free = then.filter((t) => !used.has(t) && t.text === c.text);
    const p = free.find((t) => t.slide === c.slide) ?? free.find((t) => t.all === c.all) ?? free[0];
    if (p) pair(c, p);
    else text.add(c);
  }
  const ids = (set) => now.filter((c) => set.has(c)).map((c) => c.slide);
  return { text: ids(text), look: ids(look), removed: then.filter((t) => !used.has(t)).map((t) => t.slide) };
}

// 変わったところを1行で書く（outline.md の承認と、ゲートの知らせに使う）
export function describeChanges(c) {
  const parts = [];
  if (c.text.length) parts.push(`文：${c.text.join("、")}`);
  if (c.look.length) parts.push(`見た目だけ：${c.look.join("、")}`);
  if (c.removed.length) parts.push(`消した：${c.removed.join("、")}`);
  return parts.join("／") || "スライドの中身は変わっていない（先頭の設定か、書き方だけ）";
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
  if (target === "outline.md") {
    entry.slides = slideHashes(buf.toString("utf8"));
    const d = slideDigests(buf.toString("utf8"));
    if (d) entry.slide_text = d;
  }
  const outline = path.join(deckDir, "outline.md");
  if (target === "factcheck.md" && fs.existsSync(outline)) {
    const text = fs.readFileSync(outline, "utf8");
    entry.outline_slides = slideHashes(text);
    const d = slideDigests(text);
    if (d) entry.outline_text = d;
  }
  const prev = latest(readApprovals(deckDir), target);
  let changed = prev ? "前回の承認から変わっている" : "初めての承認";
  if (prev?.sha256 === entry.sha256) changed = "前回の承認から変わっていない";
  else if (prev?.slide_text && entry.slide_text) changed = `前回の承認から変わったところ：${describeChanges(slideChanges(prev.slide_text, entry.slide_text))}`;
  else if (prev?.slides && entry.slides) {
    const ids = new Set([...Object.keys(prev.slides), ...Object.keys(entry.slides)]);
    changed = `前回の承認から変わったところ：${[...ids].filter((k) => prev.slides[k] !== entry.slides[k]).join("、")}`;
  }
  const f = path.join(deckDir, "approvals.yaml");
  const head = fs.existsSync(f)
    ? ""
    : "# approvals.yaml：承認の記録。承認の依頼に人間が答えると、hook（approve-hook.mjs）が答えの原文ごと追記する。手で書き換えない\n";
  fs.appendFileSync(f, head + YAML.stringify([entry]));
  return { entry, changed };
}

// PR のマージの承認（target: merge）。ファイルではなく、PR の番号・マージ先・承認した時点の head のコミットを記録する。
// マージは merge.mjs だけが行い、この記録と今の PR を突き合わせる（記録のあとに push されていたら止める）
export function recordMerge(deckDir, t, info) {
  const entry = { target: "merge", pr: t.pr, base: t.base, head_sha: t.head_sha, ...(t.failing?.length ? { failing: t.failing } : {}), ...info };
  const f = path.join(deckDir, "approvals.yaml");
  const head = fs.existsSync(f)
    ? ""
    : "# approvals.yaml：承認の記録。承認の依頼に人間が答えると、hook（approve-hook.mjs）が答えの原文ごと追記する。手で書き換えない\n";
  fs.appendFileSync(f, head + YAML.stringify([entry]));
  return entry;
}
export const latestMerge = (approvals, pr) => [...approvals].reverse().find((a) => a.target === "merge" && Number(a.pr) === Number(pr)) ?? null;
// 依頼の対象の書き方（ファイルか、PR のマージか）
export const targetName = (t) => (t.target === "merge" ? `PR #${t.pr} の ${t.base} へのマージ` : t.target);

// 承認の依頼（AI が書く。承認そのものではない）
export const REQUEST = "approval-request.yaml";
export function readRequest(deckDir) {
  const f = path.join(deckDir, REQUEST);
  return fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, "utf8")) : null;
}

// 人間の答えを判定する（AI ではなく、決まった語で判定する）
// - 直す・待つ・否定の語や疑問符があれば「承認ではない」
// - 「承認」は、答えが短い同意の語だけでできているときに限る（「OK」「承認します」「はい、承認します」「大丈夫です。進めてください」）。
//   ほかの言葉が1つでも混じれば「判断できない」にして、AI が聞き直す（「はい、でも図は差し替えたい」「問題ないですか」「これはいけません」）
// - 迷う答えは承認ではない側に倒す。誤って承認すると確かめていない内容が先へ進むが、聞き直すだけなら1往復で済むため
const NO =
  /直し|直して|修正|変更|変えて|だめ|ダメ|駄目|NG|待って|まって|やめ|違う|ちがう|保留|却下|いいえ|ではな|じゃな|しない|しません|できな|できません|ないで(?!す)|まだ|あとで|後で|[?？]/i;
// 同意の語（答えを句読点で区切った1つ1つが、このどれかと一致したときだけ承認）
const YES = new Set(
  (
    "承認 承認します 承認する 承認です 承認で 承認でお願いします 承認しました ok okです オーケー lgtm 👍 はい 了解 了解です 了解しました " +
    "問題ない 問題ないです 問題ありません 大丈夫 大丈夫です いいです いいよ 良いです よいです かまいません 構いません 進めて 進めてください 進めましょう お願いします それで それでお願いします"
  ).split(" "),
);
export function judge(text) {
  if (NO.test(text)) return "reject";
  const parts = String(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .split(/[、。,.!！]+/)
    .filter(Boolean);
  if (parts.length && parts.every((p) => YES.has(p))) return "approve";
  return "unclear";
}
