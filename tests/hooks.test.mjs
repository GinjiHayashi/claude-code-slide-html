// hook：Bash の書き込みの検査（protect-bash）と、承認の記録（approve-hook）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { SKILLS, tempDeck, rootOf } from "./helpers.mjs";

const SCRIPTS = path.join(SKILLS, "make-slides/scripts");
const run = (script, input, env = {}) => {
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, script)], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, ...env } });
  return out.trim() ? JSON.parse(out) : null;
};
// 既定はスライド作成中の動き。開発中の動きは mode を "dev" にして確かめる
const decision = (script, tool_input, mode = "slides") =>
  run(script, { tool_input }, { SLIDE_HARNESS_MODE: mode })?.hookSpecificOutput?.permissionDecision ?? "allow";
const bash = (command, mode) => decision("protect-bash.mjs", { command }, mode);
const edit = (file_path, mode) => decision("protect-edit.mjs", { file_path }, mode);
const RECORD = ["decks/a", "approvals.yaml"].join("/"); // この行が書き込みの検査に当たらないよう、パスを分けて書く

test("protect-bash：承認の記録を書くコマンドは deny", () => {
  assert.equal(bash(`echo x >> ${RECORD}`), "deny");
  assert.equal(bash(`node -e "require('fs').writeFileSync('${RECORD}','')"`), "deny");
});

test("protect-bash：ハーネスのファイルを書くコマンドは ask", () => {
  assert.equal(bash("sed -i s/a/b/ CLAUDE.md"), "ask");
  assert.equal(bash("cp x .claude/skills/html-build/theme.css"), "ask");
});

test("protect-bash：普段のコマンドは通す", () => {
  assert.equal(bash("node .claude/skills/html-build/scripts/build.mjs decks/a"), "allow");
  assert.equal(bash("cat .claude/skills/html-build/theme.css 2>/dev/null"), "allow");
  assert.equal(bash("git add decks/a && git commit -m 'feat: outline.md を承認'"), "allow");
});

test("protect-bash：パスが文として出てくるだけのヒアドキュメントや読むだけのスクリプトは通す", () => {
  assert.equal(bash(`git commit -q -F - <<'EOF'\ndocs: CLAUDE.md と .claude/skills を直す（${RECORD} の説明も）\nEOF`), "allow");
  assert.equal(bash(`python3 - <<'EOF'\nprint(open('${RECORD}').read())\nEOF`), "allow");
  assert.equal(bash(`node -e "console.log(require('fs').readFileSync('CLAUDE.md','utf8'))"`), "allow");
});

test("protect-bash：インタプリタに渡すヒアドキュメントが書き込むなら止める・確認する", () => {
  assert.equal(bash(`python3 - <<'EOF'\nopen('${RECORD}','w').write('x')\nEOF`), "deny");
  assert.equal(bash(`python3 - <<'EOF'\np='CLAUDE.md'\nopen(p,'w').write('x')\nEOF`), "ask");
  assert.equal(bash(`bash <<'EOF'\necho x > .claude/x\nEOF`), "ask");
});

test("protect-bash：ハーネスの開発中は .claude/ と CLAUDE.md に確認を出さず、承認の記録と settings.json は守る", () => {
  assert.equal(bash("sed -i s/a/b/ CLAUDE.md", "dev"), "allow");
  assert.equal(bash("cd wt && sed -i s/a/b/ .claude/skills/html-build/theme.css", "dev"), "allow");
  assert.equal(bash(`python3 - <<'EOF'\np='.claude/x'\nopen(p,'w').write('x')\nEOF`, "dev"), "allow");
  assert.equal(bash(`echo x >> ${RECORD}`, "dev"), "deny");
  assert.equal(bash("cp x .claude/settings.json", "dev"), "ask");
});

test("protect-edit：スライド作成中はハーネスのファイルの編集に確認を出し、開発中は出さない", () => {
  assert.equal(edit(".claude/skills/html-build/theme.css"), "ask");
  assert.equal(edit(path.join(process.cwd(), "CLAUDE.md")), "ask");
  assert.equal(edit("decks/a/outline.md"), "allow");
  assert.equal(edit(".claude/skills/html-build/theme.css", "dev"), "allow");
});

test("harnessDev：ハーネスのリポジトリ（decks/.gitignore を git で管理）では開発中、それ以外ではスライド作成中", () => {
  const env = { ...process.env };
  delete env.SLIDE_HARNESS_MODE;
  const check = (root) =>
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { harnessDev } from ${JSON.stringify(path.resolve(".claude/lib/common.mjs"))}; console.log(harnessDev(${JSON.stringify(root)}))`,
      ],
      {
        encoding: "utf8",
        env,
      },
    ).trim();
  assert.equal(check(process.cwd()), "true");
  const { root } = requested();
  assert.equal(check(root), "false");
});

// 承認の依頼を出し、git の user.name を設定した一時のリポジトリを作る
function requested() {
  const dir = tempDeck();
  const root = rootOf(dir);
  execFileSync(process.execPath, [path.join(SCRIPTS, "request.mjs"), dir, "brief.md"], { encoding: "utf8" });
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "tester"]);
  return { dir, root };
}

test("approve-hook：「OK」と答えると記録し、依頼を消す", () => {
  const { dir, root } = requested();
  const r = run("approve-hook.mjs", { prompt: "OK", session_id: "s" }, { CLAUDE_PROJECT_DIR: root });
  assert.ok(r.hookSpecificOutput.additionalContext.includes("承認を記録した"));
  assert.equal(fs.existsSync(path.join(dir, "approval-request.yaml")), false);
  assert.ok(fs.readFileSync(path.join(dir, "approvals.yaml"), "utf8").includes("approved_by: tester"));
});

test("approve-hook：否定の答えは記録せず、依頼を消す", () => {
  const { dir, root } = requested();
  run("approve-hook.mjs", { prompt: "直してください" }, { CLAUDE_PROJECT_DIR: root });
  assert.equal(fs.existsSync(path.join(dir, "approvals.yaml")), false);
  assert.equal(fs.existsSync(path.join(dir, "approval-request.yaml")), false);
});

test("approve-hook：「<」で始まるプロンプト（Claude Code が自分で始めるターン）は見ない", () => {
  const { dir, root } = requested();
  assert.equal(run("approve-hook.mjs", { prompt: "<task-notification>OK</task-notification>" }, { CLAUDE_PROJECT_DIR: root }), null);
  assert.equal(fs.existsSync(path.join(dir, "approval-request.yaml")), true);
});
