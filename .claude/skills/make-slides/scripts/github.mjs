// GitHub の PR を gh で読む・マージする共通の処理（request.mjs・merge.mjs が使う）。
// - gh の場所は環境変数 SLIDE_GH で変えられる（テストで、GitHub に出ずに確かめるため）。既定は gh
// - マージできるのは develop（squash）と main（マージコミット）への PR だけ（README「git の運用ルール」）
import { execFileSync } from "child_process";

export const MERGE_METHOD = { develop: "squash", main: "merge" };
// マージの方式：マージ先で決まる。ただしハーネスの更新の取り込み（feature/harness-update）は、develop へもマージコミット
export const mergeMethod = (base, head) => (head === "feature/harness-update" ? "merge" : MERGE_METHOD[base]);

export const gh = (args, cwd) => execFileSync(process.env.SLIDE_GH || "gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// PR の今の状態：{ pr, url, state, base, head, head_sha, failing（失敗したチェックの名前）, pending（終わっていないチェックの名前） }
const BAD = ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"];
export function prInfo(pr, cwd) {
  const j = JSON.parse(gh(["pr", "view", String(pr), "--json", "number,url,state,baseRefName,headRefName,headRefOid,statusCheckRollup"], cwd));
  const checks = j.statusCheckRollup ?? [];
  const name = (c) => c.name || c.context || "（名前のないチェック）";
  return {
    pr: j.number,
    url: j.url,
    state: j.state,
    base: j.baseRefName,
    head: j.headRefName,
    head_sha: j.headRefOid,
    failing: checks.filter((c) => BAD.includes(c.conclusion) || BAD.includes(c.state)).map(name),
    pending: checks.filter((c) => (c.status && c.status !== "COMPLETED") || c.state === "PENDING").map(name),
  };
}
