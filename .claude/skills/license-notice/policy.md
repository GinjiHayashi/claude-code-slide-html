# ライセンスの基準（policy.md）

スライドの配布物やビルドに使ってよい素材（ライブラリ、アイコン、フォント、画像）のライセンスの基準。
このファイルは人間が決める。運用時は固定ファイルで、AI は人間の指示なしに変更しない。

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
  - LicenseRef-PublicDomain # パブリックドメインと明記されたもの（例：Natural Earth）。SPDX に共通の ID がないため LicenseRef にする
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
| `build-only` | ビルド時だけ使い、生成物（CSS、SVG）だけが配布物に入る（Tailwind、d3、Playwright） | 載せない。ただし Tailwind が出力する CSS の先頭の `/*! tailwindcss … MIT License … */` は消さない |

- 生成物がライブラリのライセンスの対象にならないという整理は、法的に確認したものではない（推測）。

## 3. 表記の方法

- `deck.html` の最後に `credits` スライドを置き、素材名・ライセンス・著作権者を一覧で載せる。
- ライセンスの全文は、同じ `deck.html` の中の非表示の要素に入れる（1ファイルで完結させるため）。
- 表記はスクリプトが `registry.yaml` と `templates/` から生成する。AI は書かない。

## 4. 登録の手順

登録は AI が書き、人間は承認だけを行う。

1. AI が調べる：ライセンス、著作権者、バージョン、出典の URL、商用利用の可否。公式の配布物（パッケージ同梱の LICENSE、公式サイトの利用条件）で確かめる。
2. AI が `registry.yaml` に項目を書く。このとき `verified_by`・`verified_at` は空にする（照合スクリプトは未確認として不合格にする）。
3. `distributed` の素材は、AI が実体を `assets/` に置き（または取得元のパッケージを書き）、sha256 を `registry.yaml` に書く。部品から埋め込むときは `data-asset-id="<id>:<名前>"` を付ける。
4. AI が人間に、追加した項目と調べた根拠（出典の URL、LICENSE の該当箇所）を示して承認を求める。
5. 人間が承認したら、AI が `verified_by`（承認した人）・`verified_at`（承認した日）・`verification`（何を承認したか）を書く。**人間の承認の言葉がない限り、AI はこの3つを書かない。**
6. 条件付き（`conditional`）のライセンスは、人間が使うかどうかを個別に判断する。AI は判断の材料（守る条件）を `conditions` に書いて示す。

## 5. デッキの素材（画像・アイコン）

アイコンは、まず `registry.yaml` に登録したアイコン集（Phosphor、id: phosphor）から AI が選ぶ（`html-build/components.md` 4.4）。登録済みなので、この章の手順は要らない。

写真、画面の写し、アイコン集にないアイコンなど、デッキごとに違う素材は `registry.yaml` に登録しない（固定ファイルをデッキのたびに変えないため）。代わりに次のように扱う。

1. **人間が用意する**：素材は人間が入手し、`decks/<deck-id>/inputs/` に置く。AI はネットから素材を取ってこない（配布元が直リンクや自動の取得を禁じていることが多いため）。
2. **出どころを outline.md に書く**：`outline.md` の先頭の `assets` に、素材ごとに `src`（`inputs/…`）・`credit`（作者や配布元）・`license`（利用規約の名前や「自組織で撮影」など）・`url`（任意。利用規約のページ）を書く。書き方は `slide-outline/outline-template.md`。
3. **人間が確かめる**：`assets` は `outline.md` の一部なので、構成とファクトチェックの承認（`outline.md` と `factcheck.md` の承認）で人間が見る。商用・改変・クレジットの要否などの利用条件を確かめるのは人間。AI は、利用規約を読んだ範囲で分かったことを伝える。
4. **ビルドが照合する**：部品は素材に `data-deck-asset="<src>"` を付けて埋め込む。走査は、`assets` にない素材が入っていたらエラーにする。credits スライドには、出どころとライセンスが同じものごとに1行で載せる（全文は入れない）。

- `assets` の `license` は SPDX の ID でなくてよい。1章の許可の一覧とは照らさない（判断は人間）。
- 再配布が禁じられた素材（多くの無料アイコンのサイト）は、ハーネスのリポジトリ（公開）にも `examples/` にも入れない。private のスライド用リポジトリの `decks/` に置くのは、本人が使うためなので再配布にあたらないと考える（推測。規約に GitHub の扱いの記述はない）。
- 独自の表現（`html:`）に画像やアイコンを埋め込まない。画像は `image` の部品、カードのアイコンは `grid-4` の `icon` で使う。

## 6. 出典

- SPDX License List：https://spdx.org/licenses/
- SPDX の `LicenseRef-` の書き方（SPDX Specification 2.3.1、Other licensing information detected）：https://spdx.github.io/spdx-spec/v2.3.1/other-licensing-information-detected/
- PDL1.0 に SPDX の ID がないことは、SPDX License List の一覧を見た範囲での判断（`PDDL-1.0` は別のライセンス）
- SIL Open Font License 1.1（条件2：著作権表示とライセンスを配布物に含める）：https://openfontlicense.org/open-font-license-official-text/
- 公共データ利用規約（第1.0版）：https://www.digital.go.jp/resources/open_data/public_data_license_v1.0
- Natural Earth の利用条件（パブリックドメイン）：https://www.naturalearthdata.com/about/terms-of-use/
