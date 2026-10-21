# 構成のフレームワーク（structure-framework）

スライドの構成（何を・どの順で・どう語るか）を、決まった手順と確かめられる項目で決める。技術の説明、提案、社内の勉強会など、聞き手に理解と納得を積み上げてもらうスライドが対象。

元は人間が書いた草案（slide-structure-framework.md）。ハーネスの工程と言葉に合わせて書き直した。手法の出典と、推測・独自に整理した範囲は、草案のまま末尾に残す。

## 0. ハーネスへの入れ方

- 工程は置き換えない。既存の工程（ヒアリング、構成、ファクトチェック）の中に差し込む。
- 既存の項目と同じ意味のものは、既存の名前を使う（例：持ち帰りの1文＝`brief.md` の「伝えたい結論（1文）」、アサーション＝`outline.md` の `title`）。
- ハーネスの原則「文章の良し悪しは AI がレビューしない」（CLAUDE.md 原則6）は守る。フレームワークは「AI が構成を作るときの手順」と「機械で確かめられる検査」として入れる。話が通るかなど、機械で決められないことは人が見る。

| 段階 | 差し込む工程 | 置き場 |
|---|---|---|
| 1 ゴールの定義 | 1b ヒアリング | `brief.md`（この文書の1章） |
| 2 知識マップ | 2 構成の前半 | 知識マップのファイル |
| 3 説明の順序 | 2 構成 | 知識マップの層と、`outline.md` の並び |
| 4 ストーリー | 2 構成 | `outline.md`（冒頭の SCQA、各スライドの答える問い） |
| 5 スライド単位 | 2 構成 | `outline.md`（1文の主張のタイトル、新出の概念の説明） |
| 6 確かめ | 2 の「見せて、直す」、5 最終確認 | 検査（スクリプト）と、人の確認表 |

要旨：

1. ゴールから逆算する。聞き手・前提知識・持ち帰りの1文を先に決め、知識の呪いとエレベーターテストで確かめる。
2. 知識マップ（前提の関係の有向非巡回グラフ）を作り、優先度を付ける。
3. 知識マップの層の順に説明する（基礎から応用へ。同じ層の中は具体から抽象へ）。
4. 前方参照をしない。あるスライドでは、それより後で説明する概念を使わない。
5. ストーリーは「問いの連鎖」で作る。冒頭は SCQA で問いを立て、各スライドは直前の問いに答え、次の問いを生む。
6. 1スライド1主張（Assertion-Evidence）。新しく出る抽象的な概念は ADEPT の順で説明する。

## 1. ゴールの定義（1b ヒアリング）

`brief.md` に書く。以降のすべての判断の基準になる。

| 項目 | brief.md の見出し | 書くこと |
|---|---|---|
| 聞き手 | 聞き手と前提知識 | 誰が聞くか |
| 前提知識 | 聞き手と前提知識 | 説明せずに使ってよい概念。1行に1つ「- 概念：N割」（聞き手の何割が説明できるか） |
| 持ち帰りの1文 | 伝えたい結論（1文） | 見終わったときに、聞き手が言える状態を1文で |
| 行動 | 終わったあとの行動 | 見終わったあとにしてほしいこと。なければ「なし」 |
| 時間・枚数 | 発表時間・枚数の目安 | 発表時間と枚数の目安 |
| 種類 | 資料の種類 | 解説型（理解してもらう）か提案型（決めてもらう・動いてもらう） |

- 前提知識に書いた概念は、知識マップの根（説明しない概念）として扱う。持ち帰りの1文は、知識マップのゴールになる。
- 項目を聞く文は `slide-hearing/questions.md`。

### 1-1. 前提知識を確かめる（知識の呪い）

詳しい人ほど「知らない状態」を想像できず、前提を飛ばすか、逆に詳細を盛りすぎる（知識の呪い）。

