# ライセンスの基準（policy.md）

スライドの配布物やビルドに使ってよい素材（ライブラリ、アイコン、フォント、画像）のライセンスの基準。
このファイルは人間が決めて書く。運用時は固定ファイルで、AI は変更しない。

> この基準は法的な助言ではない。判断に迷うものは、必要に応じて法務担当に確認する。

## 1. 区分

| 区分 | 扱い |
|---|---|
| 許可 | 使ってよい。`registry.yaml` に登録すれば使える |
| 条件付き | 原則使わない。使う場合は人間が個別に判断し、守る条件を `registry.yaml` の `conditions` に書く |
| 禁止 | 使わない |

照合スクリプトは、次のブロックの SPDX ID を読んで判定する。ここにないライセンスは「禁止」と同じ扱いにする（不明なものは使わない）。

```yaml
allow:
  - MIT
  - ISC
  - BSD-2-Clause
  - BSD-3-Clause
  - Apache-2.0
  - OFL-1.1            # フォント
conditional:
  - MPL-2.0
  - CC-BY-4.0          # アイコン・画像
  - LicenseRef-PDL-1.0 # 公共データ利用規約 第1.0版。出典の記載、加工した場合はその旨と加工者の記載が必要。ロゴ等は対象外
deny:
  - GPL-*
  - AGPL-*
  - LGPL-*
  - CC-BY-NC-*         # 非商用限定
  - CC-BY-ND-*         # 改変禁止
  - CC-BY-SA-*         # 継承：スライド全体に同じライセンスを求められるため
  - NOASSERTION        # ライセンス不明
```

## 2. 配布物に入るか（scope）

| scope | 意味 | クレジット |
|---|---|---|
| `distributed` | `deck.html` に埋め込まれる（フォント、アイコンの SVG、画像） | 載せる。著作権表示とライセンス全文を HTML 内に含める |
| `build-only` | ビルド時だけ使い、生成物（CSS、SVG）だけが配布物に入る（Tailwind、Mermaid、d3、Playwright） | 載せない。ただし Tailwind が出力する CSS の先頭の `/*! tailwindcss … MIT License … */` は消さない |

- 生成物がライブラリのライセンスの対象にならないという整理は、法的に確認したものではない（推測）。

## 3. 表記の方法

- `deck.html` の最後に `credits` スライドを置き、素材名・ライセンス・著作権者を一覧で載せる。
- ライセンスの全文は、同じ `deck.html` の中の非表示の要素に入れる（1ファイルで完結させるため。D8）。
- 表記はスクリプトが `registry.yaml` と `templates/` から生成する。AI は書かない。

## 4. 登録の手順

1. AI が下調べする：ライセンス、著作権者、バージョン、出典の URL、商用利用の可否。
2. 人間が公式の配布物（リポジトリの LICENSE など）で確認する。
3. 人間が `registry.yaml` に登録し、`verified_by`・`verified_at` を書く。
4. `distributed` の素材は、実体を `assets/` に置き、sha256 を `registry.yaml` に書く。

## 5. 出典

- SPDX License List：https://spdx.org/licenses/
- SPDX の `LicenseRef-` の書き方（SPDX Specification 2.3.1、Other licensing information detected）：https://spdx.github.io/spdx-spec/v2.3.1/other-licensing-information-detected/
- PDL1.0 に SPDX の ID がないことは、SPDX License List の一覧を見た範囲での判断（`PDDL-1.0` は別のライセンス）
- SIL Open Font License 1.1（条件2：著作権表示とライセンスを配布物に含める）：https://openfontlicense.org/open-font-license-official-text/
- 公共データ利用規約（第1.0版）：https://www.digital.go.jp/resources/open_data/public_data_license_v1.0
