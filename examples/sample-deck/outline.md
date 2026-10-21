---
deck_id: 2026-10-17-report-automation
title: 月次レポート作成の自動化
pdf: true
assets:
  - {src: assets/screen-entry.png, credit: 見本のために作成した画面の例, license: 自作（見本用）}
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
- layout: grid-4
- question: なぜ月次レポートを見直すのか
- title: 月次レポートの作成に時間がかかっている
- lead: false
- items:
    - {heading: 手で貼り合わせる, icon: phosphor:copy, text: 各部門が毎月の実績を表にまとめ、本部が手で貼り合わせて1つのレポートにしている}
    - {heading: 締め日に作業が集中する, icon: phosphor:calendar, text: 部門の表が締め日にそろうため、その前後に本部の作業が集中する}
    - {heading: 表の形が部門ごとに違う, icon: phosphor:table, text: 貼り合わせのたびに、列の並びや指標の名前を確かめて手直ししている}
    - {heading: 誤りに気づくのが遅い, icon: phosphor:warning, text: 数字の誤りに気づくのが配布の後になり、問い合わせと差し替えが毎月起きている}
- new: [K-001]

## S05
- layout: title-diagram
- question: 時間はどこにかかっているか
- title: 作成時間の内訳
- idea: 6つの部署の作成時間を長さで並べ、窓口サービスだけが飛び抜けて長いことを一目で見せる。合計の40時間は右上に大きく出す
- match: そのまま
- lead: 月次レポートの作成時間の内訳を、部署ごとに調べました。6つの部署の合計は**月40時間**で、**窓口サービス**が最も長く、全体の3割を占めています。扱う手続きの種類が多く、表を作り直す回数が多いためです。本部が部署の表を貼り合わせる作業だけでも、毎月6時間かかっています。下の図は、部署ごとの作成時間を並べたものです。
- diagram:
    kind: hbar
    unit: 時間／月
    callout: {value: 40時間, label: 6部署の合計（1か月）}
    data:
      - {label: 総務, value: 6}
      - {label: 企画, value: 5}
      - {label: 窓口サービス, value: 12, highlight: true}
      - {label: 情報システム, value: 4}
      - {label: 地域連携, value: 7}
      - {label: 本部（貼り合わせ）, value: 6}
- source: 出典：架空のデータ（見本用）。2026年9月時点
- uses: [K-001]

## S06
- layout: title-diagram
- question: なぜそこに時間がかかるのか
- title: 今の作成手順
- idea: 部門の表が本部に集まり、手で貼り合わせ、確認して配布するまでの一列の流れ。貼り合わせの工程だけを目立たせる
- match: そのまま
- lead: 月次レポートは、各部門が作った表を本部が手で貼り合わせて作っています。部門ごとに表の形が違うため、**貼り合わせの工程に最も時間がかかって**います。確認は前月の数字と見比べて行うため、**誤りに気づくのが配布の後**になることがあります。新しい手順では、この2つの工程をなくし、入力の時点で誤りを知らせます。
- diagram:
    kind: flowchart
    highlight: [手で貼り合わせる]
    nodes:
      - {label: 各部門の表, type: store, caption: 部門ごとに形が違う}
      - {label: メールで集める, caption: 締め日に本部へ送る}
      - {label: 手で貼り合わせる, caption: 形をそろえて1つにする}
      - {label: 確認, caption: 前月と比べて誤りを探す}
      - {label: 配布, caption: PDF にして全部門へ}
- new: [K-002]
- uses: [K-001]

## S07
- layout: section
- title: 試行の結果
- description: 2部門で3か月、新しい手順を試しました。作成時間の変化と、利用者の声を説明します。
- topics: [試行した部門と期間, 作成時間の変化, 利用者の声]

## S08
- layout: two-column
- question: 試行では何を変えたか
- title: 試行の前と後
- lead: 試行では、全部門が同じ入力の画面を使うようにし、集計とグラフを自動で作るようにしました。左が試行の前、右が試行の後の手順です。部門ごとに違っていた表の形がそろったため、本部での貼り合わせの作業がなくなり、作成にかかる時間が大きく減りました。2つを見比べて、なくなった作業を確かめてください。
- left:
    heading: 試行の前
    items: [部門ごとに表の形が違い、そのままでは集計できない, 本部が毎月、部門の表を手で貼り合わせている, 作成に合計で **40時間／月** かかっている]
- right:
    heading: 試行の後
    items: [全部門が同じ入力の画面を使い、表の形がそろう, 集計とグラフは、スクリプトが自動で作る, 作成にかかる時間は **6時間／月** の見込み]
- new: [K-003, K-004]
- uses: [K-002]

## S09
- layout: title-diagram
- question: 変えた結果、作成時間はどれだけ減ったか
- title: 作成時間は現状の 1/7 になる見込み
- idea: 結論の「6時間」を大きな数字で左に置き、右に現状・試行・導入後の3本の棒で減り方を見せる
- match: そのまま
- lead: 2部門で3か月試した結果、作成時間は月40時間から**12時間**に減りました。全部門に広げると、**6時間**まで減る見込みです。左の数字は全部門に広げたあとの見込みで、右の棒は、現状、試行、導入後の3つの時点の作成時間を並べたものです。棒の長さで、それぞれの時点の作成時間の減り方の大きさを比べてください。
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
- new: [K-005]
- uses: [K-001, K-003, K-004]

