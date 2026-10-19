---
deck_id: 2026-10-17-report-automation
title: 月次レポート作成の自動化
pdf: true
assets:
  - {src: inputs/screen-entry.png, credit: 見本のために作成した画面の例, license: 自作（見本用）}
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
- layout: toc

## S03
- layout: section
- title: 現状と課題
- description: 今の月次レポートの作り方と、そこにかかる時間、問い合わせと手戻りの状況を説明します。
- topics: [月次レポートの作り方, 作成にかかる時間, 問い合わせと手戻り]

## S04
- layout: title-body
- title: 月次レポートの作成に時間がかかっている
- lead: false
- body:
    - 各部門が毎月の実績を表にまとめ、本部が手で貼り合わせて1つのレポートにしている
    - 作成には毎月 **約40時間** かかり、締め日の前後に作業が集中する
    - 部門ごとに表の形が違うため、貼り合わせのたびに確認と手直しが必要になる
    - 数字の誤りに気づくのが配布の後になり、問い合わせと差し替えが毎月発生している

## S05
- layout: text-diagram
- title: 作成時間の内訳
- idea: 6つの部署の作成時間を長さで並べ、窓口サービスだけが飛び抜けて長いことを一目で見せる
- match: そのまま
- lead: 作成時間の内訳を部署ごとに調べました。**窓口サービス**が最も長く、全体の3割を占めています。
- body:
    - 6つの部署で合計 **40時間／月** かかっている
    - 最も長いのは窓口サービスで、扱う手続きの種類が多いため
    - 本部の貼り合わせだけでも6時間かかっている
- diagram:
    kind: hbar
    unit: 時間／月
    data:
      - {label: 総務, value: 6}
      - {label: 企画, value: 5}
      - {label: 窓口サービス, value: 12, highlight: true}
      - {label: 情報システム, value: 4}
      - {label: 地域連携, value: 7}
      - {label: 本部（貼り合わせ）, value: 6}
- source: 出典：架空のデータ（見本用）。2026年9月時点

## S06
- layout: title-diagram
- title: 今の作成手順
- idea: 部門の表が本部に集まり、手で貼り合わせ、確認して配布するまでの一列の流れ。貼り合わせの工程だけを目立たせる
- match: そのまま
- lead: 月次レポートは、各部門が作った表を本部が手で貼り合わせて作っています。部門ごとに表の形が違うため、**貼り合わせの工程に最も時間がかかって**います。確認は前月の数字と見比べて行うため、誤りに気づくのが配布の後になることがあります。新しい手順では、この2つの工程をなくし、入力の時点で誤りを知らせます。
- diagram:
    kind: flowchart
    highlight: [手で貼り合わせる]
    nodes:
      - {label: 各部門の表, type: store, caption: 部門ごとに形が違う}
      - {label: メールで集める, caption: 締め日に本部へ送る}
      - {label: 手で貼り合わせる, caption: 形をそろえて1つにする}
      - {label: 確認, caption: 前月と比べて誤りを探す}
      - {label: 配布, caption: PDF にして全部門へ}

## S07
- layout: section
- title: 試行の結果
- description: 2部門で3か月、新しい手順を試しました。作成時間の変化と、利用者の声を説明します。
- topics: [試行した部門と期間, 作成時間の変化, 利用者の声]

## S08
- layout: title-diagram
- title: 作成時間は現状の 1/7 になる見込み
- idea: 結論の「6時間」を大きな数字で左に置き、右に現状・試行・導入後の3本の棒で減り方を見せる
- match: そのまま
- lead: 2部門で3か月試した結果、作成時間は月40時間から12時間に減りました。全部門に広げると、**6時間**まで減る見込みです。
- claims: [C-001]
- diagrams:
    - kind: kpi
      items:
        - {label: 作成時間, value: "6", unit: 時間／月, compare: 現状の 1/7, highlight: true}
    - kind: bar
      unit: 時間／月
      data:
        - {label: 現状, value: 40}
        - {label: 導入後（試行）, value: 12}
        - {label: 導入後, value: 6, highlight: true}
