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
| 2 知識マップ | 2 構成の前半 | `knowledge-map.md`（この文書の2章） |
| 3 説明の順序 | 2 構成 | 知識マップの層と、`outline.md` の並び（3章） |
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

## 2. 知識マップ（2 構成の前半）

構成の進め方が「たたき台がある」「相談して決めたい」のとき、章とスライドを決める前に作る。「決まっている」では作らない（人の並びを変えないため）。

- **知識マップ**：概念を点、前提の関係を矢印にした、循環のないグラフ。`A → B` は「B を理解するには A が要る」。
- **前提の関係**：B の説明（文・図・話す内容）の中で A の言葉や考え方を使うとき、A を B の前提にする。

### 2-1. 作り方

1. ゴール（持ち帰りの1文に当たる概念）を置く。
2. 「これを理解するには何が要るか」をくり返し問い、前提の概念を挙げる（逆算）。
3. 前提知識（1章。brief.md に書いたもの）にたどり着いたら、そこで止める。前提知識は表に書かない。
4. 各概念に1文の定義を書く。書けない概念は粒度が粗すぎるので分ける。
5. 各概念に優先度と抽象度を付ける。
6. 循環があれば解く。循環は、どちらかの定義があいまいなしるし。概念を分けるか、片方を簡単な形で先に出す。

### 2-2. 優先度と抽象度

| 優先度 | 意味 | 扱い |
|---|---|---|
| Must | ゴールへの道の上にあり、欠けると持ち帰りの1文が成り立たない | 必ず1つの説明として出す |
| Should | 理解を深めるが、なくても持ち帰りの1文は成り立つ | 時間があれば出す。なければ補足へ |
| Could | 関連する知識・発展 | 付録か質疑のため |

- **格上げ**：Must の前提にある Should・Could は Must にする（前提が欠けると前方参照になるため）。
- **抽象度**：具体（個別の事例・データ・操作・現象。例「売上の記録が重複して入る」）か、抽象（一般化した概念・原則・方針。例「冪等性」）。3章の並べ方と、5章の ADEPT の対象に使う。

### 2-3. 書き方（knowledge-map.md）

`decks/<deck-id>/knowledge-map.md` に表で書く。図（Mermaid など）は使わない（CLAUDE.md 原則3。表なら差分が読める）。見本は `examples/sample-deck/knowledge-map.md`。

```markdown
---
deck_id: 2026-10-17-report-automation
goal: K-007            # 持ち帰りの1文に当たる概念の ID
---

| ID | 概念 | 1文の定義 | 前提 | 優先度 | 抽象度 |
|---|---|---|---|---|---|
| K-001 | 作成時間の現状 | 6部門の作成に月40時間かかっている | - | Must | 具体 |
| K-002 | 時間がかかる理由 | 入力の形が違い、集計を手で直している | K-001 | Must | 具体 |
```

- 前提は ID を「、」で区切る。なければ「-」。層は書かない（スクリプトが出す）。
- `node .claude/skills/slide-outline/scripts/check-knowledge.mjs decks/<deck-id>` で確かめる。
  - エラー：表の書式、ID の重複、表にない前提、定義がない、優先度・抽象度の値、循環、格上げ漏れ、goal がない・Must でない、「たたき台がある」「相談して決めたい」なのに知識マップがない。
  - 注意：goal につながらない Must（Should にするか、前提の関係を足す）。
- 知識マップは承認の対象ではない。構成を見せるとき（`SKILL.md` 手順 8）に一緒に見せる。

## 3. 説明の順序（2 構成）

### 3-1. 層（基礎から応用へ）

1. Must の概念だけを取り出す。
2. Must の前提がない概念を層0、層0だけを前提にする概念を層1…とする。
3. 層の小さい順に説明する（ボトムアップ）。

`check-knowledge.mjs` が層を出す。

### 3-2. 同じ層の中の並べ方

層の順だけでは並びが1つに決まらない。次の順で決める。

| 順 | 基準 | 決めるもの | 理由 |
|---|---|---|---|
| 1 | 次の層でより多くの概念の前提になるもの | スクリプト | 早く出すほど、あとの説明が楽になる（推測） |
| 2 | ストーリーの上で、直前の問いに答えるもの | AI と人 | 問いの連鎖を切らない（4章）（推測） |
| 3 | 具体 → 抽象 | スクリプト | 具体から始め、はっきりと段階を踏んで抽象へ移す方法（Concreteness fading）が研究で勧められている |

- スクリプトは基準1・3で並べた候補を出す。基準2で入れ替えるかは、構成を作るときに AI が決め、人に見せる。
- 基準3は決まりではなく既定の並べ方。ずっと具体のまま教えたほうが同じか良かった研究もある。聞き手の前提知識が十分なら、抽象から入ってもよい。
- 具体から抽象に移るときは、具体のどの要素が抽象のどこに当たるかをはっきり書く（Concreteness fading の要件）。

### 3-3. 並びを outline.md に移す

- 層の順を、章とスライドの並びの土台にする。1つの概念を1枚とは限らない（1枚に2つ、2枚に1つもある）。
- 層の順と違う並びにしたスライドは、見せるときに理由を書く（`SKILL.md` 手順 8）。冒頭で答えを予告する（4章の SCQA）のは、順序の違反ではない。

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
