---
deck_id: 2026-10-20-regression
title: 回帰の確かめ
---

## S01
- layout: title
- title: 回帰の確かめ
- date: 2026年10月20日

## S02
- layout: title-body
- title: 短い lead と短い箇条書き
- lead: 最初の版では、lead を全角70字前後で書いていました。人間が想定していた長さの半分ほどで、図の読み方とそのスライドで言いたいことが伝わりませんでした。
- body:
    - 短すぎる項目
    - 箇条書きを使うときは、1項目で意味が通る長さの文を書く
    - 箇条書きの型が多すぎると、図が主役のデッキにならない

## S03
- layout: text-diagram
- title: 右に KPI を3つ置き、ラベルの長さを変える
- idea: 3つの数字を縦に積み、ラベルが1行と2行で混ざっても数字の上端がそろうかを見せる
- match: そのまま
- lead_short: 回帰の確かめのため
- lead: KPI を3つ縦に並べ、ラベルの長さを変えたときに、数字の上端がそろうかを見ます。
- body:
    - 最初の版では、狭い枠の KPI で数字と前年比がそろわなかった
    - ラベルが1行と2行で混ざると、数字の位置がずれやすい
- diagram:
    kind: kpi
    items:
      - {label: 作成時間, value: "6", unit: 時間／月, compare: 前年比 -85%}
      - {label: 月次レポートの作成にかかる問い合わせの件数, value: "12", unit: 件, compare: 前年比 -40%}
      - {label: 差し替え, value: "1", unit: 回, compare: 前年比 -75%, highlight: true}

## S04
- layout: title-diagram
- title: 順序のない項目に steps を使う
- idea: 順序なし。同じ重さの3つの取り組みを並べて見せる
- match: そのまま
- lead_short: 回帰の確かめのため
- lead: 3つの取り組みには順序がありません。最初の版では、こうした並びに番号つきの流れを使っていました。
- diagram:
    kind: steps
    items:
      - {title: 入力の画面をそろえる}
      - {title: 集計を自動にする}
      - {title: 問い合わせの窓口を一つにする}

## S05
- layout: title-diagram
- title: 箱の幅より長い文字を入れた自由図
- idea: 2つの箱を矢印でつなぎ、左の箱には箱の幅より長い文を入れる
- match: 意味が欠ける：箱の大きさを決めて、はみ出しの検査を確かめるため
- lead_short: 回帰の確かめのため
- lead: 自由図の箱に、箱の幅より長い文字を入れたときに、検査が箱からのはみ出しを見つけるかを確かめます。
- diagram:
    kind: canvas
    grid: [12, 4]
    shapes:
      - {type: box, id: a, at: [0, 1], size: [2, 1], text: 箱の幅よりずっと長い文字を入れた箱です}
      - {type: box, id: b, at: [8, 1], size: [4, 1], text: 普通の箱}
      - {type: line, from: a, to: b}

## S06
- layout: title-diagram
- title: 縦の steps と table を並べる
- idea: 左に順序のある3つの手順、右に設定値の一覧を並べ、上端をそろえる
- match: そのまま
- lead_short: 回帰の確かめのため
- lead: 左に縦の手順、右に設定値の表を並べたときに、2つの図の上端がそろうかを確かめます。
- diagrams:
    - kind: steps
      direction: down
      items:
        - {title: 入力する}
        - {title: 集計する}
        - {title: 配布する}
    - kind: table
      columns: [項目, 値]
      rows:
        - [締め日, 毎月5日]
        - [配布日, 毎月10日]

## S07
- layout: two-column
- title: 箇条書きの型を増やす
- lead_short: 回帰の確かめのため
- lead: 箇条書きの型が、本文のあるスライドの3割を超えたときに注意が出るかを確かめます。
- left:
    heading: 左
    items: [箇条書きの型が多いと、図が主役のデッキにならない]
- right:
    heading: 右
    items: [文字を減らすとは、箇条書きを図に替えることである]
