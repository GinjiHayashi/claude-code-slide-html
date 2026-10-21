# outline.md の書き方（outline-template）

`outline.md` は、スライドの元ファイル（ソース）の**ただ1つの**ファイル。`deck.html` はここからビルドで作るので、手で直さない。直すときは、`outline.md` の該当スライドの節だけを読んで書き換える（`deck.html` は読まない）。

ビルドの前に `html-build/scripts/check-outline.mjs` が書式を検査する。エラーがあればビルドを止め、注意は報告して人間の確認で見る。

## 1. 全体の形

```markdown
---
deck_id: 2026-10-17-report-automation   # YYYY-MM-DD-<短い英語名>。decks/ のフォルダ名と同じ
title: 月次レポート作成の自動化           # デッキの題名（ブラウザのタブに出る）
pdf: false                              # PDF も書き出すか（brief.md から写す）
assets:                                 # 写真などを使うときだけ。人間が inputs/ に置いたもの（license-notice/policy.md 5章）。アイコン集のアイコンは書かない
  - {src: inputs/screen.png, credit: 自組織で撮影, license: 自組織の素材}
---

## S01
- layout: title
- title: |
    月次レポート作成の自動化
    試行の結果と全体展開の提案
- subtitle: 2部門での3か月の試行をもとに、全部門への展開を提案します
- date: 2026年10月17日
- author: {org: データ活用推進本部　データ管理部, name: 山田 太郎}

## S02
- layout: title-diagram
- title: 作成時間は現状の 1/7 になる見込み
- claims: [C-001]
- diagram:
    kind: bar
    unit: 時間／月
    data:
      - {label: 現状, value: 40}
      - {label: 導入後, value: 6, highlight: true}
- source: 出典：〇〇調査（2026年9月時点）
- notes: |
    左の棒が現状、右が導入後。
```

- 1枚は「`## S01`」の見出しから次の見出しまで。番号は並び順に S01、S02…と付ける。
- 見出しの下は、`- 項目: 値` の箇条書き（YAML）。複数行の文は `|` のあとに字下げして書く。
- 文字に `:` や `#` を含むときは `"…"` で囲む（YAML の決まり）。

## 2. どの型でも書ける項目

| 項目 | 中身 |
|---|---|
| `layout` | **必須**。型の名前（`layout-catalog.md`） |
| `id` | 任意。スライドの安定した名前（英小文字・数字・ハイフン。例：`tdd-intro`）。スライドを足したり並べ替えたりして番号（`## S41`）が変わっても、承認のときのスライドと対応づけるのに使う。書かなければ文で対応づける。デッキの中で重複させない。スライドには出ない |
| `notes` | 発表者ノート。スライドには出ない |
| `claims` | このスライドの主張の ID。`[C-001, C-002]` の形（`research.md`・`factcheck.md` と同じ ID）。書式チェックが、同じフォルダの `research.md` にある主張か（使わなくなった主張でないか）を確かめる |
| `html` | 独自の表現。`match` が「意味が欠ける」「描けない」のときに使う（`html-build/components.md` 4.1）。スクリプト（script タグ・on〜 属性・javascript:）は書けない（エラー） |
| `idea` | 図のイメージ。図のあるスライドに書く。見せたい絵を1〜3行で（何が並び、何と何がどうつながり、どこを見てほしいか）。部品の名前は書かない。スライドには出ない（下の 4章） |
| `match` | `idea` の絵を部品で描けるか。`そのまま`・`意味が欠ける：<何が欠けるか>`・`描けない：<なぜか>` のどれか（下の 4章） |
| `breadcrumb` | タイトルの上の章の名前。本文のある型だけ（`title`・`toc`・`section`・`closing` には書けない）。**書かなければ「CHAPTER 01: 章の名前」（前の `section`）が自動で入る** |
| `lead` | 説明文。タイトルの下の決まった位置に置く平文（2〜3行）。**本文のある型（schema.mjs で lead が必須と出る型）では必須**。書き方と字数の目安は5章。要らないスライドだけ `lead: false` と書く |
| `lead_short` | 表や大きな図のために lead を目安より短くするときの理由（例：`lead_short: 表が大きいため`）。書くと、短い lead の注意が出ない |

## 3. 型ごとの項目

型ごとに書ける項目（必須・任意）と、文字数・項目数の目安は `node .claude/skills/html-build/scripts/schema.mjs [型の名前]` で出す（正は `html-build/scripts/spec.mjs`）。

- 字数は全角で数える（半角は 0.5）。目安を超えると注意になり、最後はビルド時にブラウザで実際の行数を測る。
- 「図」は `diagram`・`diagrams`・`html` のどれか1つ。
- 表紙の日付と発表者、締めの問い合わせ先とメールは brief.md から写す（「なし」なら書かない）。

## 4. 図（diagram）

図は、部品を選ぶ前に `idea` で絵を決める。部品の一覧から考え始めると、どのスライドも同じ形（箱と矢印、表）になるため。lead 以外の本文は、できるだけ図で表す（`design-reference/principles.md` 5章）。

`idea` には、絵のほかに次を書く。部品を選ぶ手がかりになる（選び方は `diagram-catalog.md` 4章）。

- 順序があるか（時間や手順の順か、同じ重さの項目を並べるだけか）
- 循環か、層か、1対多の接続か、包含か
- 何と何の関係を見せるか（原因と結果、比較、前と後など）
- 図が表す関係を、囲みの見出しで示すか（例：「AI の性質（原因）」と「手当てをしないと起きること」。箱を並べるだけの図にしない。`design-reference/principles.md` 6章）

