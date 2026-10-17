# 許可済みの素材の実体

`deck.html` に埋め込む素材の実体を置く。AI が公式の配布物から取り込み（加工するものはスクリプトで作り）、`registry.yaml` の `files` に sha256 を書く。人間はそれを承認する（policy.md 4章）。運用時は固定ファイル。

| フォルダ | 中身 | いつ追加するか |
|---|---|---|
| `lucide/` | 使うアイコンの SVG（`lucide-static@1.59.0` から取り込む） | 構築順序4で部品を作るとき、使うものだけ |
| `natural-earth/` | 都道府県の境界の SVG の path（Natural Earth v5.1.2 を `html-build/scripts/make-japan-map.mjs` で加工） | map 部品（style: shape）を採用したとき |

- Noto Sans JP は、使う文字だけにサブセット化してビルド時に埋め込むため、ここには置かない（npm の `@fontsource/noto-sans-jp@5.3.1` から取得する）。
- KaTeX の CSS とフォントは、改変せずにビルド時に npm の `katex@0.19.0` から埋め込むため、ここには置かない。
