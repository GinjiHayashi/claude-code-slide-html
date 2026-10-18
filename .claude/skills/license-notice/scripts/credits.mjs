// 表記の生成：照合に合格した素材について、registry.yaml の値と templates/ の本文から、
// credits スライドの行と、deck.html に入れるライセンスの全文を作る。
// 文面は AI が書かない。registry.yaml と templates/ の文字をそのまま使う。
// - 行：素材ごとに1行。追加のライセンス（additional_licenses）も1行ずつ（例：KaTeX のフォント、Lucide の Feather 由来のアイコン）
// - 全文：templates/<SPDX ID>.txt の {{copyright}} に registry.yaml の copyright を差し込む。
//   テンプレートがないライセンスは、表記が必要（notice_required）ならエラー、不要（パブリックドメインなど）なら行だけ載せる
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const LN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// 画面に出すライセンスの名前。SPDX ID のないものだけ言い換える
const LICENSE_LABEL = { "LicenseRef-PublicDomain": "パブリックドメイン" };
const short = (s) => String(s).replace(/（[^（]*）$/, "").trim(); // 名前の末尾の（説明）を外す
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function credits(assetIds, registry) {
  const rows = [], texts = [], errors = [];
  for (const id of assetIds) {
    const e = registry.get(id);
    if (!e || e.scope !== "distributed") continue;
    const parts = [
      { name: short(e.name), license: e.license, copyright: e.copyright },
      ...(e.additional_licenses ?? []).map((a) => ({ name: `${short(e.name)}（${short(a.applies_to).replace(/（.*$/, "")}）`, license: a.license, copyright: a.copyright })),
    ];
    for (const p of parts) {
      rows.push({ id, name: p.name, license: LICENSE_LABEL[p.license] ?? p.license, copyright: p.copyright });
      const tpl = path.join(LN, "templates", `${p.license}.txt`);
      if (fs.existsSync(tpl)) texts.push({ id, name: p.name, license: p.license, text: fs.readFileSync(tpl, "utf8").replace("{{copyright}}", () => p.copyright) });
      else if (e.notice_required) errors.push(`${id}：${p.license} のテンプレート（templates/${p.license}.txt）がない`);
    }
  }
  return { rows, texts, errors };
}

// base.html の #licenses に入れる HTML（画面にも印刷にも出さない）
export function licensesHtml(texts) {
  return texts.map((t) => `<section data-license-of="${esc(t.id)}"><h2>${esc(t.name)}（${esc(t.license)}）</h2>\n<pre>${esc(t.text.trimEnd())}</pre></section>`).join("\n");
}
