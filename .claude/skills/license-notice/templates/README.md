# ライセンス本文のテンプレート

表記の生成スクリプトが、`registry.yaml` の `copyright` を `{{copyright}}` に差し込んで、`deck.html` に入れるライセンス全文を作る。人間が管理する固定ファイルで、AI は変更しない。

| ファイル | 使う素材 | 元にした本文 |
|---|---|---|
| `OFL-1.1.txt` | Noto Sans JP | SPDX の `OFL-1.1`。先頭に著作権表示と「This Font Software is licensed under …」の1文を足した（OFL を付けるときの標準の書き方） |
| `ISC.txt` | Lucide | SPDX の `ISC`。SPDX の本文は ISC 社名入り（「ISC DISCLAIMS」）なので、一般形の「THE AUTHOR」に置き換えた（Lucide・d3 の LICENSE と同じ文面） |
| `MIT.txt` | Lucide の Feather 由来のアイコン | SPDX の `MIT` |

- 本文の取得元：npm `spdx-license-list@6.12.0`（SPDX License List のデータ）。
- 確認：空白の違いを除き、Lucide 1.59.0 の LICENSE（ISC 部分・MIT 部分）、`@fontsource/noto-sans-jp` 5.3.1 の LICENSE と本文が一致することを確かめた（OFL はダッシュ「—」と「--」の表記の違いだけ）。
- ビルド時だけ使う道具（Apache-2.0 など）はクレジットに載せないので、テンプレートを置いていない（policy.md の scope）。