```yaml
- idea: コミットが1本の線の上に並び、途中から枝が分かれて、あとで main に戻る。枝の上のコミットだけを青にする
- match: 意味が欠ける：flowchart では箱と矢印になり、同じ線の上にコミットが並ぶ形が消える
- diagram:
    kind: canvas          # 形を格子（既定 12列×6行）の上に置く。形の一覧は diagram-catalog.md 6章
    shapes:
      - {type: dot, id: c1, at: [1, 2], text: main}
      - {type: dot, id: c2, at: [4, 2]}
      - {type: dot, id: f1, at: [6, 4], tone: primary, text: feature}
      - {type: dot, id: c3, at: [9, 2]}
      - {type: line, from: c1, to: c3, arrow: none}
      - {type: line, from: c2, to: c3, via: [[6, 4]], arrow: none, tone: primary}
```

| match | 意味 | 描き方 |
|---|---|---|
| `そのまま` | 部品で `idea` のとおりに描ける | 部品（`diagram`）を使う |
| `意味が欠ける：…` | 部品で描けるが、`idea` の大事な点が消える | 自由図（`kind: canvas`）で描く。`canvas` でも描けないときだけ独自に描く（`html`） |
| `描けない：…` | 合う部品がない | 同上 |

- 「意味が欠ける」は、部品に当てはめたときに何が消えるかを具体的に書く（形、並び、つながり、強調したいところ）。「見た目が単調」だけでは理由にしない。
- 書式チェックが、`match` の書き方の誤りをエラー、`idea`・`match` がない、`match` と描き方が合わない（「そのまま」なのに `html`、「意味が欠ける」なのに部品）を注意にする。
- 人間は構成の承認のときに `idea` と `match` を見て、描き方を判断できる。

```yaml
- diagram:
    kind: line            # diagram-catalog.md の型の名前
    unit: 人              # 以下、その型の項目（schema.mjs <kind> で出す）
    x: [4月, 5月, 6月]
    series:
      - {name: 今年度, values: [8200, 8600, 9100]}
```

- 2つ並べるときは `diagrams:` に2つ書く。kpi を左に縦に積み、棒グラフを右に置く形は、`diagrams` の1つ目に kpi を書く。
- 1枚の図は2つまで。kpi は図として数えない（`components.md` 4章）。
- 強調する値（`callout`、kpi の値）も outline に書く。部品は計算しない（承認とファクトチェックの対象にするため）。

## 4.1 画像とアイコン

- アイコンは、アイコン集から `node .claude/skills/html-build/scripts/icons.mjs <英語の語>` で探し、`phosphor:<名前>` と書く（`assets` には書かない）。
- 写真・画面の写しなど、人間が用意する素材は、先頭の `assets` に書いたものだけ使える。`src`・`credit`・`license` は必須、`url` は任意。出どころとライセンスは人間に聞いて書き、推測で書かない。
- 画像は `diagram: {kind: image, src: inputs/screen.png, alt: 何が写っているか}`。`grid-4` のカードの印は items に `icon: phosphor:check-circle`。大きなアイコンは `diagram: {kind: image, src: phosphor:users, alt: …}`。
- 書式チェックが、ファイルがあるか、`assets` にあるか、使っていない素材がないかを確かめる。
- 自由図（`canvas`）の中のアイコンの大きさは2つだけ：単体で置くときは 64px（`canvas` の `icon`）、文字の横に添えるときは 24px（`canvas` の `box`・`area` の `icon`）。色は黒・紺・灰色・白だけ。

## 5. 文章

- 箇条書きは、図で表せないときだけ使う。使うときは1項目で意味が通る長さにする（`design-reference/principles.md` 5章）。
- 箇条書きは2段まで。項目のすぐ後ろに文字の並び（`[…, …]`）を書くと下の段になる。番号を付けるときは `numbered: true`（`layout-catalog.md` 3.3）。
- 特に伝えたい語句は `**語句**` で太字にする。数の目安は `schema.mjs` の「共通」（`components.md` 4.2）。
- 説明文（`lead`）の `**語句**` は青の太字になる。結論の語句・数値・図のどこを見るかを、目安2か所（0〜3か所）囲む。文ごとではなく語句を囲み、強調だけを拾い読みして要点がわかるようにする（`components.md` 4.2）。
- 関数名・コマンド・ファイル名などの短いコードは `` `…` `` で囲む。複数行のコードは `code` の図にする（`components.md` 4.3）。
- タイトルは結論を1文で書く（`design-reference`）。
- 専門用語・比喩・実装の紹介は、聞き手に合わせる（`design-reference/principles.md` 6章）。初学者がいるときは、初めて出る専門用語を lead か図の中で説明する。資料の比喩はそのまま写さず、正確な言葉に直す。
- 説明文（`lead`）は、タイトルを補い、図の読み方とそのスライドで言いたいことを2〜3文で書く。図や箇条書きの内容をそのまま繰り返さない。字数の目安と上限は `schema.mjs` の「共通」（目安より短いと注意、3行を超えるとエラー）。表や大きな図のために短くするときは、`lead_short` に理由を書く。
- 発表者ノート（`notes`）は、話すときの補足の置き場。聞き手が読むべき情報を、lead や本文から `notes` に逃がさない。
