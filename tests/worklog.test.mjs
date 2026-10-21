// 作業記録（make-slides/scripts/worklog.mjs・worklog-report.mjs）のテスト
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { SKILLS, tempDeck, rootOf } from "./helpers.mjs";

const { hook, readWork, turnSummary, appendWork } = await import(path.join(SKILLS, "make-slides/scripts/worklog.mjs"));
const { report } = await import(path.join(SKILLS, "make-slides/scripts/worklog-report.mjs"));
delete process.env.CLAUDE_PROJECT_DIR; // hook は cwd からリポジトリを決める

// デッキのあるリポジトリを作り、branch に切り替える
function repo(branch) {
  const dir = tempDeck();
  const root = rootOf(dir);
  const git = (...a) => execFileSync("git", ["-C", root, ...a], { stdio: "ignore" });
  git("init", "-q", "-b", "develop");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init");
  git("switch", "-q", "-c", branch);
  return { dir, root };
}

test("worklog の hook：feature/<deck-id> のブランチなら、時刻と工程を足す。本文は書かない。ほかのブランチと「<」で始まるターンは書かない", () => {
  const { dir, root } = repo("feature/2026-10-17-report-automation");
  hook({ hook_event_name: "SessionStart", session_id: "s1", cwd: root });
  hook({ hook_event_name: "UserPromptSubmit", session_id: "s1", cwd: root, prompt: "社外秘の数字は 123" });
  hook({ hook_event_name: "UserPromptSubmit", session_id: "s1", cwd: root, prompt: "<task-notification>…" });
  hook({ hook_event_name: "Stop", session_id: "s1", cwd: root });
  hook({ hook_event_name: "PreToolUse", session_id: "s1", cwd: root });
  const rows = readWork(dir);
  assert.deepEqual(
    rows.map((r) => r.event),
    ["session", "prompt", "stop"],
  );
  assert.ok(rows.every((r) => r.at && r.session === "s1" && r.stage));
  assert.ok(!fs.readFileSync(path.join(dir, "worklog.jsonl"), "utf8").includes("123"));

  // decks/ の外（examples/ の見本など）には書かない
  const ex = path.join(root, "examples", "sample-deck");
  fs.mkdirSync(ex, { recursive: true });
  appendWork(ex, { event: "build", ok: true });
  assert.equal(fs.existsSync(path.join(ex, "worklog.jsonl")), false);

  const other = repo("develop-work");
  hook({ hook_event_name: "UserPromptSubmit", session_id: "s1", cwd: other.root, prompt: "x" });
  assert.equal(fs.existsSync(path.join(other.dir, "worklog.jsonl")), false);
});

test("worklog の hook：ターンの終わりに、最後の人間の発言からあとのツールの回数・変えたファイル・トークン数を足す", () => {
  const { dir, root } = repo("feature/2026-10-17-report-automation");
  const t = path.join(root, "transcript.jsonl");
  const line = (o) => JSON.stringify(o);
  const use = (name, input) => ({ type: "tool_use", name, input });
  fs.writeFileSync(
    t,
    [
      line({ type: "user", message: { content: "前のターン" } }),
      line({ type: "assistant", message: { model: "m", usage: { input_tokens: 999 }, content: [use("Bash", {})] } }),
      line({ type: "user", message: { content: [{ type: "text", text: "直して" }] } }),
      line({
        type: "assistant",
        message: { model: "m2", usage: { input_tokens: 10, output_tokens: 5 }, content: [use("Edit", { file_path: path.join(dir, "outline.md") })] },
      }),
      line({ type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } }),
      line({
        type: "assistant",
        message: {
          model: "m2",
          usage: { input_tokens: 20, output_tokens: 7, cache_read_input_tokens: 3 },
          content: [use("Bash", {}), use("Edit", { file_path: path.join(dir, "outline.md") })],
        },
      }),
    ].join("\n"),
  );
  hook({ hook_event_name: "Stop", session_id: "s1", cwd: root, transcript_path: t });
  const [r] = readWork(dir);
  assert.deepEqual(r.tools, { Edit: 2, Bash: 1 });
  assert.deepEqual(r.files, ["decks/2026-10-17-report-automation/outline.md"]);
  assert.deepEqual(r.tokens, { input: 30, output: 12, cache_read: 3, cache_write: 0 });
  assert.equal(r.model, "m2");
  assert.deepEqual(turnSummary(path.join(root, "nothing.jsonl")), {}); // 読めなければ空
});

test("worklog-report：工程ごとの AI の作業時間・人の待ち時間・やり取り・ビルド、工程の戻り、承認の聞き直しを数える", () => {
  const dir = tempDeck();
  const at = (m) => new Date(Date.UTC(2026, 9, 21, 10, m)).toISOString();
  const rows = [
    { at: at(0), event: "session", stage: "1b ヒアリング", harness: "abc1234" },
    { at: at(0), event: "prompt", stage: "1b ヒアリング" },
    { at: at(5), event: "request", stage: "1b ヒアリング", targets: ["brief.md"] },
    { at: at(6), event: "stop", stage: "承認の確認", tokens: { input: 10, output: 2, cache_read: 0, cache_write: 0 } },
    { at: at(16), event: "prompt", stage: "承認の確認" }, // 答え待ちは 1b に数える
    { at: at(17), event: "request", stage: "1b ヒアリング", targets: ["brief.md"] },
    { at: at(18), event: "stop", stage: "承認の確認" },
    { at: at(20), event: "prompt", stage: "2 構成" },
    { at: at(25), event: "build", stage: "2 構成", ok: false },
    { at: at(27), event: "build", stage: "2 構成", ok: true },
    { at: at(30), event: "stop", stage: "2 構成" },
    { at: at(40), event: "prompt", stage: "1b ヒアリング" }, // 前提の直しで戻った
    { at: at(41), event: "stop", stage: "1b ヒアリング" },
  ];
  fs.writeFileSync(path.join(dir, "worklog.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "approvals.yaml"), "- target: brief.md\n  approved_at: x\n");
  const r = report(dir);
  const s = Object.fromEntries(r.stages.map((x) => [x.stage, x]));
  assert.deepEqual(Object.keys(s), ["1b ヒアリング", "2 構成"]);
  assert.equal(s["1b ヒアリング"].ai_ms, (6 + 2 + 1) * 60000);
  assert.equal(s["1b ヒアリング"].wait_ms, (10 + 2) * 60000);
  assert.equal(s["1b ヒアリング"].turns, 3);
  assert.equal(s["2 構成"].ai_ms, 10 * 60000);
  assert.equal(s["2 構成"].wait_ms, 10 * 60000);
  assert.deepEqual([s["2 構成"].builds, s["2 構成"].builds_ok], [2, 1]);
  assert.equal(r.back, 1);
  assert.deepEqual(r.harness, ["abc1234"]);
  assert.deepEqual(r.requests, [{ target: "brief.md", requests: 2, approved: 1, reasked: 1 }]);
  assert.equal(r.tokens.input, 10);
});
