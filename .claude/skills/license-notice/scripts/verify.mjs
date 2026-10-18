// 照合：走査の結果を registry.yaml と policy.md に照らす。
// エラー（ビルドを止める）
// - 外部への読み込み、登録のない素材（フォント・data: の埋め込み・registry にない id）
// - 未確認の項目（verified_by・verified_at が空）
// - 許可されていないライセンス（policy.md の allow にない。conditional は conditions があり、人が承認したものだけ通す）
// - バージョンの不一致（registry.yaml と、入っている npm・pypi のパッケージ）
// - 実体ファイルの sha256 の不一致（registry.yaml の files）
// - html-build/package.json の依存に、登録のないものがある
// - Tailwind の CSS の先頭のライセンス表記が消えている、または版が違う
// 注意（人が確認する）
// - 識別子（data-origin・data-asset-id）のない SVG
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const LN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HB = path.join(LN, "..", "html-build");
const YAML = createRequire(path.join(HB, "package.json"))("yaml");

export function readRegistry() {
  return YAML.parse(fs.readFileSync(path.join(LN, "registry.yaml"), "utf8"));
}

// policy.md の yaml のブロック（allow・conditional・deny）
export function readPolicy() {
  const md = fs.readFileSync(path.join(LN, "policy.md"), "utf8");
  return YAML.parse(md.match(/```yaml\n([\s\S]*?)```/)[1]);
}

const matches = (pat, id) => (pat.endsWith("*") ? id.startsWith(pat.slice(0, -1)) : pat === id);
export function licenseClass(policy, id) {
  if (policy.deny.some((p) => matches(p, id))) return "deny";
  if (policy.allow.includes(id)) return "allow";
  if (policy.conditional.includes(id)) return "conditional";
  return "deny"; // ここにないものは禁止と同じ（policy.md 1章）
}

// 入っているパッケージの版
function installed(spec) {
  const [kind, rest] = spec.split(":");
  const at = rest.lastIndexOf(kind === "pypi" ? "==" : "@");
  const name = rest.slice(0, at), want = rest.slice(at + (kind === "pypi" ? 2 : 1));
  let have = null;
  try {
    if (kind === "npm") have = JSON.parse(fs.readFileSync(path.join(HB, "node_modules", name, "package.json"), "utf8")).version;
    if (kind === "pypi") have = execFileSync("python3", ["-c", `import importlib.metadata as m; print(m.version(${JSON.stringify(name)}))`], { encoding: "utf8" }).trim();
  } catch { have = null; }
  return { name, want, have };
}

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// 項目そのものの検査（このデッキで使ったかどうかによらない）
function checkEntry(e, policy, err) {
  if (!e.verified_by || !e.verified_at) err(`${e.id}：未確認（verified_by・verified_at が空）。人間の承認が要る`);
  for (const [lic, label] of [[e.license, ""], ...(e.additional_licenses ?? []).map((a) => [a.license, `（${a.applies_to}）`])]) {
    const c = licenseClass(policy, lic);
    if (c === "deny") err(`${e.id}：${lic}${label} は policy.md で許可されていない`);
    if (c === "conditional" && !(e.conditions ?? []).length) err(`${e.id}：${lic}${label} は条件付き。守る条件（conditions）と人間の承認が要る`);
  }
  for (const spec of String(e.package ?? "").split(/,\s*/).filter((s) => /^(npm|pypi):/.test(s))) {
    const p = installed(spec);
    if (p.have !== p.want) err(`${e.id}：${p.name} の版が違う（registry.yaml は ${p.want}、入っているのは ${p.have ?? "なし"}）`);
  }
  for (const f of e.files ?? []) {
    const file = path.join(LN, "assets", f.path);
    if (!fs.existsSync(file)) err(`${e.id}：実体ファイル assets/${f.path} がない`);
    else if (sha256(file) !== f.sha256) err(`${e.id}：assets/${f.path} の sha256 が registry.yaml と違う`);
  }
}

export function verify(scan) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m);
  const reg = readRegistry(), policy = readPolicy();
  const byId = new Map(reg.map((e) => [e.id, e]));

  // 配布物に入った素材
  for (const a of scan.assets) {
    const e = byId.get(a.id);
    if (!e) { err(`${a.id}：registry.yaml に登録がない（${a.found.join("、")}）`); continue; }
    if (e.scope !== "distributed") err(`${a.id}：build-only の項目が deck.html に入っている`);
  }
  for (const x of scan.external) err(`外部への読み込み：${x}`);
  for (const x of scan.unknown) err(x);

  // 道具も含めて、登録の中身を確かめる（ビルドに使ったものはすべて）
  const used = new Set([...scan.assets.map((a) => a.id), ...reg.filter((e) => e.scope === "build-only").map((e) => e.id)]);
  for (const e of reg) if (used.has(e.id)) checkEntry(e, policy, err);

  // html-build の依存がすべて登録されているか
  const deps = Object.keys(JSON.parse(fs.readFileSync(path.join(HB, "package.json"), "utf8")).dependencies ?? {});
  const registered = new Set(reg.flatMap((e) => String(e.package ?? "").split(/,\s*/)).map((s) => s.replace(/^npm:/, "").replace(/@[^@]+$/, "")));
  for (const d of deps) if (!registered.has(d)) err(`html-build/package.json の ${d} が registry.yaml に登録されていない`);

  // Tailwind の表記
  const tw = byId.get("tailwindcss");
  if (!scan.tailwind) err("Tailwind の CSS の先頭のライセンス表記（/*! tailwindcss … */）がない");
  else if (tw && scan.tailwind !== tw.version) err(`Tailwind の表記の版 ${scan.tailwind} が registry.yaml の ${tw.version} と違う`);

  if (scan.untaggedSvg.length) warnings.push(`識別子（data-origin・data-asset-id）のない SVG がある：${scan.untaggedSvg.join("、")}。独自の表現なら、素材を写していないかを人が確かめる`);
  return { errors, warnings, registry: byId };
}