- source: 出典：架空のデータ（見本用）。2026年9月時点

## S09
- layout: two-column
- title: 試行の前と後
- lead: 試行では、入力の画面をそろえ、集計とグラフを自動で作るようにしました。
- left:
    heading: 試行の前
    items: [部門ごとに表の形が違う, 本部が手で貼り合わせる, 作成に **40時間／月**]
- right:
    heading: 試行の後
    items: [全部門が同じ入力の画面を使う, 集計とグラフは自動で作られる, 作成に **6時間／月**]

## S10
- layout: text-diagram
- title: 入力の画面を全部門でそろえた
- idea: 実際の入力の画面の写しを見せ、前月との差が大きい数字に印が付く様子がわかるようにする
- match: そのまま
- lead: 試行では、すべての部門が同じ入力の画面を使いました。前月との差が大きい数字は、その場で知らせます。
- body:
    - 指標の名前と並びを、全部門で同じにした
    - 前月の値を横に出し、**差が大きい数字**に印を付ける
    - 保存すると、本部の集計にそのまま入る
- diagram:
    kind: image
    src: inputs/screen-entry.png
    alt: 月次実績の入力の画面。問い合わせ件数の行に「前月の2倍」と印が付いている
    fit: contain

## S11
- layout: text-diagram
- title: 集計は短いスクリプトで自動にした
- idea: 集計のスクリプトの中身をそのまま見せ、読み込み・合計・知らせるの3つの処理があることを見せる
- match: そのまま
- lead: 部門の表を読み込んで合計する処理を、`monthly.py` にまとめました。毎月の作業は、このスクリプトを実行するだけです。
- body:
    - 部門の表は `inputs/` に置くだけで読み込まれる
    - 合計とグラフの元になる表を、**1回の実行**で作る
    - 前月との差が大きい数字は、実行のときに知らせる
- diagram:
    kind: code
    lang: python
    file: monthly.py
    code: |
      import pandas as pd

      # 部門ごとの表を読み込んで、1つにまとめる
      def load(paths: list[str]) -> pd.DataFrame:
          frames = [pd.read_excel(p) for p in paths]
          return pd.concat(frames, ignore_index=True)

      def summarize(df: pd.DataFrame) -> pd.DataFrame:
          total = df.groupby("部門")["時間"].sum()
          return total.reset_index()

## S12
- layout: grid-4
- title: 展開の4つの原則
- lead: 全部門に広げるときは、次の4つを守ります。
- items:
    - {heading: 入力は1回だけ, icon: phosphor:pencil-line, text: 同じ数字を2回入力しない。部門の表をそのまま取り込む}
    - {heading: 定義をそろえる, icon: phosphor:file-text, text: 指標の名前と計算のしかたを、全部門で同じにする}
    - {heading: 自動で確かめる, icon: phosphor:shield-check, text: 前月との差が大きい数字は、入力のときに知らせる}
    - {heading: 小さく始める, icon: phosphor:steps, text: 部門ごとに順に広げ、問題があれば手順を直す}

## S13
- layout: do-dont
- title: レポートの書き方
- lead: レポートの作り方をそろえるため、書き方の良い例と悪い例を示します。
- do:
    heading: 良い例
    items: [結論を **タイトルに1文で** 書く, 強調する数字は1つに絞る, グラフに出典と時点を書く]
- dont:
    heading: 悪い例
    items: [タイトルが「月次の実績」だけ, すべての棒を色分けしている, 出典と時点がない]

## S14
- layout: checklist
- title: 公開前の確認
- lead: レポートを配る前に、次の6項目を確かめます。
- items:
    - {text: 出典と時点をすべてのグラフに書いた, done: true}
    - {text: 数値を元の表と照らし合わせた, done: true}
    - {text: 強調する値は1つに絞った, done: true}
    - {text: 色だけで区別していない, done: false}
    - {text: 文字は 12px 以上にした, done: false}
    - {text: 発表者ノートを書いた, done: false}

## S15
- layout: closing
- contact: 問い合わせ先：データ活用推進本部　データ管理部
- email: data@example.jp
