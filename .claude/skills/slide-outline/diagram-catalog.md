# 図の型の一覧（diagram-catalog）

`outline.md` の `diagram:` には、この一覧の型の名前（`kind:`）と、その型が求める項目だけを書く（D3）。運用時は固定で、スライドごとに型を足したり変えたりしない。合う型がなければ近い型で代替し、`build-log.md` に記録して人間に報告する（9.1）。

- 図はすべてビルド時に描き、HTML に埋め込む（10.2）。表示するときに何も読み込まない（D8）。
- グラフの選び方と描き方の考え方は `design-reference/charts.md`。この一覧は、それを型に落としたもの。
- 図を置ける大きさは、スライドの型で決まる（`layout-catalog.md`）。`title-diagram` は幅 1172×高さ 500、`text-diagram` の右側は幅 572×高さ 500。

## 1. すべての型に共通すること

| 項目 | 決まり |
|---|---|
| 色 | `theme.css` のトークンだけを使う。注目させたいもの（`highlight: true`）だけ `primary` の青、ほかは `gray-400` など灰色 |
| 色数 | 1つの図で5色まで。緑と赤は、良し悪しの意味があるときだけ |
| 強調表示 | 大きな数字で示す値（「1/7」「+12%」など）は `callout: {value, label}` に書く。部品は計算しない（承認とファクトチェックの対象にするため。7.2） |
| 単位 | 数量を扱う型では `unit:` を必須にする |
| 出典・時点 | 図の中には書かず、スライドの `source:` に書く |
| 文字 | 図の中の文字は `text-caption`（12px）以上。ラベルは全角12字までを目安にし、超えるならデータの名前を短くする |
| 区別 | 色だけで区別しない。線の種類、印の形、ラベルの直接表示も使う |

## 2. 型の一覧

描き方の欄：**CSS** は HTML/CSS（Tailwind）の部品、**SVG** は HTML/SVG の部品（座標はビルド時に d3-scale・d3-shape で計算）、**Mermaid** はビルド時に SVG に変換。

### 2.1 データ

| 型（kind） | 用途 | 必須の項目 | 任意の項目 | 制約 | 描き方 |
|---|---|---|---|---|---|
| `kpi` | 結論の数字を大きく見せる | items（value, label） | unit, compare（「前年比 +12%」など）, trend（直近の値の並び。小さな折れ線で示す） | 1〜4個を横に並べる | CSS（trend は SVG） |
| `bar` | 分類ごとの量を比べる（縦棒） | data（label, value）, unit | highlight, callout | 2〜12本。原点は0 | CSS |
| `hbar` | 項目名が長い比較、順位（横棒） | data（label, value）, unit | highlight, callout | 2〜10本。大きい順に並べる | CSS |
| `stacked-bar` | 量と内訳を同時に見せる | categories, series（name, values）, unit | percent（true で 100% 積み上げ）, callout | 系列は5まで、分類は8まで | CSS |
| `line` | 時間の変化と傾向 | x（時点の並び）, series（name, values）, unit | highlight, target（目標値。点線）, callout | 系列は4まで、時点は24まで。系列名は線の右端に直接書く | SVG |
| `area` | 量と構成比の時間の変化 | x, series（name, values）, unit | percent, callout | 系列は5まで。系列名は面の右端に書く | SVG |
| `combo` | 量（棒）と推移（線）を同時に | x, bar（name, values, unit）, line（name, values, unit） | callout | 棒と線を1系列ずつ。軸は左右に分ける | SVG |
| `donut` | 全体が明らかなときの構成比 | items（label, value）, unit | total（中央に書く値）, callout | 5項目まで（超える分は「その他」）。12時から時計回りに大きい順。多くの場合は `hbar` の方が正確に伝わる | SVG |
| `scatter` | 2つの量の関係 | points（x, y, label?）, x_unit, y_unit | highlight | 点は50まで。ラベルは注目する点だけ | SVG |
| `table` | 正確な値を一覧で読ませる | columns, rows | highlight（行の番号）, align（列ごと） | 8行×6列まで。数値は右寄せ。見出し行は `primary` の塗りに白文字 | CSS |

