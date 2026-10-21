#!/usr/bin/env node
// テスト用の gh の代わり（SLIDE_GH にこのファイルを指定する）。GitHub に出ずに、PR の読み出しとマージを確かめる。
// - FAKE_GH_STATE：PR の状態の JSON ファイル（{ number, url, state, baseRefName, headRefName, headRefOid, statusCheckRollup }）
// - pr view：その JSON を出す。pr merge：引数を state の merged_with に残し、state を MERGED にする
import fs from "fs";

const file = process.env.FAKE_GH_STATE;
const st = JSON.parse(fs.readFileSync(file, "utf8"));
const [cmd, sub, ...rest] = process.argv.slice(2);
if (cmd === "pr" && sub === "view") console.log(JSON.stringify(st));
else if (cmd === "pr" && sub === "merge") {
  const at = rest.indexOf("--match-head-commit");
  if (at >= 0 && rest[at + 1] !== st.headRefOid) {
    console.error("head が変わっている");
    process.exit(1);
  }
  fs.writeFileSync(file, JSON.stringify({ ...st, state: "MERGED", merged_with: rest }));
} else {
  console.error(`fake-gh：知らないコマンド ${process.argv.slice(2).join(" ")}`);
  process.exit(1);
}
