---
name: license-notice
description: スライドに使う素材（フォント・アイコン・ライブラリ・地図データなど）のライセンスを管理するスキル。素材を新しく使いたいときの登録の手順と、ビルドの中で行う走査・照合・表記の生成の仕組みを説明する。
---

# ライセンス管理（license-notice）

商用で使えるものだけを使い、ライセンス表記は AI ではなくスクリプトが作る。

## ビルドの中で自動で行うこと

`html-build/scripts/build.mjs` が次の3つを呼ぶ。単独で呼ぶ必要はない。

| スクリプト | すること |
|---|---|
| `scripts/scan.mjs` | `deck.html` から、使った素材（フォント、`data-asset-id` の付いた素材、KaTeX）、外部への読み込み、識別子のない SVG を洗い出す |
| `scripts/verify.mjs` | `registry.yaml` と `policy.md` に照らす。未登録・未承認・許可外のライセンス・版や sha256 の違い・`package.json` の未登録の依存・Tailwind の表記の欠けがあればエラー |
| `scripts/credits.mjs` | `registry.yaml` の値と `templates/` の本文から、credits スライドの行とライセンスの全文を作る |

- 結果は `build/assets-manifest.yaml`（使った素材の一覧）と `build/build-log.md` の「ライセンス」の節に出る。
- `deck.html` には全文を入れる。PDF には credits スライドの表記だけが入る（フォントを文書に埋め込む場合、OFL の全文は不要：OFL FAQ 1.10・1.12）。

## 素材を新しく使いたいとき

`registry.yaml` は固定ファイルなので、スライド作成中は変えない。素材が要るときは、人間に理由を伝えて判断を仰ぐ。人間がハーネスを直すと決めたら、`policy.md` 4章の「登録の手順」に従う。AI は調べて `registry.yaml` に書き、人間に根拠を示して承認を求める。`verified_by`・`verified_at`・`verification` は、人間の承認の言葉がない限り書かない。

- `policy.md`、`templates/`、`assets/` は人間が管理する固定ファイル。変える必要があれば人間に理由を伝える。
- ライセンスの文面（credits スライドや全文）を自分で書かない。
