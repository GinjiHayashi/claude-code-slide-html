---
name: license-notice
description: スライドに使う素材（フォント・アイコン・ライブラリ・地図データなど）のライセンスを管理するスキル。素材を新しく使いたいときの登録の手順と、ビルドの中で行う走査・照合・表記の生成の仕組みを説明する。
---

# ライセンス管理（license-notice）

商用で使えるものだけを使い、ライセンス表記は AI ではなくスクリプトが作る（要求文書 12章）。

## ビルドの中で自動で行うこと

`html-build/scripts/build.mjs` が次の3つを呼ぶ。単独で呼ぶ必要はない。

| スクリプト | すること |
|---|---|
| `scripts/scan.mjs` | `deck.html` から、使った素材（フォント、`data-asset-id` の付いた素材、KaTeX）、外部への読み込み、識別子のない SVG を洗い出す |
| `scripts/verify.mjs` | `registry.yaml` と `policy.md` に照らす。未登録・未承認・許可外のライセンス・版や sha256 の違い・`html-build/package.json` の未登録の依存・Tailwind の表記の欠けがあればエラー |
| `scripts/credits.mjs` | `registry.yaml` の値と `templates/` の本文から、credits スライドの行とライセンスの全文を作る |

- 結果は `build/assets-manifest.yaml`（使った素材の一覧）と `build/build-log.md` の「ライセンス」の節に出る。
- `deck.html` には全文を入れる。PDF には credits スライドの表記だけが入る（フォントを文書に埋め込む場合、OFL の全文は不要：OFL FAQ 1.10・1.12）。

## 素材を新しく使いたいとき

`policy.md` 4章の手順に従う。要点：

1. 公式の配布物（パッケージ同梱の LICENSE、公式の利用条件）でライセンスと著作権者を調べる。
2. `registry.yaml` に項目を書く。`verified_by`・`verified_at`・`verification` は空のまま。
3. 配布物に入る素材（`scope: distributed`）は、実体を `assets/` に置いて sha256 を書く。部品から埋め込むときは `data-asset-id="<id>:<名前>"` を付ける。
4. 人間に、追加した項目と根拠（URL、LICENSE の該当箇所）を示して承認を求める。
5. 人間がチャットで承認したら、`verified_by`・`verified_at`・`verification` を書く。**承認の言葉がない限り書かない。**

- `policy.md`、`templates/`、`assets/` は人間が管理する固定ファイル。変える必要があれば人間に理由を伝える。
- ライセンスの文面（credits スライドや全文）を自分で書かない。
