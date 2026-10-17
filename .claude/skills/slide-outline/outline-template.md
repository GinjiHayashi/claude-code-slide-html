# outline.md の書き方（outline-template）

`outline.md` は、スライドの元ファイル（ソース）の**ただ1つの**ファイル。`deck.html` はここからビルドで作るので、手で直さない。直すときは、`outline.md` の該当スライドの節だけを読んで書き換える（`deck.html` は読まない。要求文書 11章）。

ビルドの前に `html-build/scripts/check-outline.mjs` が書式を検査する。エラーがあればビルドを止め、注意は報告して人間の確認で見る。

## 1. 全体の形

```markdown
---
deck_id: 2026-10-17-report-automation   # YYYY-MM-DD-<短い英語名>。decks/ のフォルダ名と同じ
title: 月次レポート作成の自動化           # デッキの題名（ブラウザのタブに出る）
pdf: false                              # PDF も書き出すか（ヒアリングで決める）
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
| `notes` | 発表者ノート。スライドには出ない |
| `claims` | このスライドの主張の ID。`[C-001, C-002]` の形（`research.md`・`factcheck.md` と同じ ID） |
| `html` | 独自の表現。部品で表しにくいときだけ使う（`html-build/components.md` 4.1） |
| `breadcrumb` | タイトルの上の章の名前。**書かなければ「CHAPTER 01: 章の名前」（前の `section`）が自動で入る** |
| `lead` | 説明文。タイトルの下の決まった位置に置く平文（2〜3行）。**本文のある型（下の表で「本文」と書いた型）では必須**。要らないスライドだけ `lead: false` と書く。3行まで（長いときはビルドが幅を広げて3行に収める。全角およそ210字を超えるとエラー） |

## 3. 型ごとの項目

上限の「字」は全角で数える（半角は 0.5）。文字数は目安で、最後はビルド時にブラウザで実際の行数を測る。

| 型 | 必須 | 任意 | 書き方 |
|---|---|---|---|
| `title` | title, date | subtitle, author | title は2行まで（1行 22字）。author は `{org: 所属, name: 氏名}`（片方でもよい。両方なら2行）。日付と発表者は構成のときに人間に聞く |
| `toc` | — | title | 項目は書かない。後ろの `section` の title から自動で作る。7章以上は2列。12章まで |
| `section` | title | description, topics | title は 16字。topics は箇条書き 3〜6項目（各 20字）。章番号と進み具合の点は自動 |
| `title-body` | title, body | breadcrumb, source | body は箇条書き 1〜5項目（各 110字） |
| `text-diagram` | title, body ＋ 図 | breadcrumb, caption, source | body は 1〜4項目（各 68字）。図は右に置く |
| `title-diagram` | title ＋ 図 | breadcrumb, caption, source | 図は `diagram`（1つ）か `diagrams`（左右に2つ） |
| `two-column` | title, left, right | breadcrumb, source | left・right は `{heading: 小見出し, items: [箇条書き 1〜4項目]}` |
| `do-dont` | title, do, dont | breadcrumb | do・dont は two-column と同じ形 |
| `grid-4` | title, items | breadcrumb | items はちょうど4つ。各 `{heading: 15字まで, text: 3行まで, icon: 任意}` |
| `checklist` | title, items | breadcrumb | items は 1〜8項目。各 `{text: 項目, done: true か false}` |
| `closing` | — | contact, email | 問い合わせ先とメール。構成のときに人間に聞き、なければ書かない |

「図」は `diagram`・`diagrams`・`html` のどれか1つ。

「本文」の型（`lead` が必須）：title-body・text-diagram・title-diagram・two-column・do-dont・grid-4・checklist。

## 4. 図（diagram）

```yaml
- diagram:
    kind: line            # diagram-catalog.md の型の名前
    unit: 人              # 以下、その型が求める項目（html-build/components.md 3章）
    x: [4月, 5月, 6月]
    series:
      - {name: 今年度, values: [8200, 8600, 9100]}
```

- 2つ並べるときは `diagrams:` に2つ書く。kpi を左に縦に積み、棒グラフを右に置く形（案B）は、`diagrams` の1つ目に kpi を書く。
- 1枚の図は2つまで。kpi は図として数えない（`components.md` 4章）。
- 強調する値（`callout`、kpi の値）も outline に書く。部品は計算しない（承認とファクトチェックの対象にするため）。

## 5. 文章

- 特に伝えたい語句は `**語句**` で太字にする。1項目に1か所、1枚に3か所まで（`components.md` 4.2）。
- タイトルは結論を1文で書く（`design-reference`）。
- 説明文（`lead`）は、タイトルを補う2〜3行の平文。図や箇条書きの内容を繰り返さず、何を見てほしいかを書く。