## S10
- layout: title-diagram
- question: 表の形はどうやってそろえたか
- title: 入力の画面を全部門でそろえた
- idea: 実際の入力の画面の写しを大きく見せ、前月との差が大きい数字に印が付く様子がわかるようにする
- match: そのまま
- lead: 試行では、すべての部門が同じ入力の画面を使いました。指標の名前と並びがそろったので、保存した数字は本部の集計にそのまま入ります。画面には前月の値を横に出し、**差が大きい数字**に印を付けて、入力したその場で知らせます。下は実際の画面で、印の付いた行が、前月から大きく変わったため知らせた数字です。
- diagram:
    kind: image
    src: assets/screen-entry.png
    alt: 月次実績の入力の画面。問い合わせ件数の行に「前月の2倍」と印が付いている
    fit: contain
- uses: [K-003]

## S11
- layout: text-diagram
- question: 集計はどうやって自動にしたか
- title: 集計は短いスクリプトで自動にした
- idea: 集計のスクリプトの中身をそのまま見せ、読み込み・合計・知らせるの3つの処理があることを見せる
- match: そのまま
- lead: 部門の表を読み込んで合計する処理を、`monthly.py` にまとめました。毎月の作業は、部門の表を決まった場所に置き、このスクリプトを実行するだけです。右は集計の処理の中身で、表を読み込む、部門ごとに合計する、結果を返すの3つの処理からできています。手で行っていた作業は、ここで置き換わります。
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
- uses: [K-004]

## S12
- layout: title-diagram
- question: 全部門に広げるときは何を守るか
- title: 展開の4つの原則
- idea: 試行から決めた4つの原則を同じ重さのカードで並べ、守る目的をまとめの帯で示す
- match: そのまま
- lead: 試行の結果を全部門に広げるときは、次の4つの原則を守ります。どれも、試行の中で問題になった点から決めたものです。入力の手間を増やさず、数字の定義をそろえ、誤りを早く見つけることで、本部の作業を増やさずに広げられるようにします。広げる順番は、部門ごとの準備に合わせて、本部と相談して決めます。
- diagram:
    kind: cards
    columns: 2
    items:
      - {heading: 入力は1回だけ, icon: phosphor:pencil-line, text: 同じ数字を2回入力しない。部門の表をそのまま取り込む}
      - {heading: 定義をそろえる, icon: phosphor:file-text, text: 指標の名前と計算のしかたを、全部門で同じにする}
      - {heading: 自動で確かめる, icon: phosphor:shield-check, text: 前月との差が大きい数字は、入力のときに知らせる}
      - {heading: 小さく始める, icon: phosphor:steps, text: 部門ごとに順に広げ、問題があれば手順を直す}
    summary: {text: 本部の作業を増やさずに、全部門へ広げる, tone: primary}
- new: [K-006, K-007]
- uses: [K-005]
- adept: [E, T]

## S13
- layout: do-dont
- question: レポートはどう書けばよいか
- title: レポートの書き方
- lead: 全部門のレポートの作り方をそろえるため、書き方の良い例と悪い例を並べました。左が良い例、右が悪い例です。どれも試行の中で実際に見つかった書き方で、悪い例のレポートは、読む人が結論や数字の出どころを探すのに時間がかかっていました。レポートを新しく作るときは、左の3つを必ず守ってください。
- do:
    heading: 良い例
    items: [結論を **タイトルに1文で** 書き、何の話かを先に伝える, 強調する数字は、1枚につき1つに絞る, すべてのグラフに、出典といつ時点の数字かを書く]
- dont:
    heading: 悪い例
    items: [タイトルが「月次の実績」だけで、結論がわからない, すべての棒を色分けし、どれを見ればよいかわからない, 出典と時点がなく、数字の出どころを確かめられない]
- new: [K-008]
- uses: [K-006]

## S14
- layout: checklist
- question: 配る前に何を確かめるか
- title: 公開前の確認
- lead: レポートを全部門に配る前に、作った人が次の6項目を確かめます。上の3つは数字と出典の確認で、下の3つは読みやすさの確認です。印の付いた項目は、試行のレポートですでに確かめたものです。残りの3つは、全部門に広げる前に確かめる予定です。確かめた日と確かめた人の名前も、あわせて記録に残します。
- items:
    - {text: 出典と時点をすべてのグラフに書いた, done: true}
    - {text: 数値を元の表と照らし合わせた, done: true}
    - {text: 強調する値は1つに絞った, done: true}
    - {text: 色だけで区別していない, done: false}
    - {text: 文字は 12px 以上にした, done: false}
    - {text: 発表者ノートを書いた, done: false}
- new: [K-009]
- uses: [K-004]

## S15
- layout: closing
- contact: 問い合わせ先：データ活用推進本部　データ管理部
- email: data@example.jp