### 2.2 構造・時間

| 型（kind） | 用途 | 必須の項目 | 任意の項目 | 制約 | 描き方 |
|---|---|---|---|---|---|
| `flow` | 物やデータの流れ（一列） | nodes（label, type?） | caption（各箱の下の説明） | 2〜6個を左から右へ。分岐・合流があるなら `mermaid` | CSS |
| `steps` | 順番に行う手順 | items（title, text?） | highlight（今いる段） | 3〜5段。番号を付ける | CSS |
| `timeline` | 出来事を時間順に | items（date, label, text?） | highlight | 3〜6個 | CSS |
| `roadmap` | 期間のある計画 | periods（列の見出し）, lanes（name, items: start, end, label） | highlight | 期間は8列まで、レーンは4まで | CSS |
| `mermaid` | 分岐・合流の多いフロー、ER 図、シーケンス図、状態遷移図 | source（Mermaid の記法） | — | ノードは15まで（超えるならスライドを分ける）。色はトークンに合わせたテーマで描く | Mermaid |

### 2.3 概念

| 型（kind） | 用途 | 必須の項目 | 任意の項目 | 制約 | 描き方 |
|---|---|---|---|---|---|
| `matrix` | 2つの軸で4つに分ける | x_axis（low, high）, y_axis（low, high）, cells（4つ: title, items?） | highlight（どのマス） | 各マスの項目は3つまで | CSS |
| `pyramid` | 土台から上へ積み上がる関係 | levels（label, text?） | highlight | 3〜5段。上が頂点 | CSS |
| `tree` | 階層（組織、分類） | root, children（label, children?） | highlight | 3階層まで。1つの親の子は5まで | CSS |
| `compare` | 選択肢を観点ごとに比べる | options（2〜3）, criteria（観点）, values（◯・△・× または短い文） | recommend（推奨する選択肢） | 観点は6まで。推奨の列を淡い青で塗る | CSS |

## 3. 図の中で使える補助

| 補助 | 使い方 | 描き方 |
|---|---|---|
| アイコン | `icon: 名前` で Lucide のアイコンを置く。`grid-4` の項目、`steps` や `flow` の箱に使う | SVG をそのまま埋め込む |
| 数式 | `math: 式`（TeX の記法）。必要な場合だけ | KaTeX でビルド時に変換 |

アイコン・Mermaid・d3・KaTeX は、license-notice の許可済み一覧に載っているものだけを使う（D9）。

## 4. 型を選ぶ目安

- 数字1つで結論が言える → `kpi`
- 分類で比べる → `bar`。項目名が長い・順位 → `hbar`。内訳も見せる → `stacked-bar`
- 時間で変化する → `line`。構成比の変化も見せる → `area`。件数と率のように単位が違う2つ → `combo`
- 正確な値を読ませる → `table`
- 選択肢の比較 → `compare`。2つの軸で整理 → `matrix`
- 流れ → `flow`（一列）か `mermaid`（分岐あり）。手順 → `steps`。日付がある → `timeline`、期間がある → `roadmap`

## 5. まだ型にしていないもの（候補）

| 候補 | 今は入れない理由 |
|---|---|
| 地図（コロプレス） | 地図データのライセンスと容量の確認が要る |
| ヒートマップ | `table` の塗りで代わりができる（推測） |
| ベン図 | `matrix` か `compare` で代わりができる（推測） |

---

出典：型の分類と描き方は要求文書 10.1・10.2、グラフの選び方と描き方は `design-reference/charts.md`（デジタル庁「ダッシュボードデザインの実践ガイドブック」を要約・読み替えたもの）にもとづく。数の上限（本数・系列数・行数など）は、図を置ける大きさから決めた仮の値で、4-5 の試作で見直す。