- 前提知識の各項目に「聞き手の何割が説明できるか」を書く。
- 過半数（5割）に満たない項目は、前提知識から外し、構成で説明する概念にする。`check-brief.mjs` が注意を出す。
- 迷う項目は、説明する概念にする（説明がくどくなる損より、理解が崩れる損のほうが大きいため。推測）。

前提知識を多く見積もると、知識マップの根がずれ、前方参照をしていなくても理解が崩れる（推測）。

### 1-2. 持ち帰りの1文を確かめる（エレベーターテスト）

- 持ち帰りの1文を、30〜45秒で口で説明できるか。できなければ、ゴールが大きすぎる。絞るか、デッキを分ける。
- 確かめるのは人。AI は判定せず、brief.md の確認を頼むときに問いかける（`slide-hearing` の手順5）。

## 出典

| 内容 | 出典 |
|---|---|
| ピラミッド原則・SCQA・MECE | Barbara Minto, *The Pyramid Principle*／https://scqa.lifeitself.org ／https://thinkinsights.net/strategy/pyramid-principle ／https://modelthinkers.com/mental-model/225 |
| Assertion-Evidence | Michael Alley（Penn State）https://writing.engr.psu.edu/research.html ／https://writing.engr.psu.edu/eye_presenting.pdf |
| Assertion-Evidence への批判的評価 | David Farkas https://faculty.washington.edu/farkas/dfpubs/Farkas-Assessment%20Of%20Alleys%20Slide%20Design.pdf |
| Mayer のマルチメディア学習原則（Pre-training / Segmenting / Coherence） | R. E. Mayer, *Multimedia Learning* 3rd ed. (2020) の要約 https://ugc.futurelearn.com/uploads/files/7d/d6/7dd6188d-c343-4311-b064-ac98d2c95abc/Multimedia_Principles._R._E._Mayer__2020.pdf ／https://medicine.nus.edu.sg/medixperience/scholarly-article/mayers-12-principles-of-multimedia-instruction/ |
| Sparkline | Nancy Duarte, *Resonate* ／https://libguides.hull.ac.uk/present/structure |
| 前提関係グラフ・トポロジカルソートによるカリキュラム設計 | https://arxiv.org/pdf/2210.01269 ／https://cdio.org/knowledge-library/documents/cdio-curriculum-design-computing-graph-based-approach |
| Backward Design | Wiggins & McTighe (2005)（上記 CDIO の論文の中で参照） |
| 知識の呪い | Chip & Dan Heath, *Made to Stick* (2007)／https://stanfordmag.org/contents/getting-attention ／https://thedecisionlab.com/reference-guide/management/curse-of-knowledge |
| エレベーターテスト・「だから何？」 | Garr Reynolds, *Presentation Zen*／https://www.supersummary.com/presentation-zen/summary/ |
| Concreteness fading | Fyfe et al. (2014) *Educational Psychology Review* https://www.doi.org/10.1007/S10648-014-9249-3 ／反対の結果：Jaakkola & Veermans (2018) https://research.utu.fi/converis/portal/detail/Publication/27608311 |
| ADEPT | Kalid Azad（BetterExplained）の手法の紹介 https://tm.durusau.net/?p=77439 ／https://campus.datacamp.com/courses/data-communication-concepts/storytelling-with-data?ex=4 |

推測・独自に整理した範囲（草案のまま）：既存の手法どうしの組み合わせ方は、特定の出典によらない独自の設計。具体的には次のとおり。

- SCQA で答えを予告し、本文を基礎から積み上げる方針
- ストーリーの4つの要件 S1〜S4
- 前方参照の例外の決まり
- 同じ層の中の並べ方の基準1・2
- 順序とストーリーがぶつかったときの優先順位
- MoSCoW による優先度と格上げの決まり、抽象度を付けること
- 知識の呪いへの対策の「過半数」の基準
- ADEPT を使う対象・最低限の線・類推の限界を書くこと
