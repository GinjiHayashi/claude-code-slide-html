# 部品の使い方（components.md）

`components/` の部品は、`outline.md` の `diagram:` に書いたデータを受け取り、HTML の文字列を返す関数。ビルドのスクリプトが呼び出し、スライドの枠（`layout-catalog.md` の型）の中に入れる。

- どの図の型を使うかは `slide-outline/diagram-catalog.md` で決める。このファイルは、決めた型を**どう呼び出すか、どう組み合わせるか**を書く。
- 寸法・座標・色は部品が決める。AI が `outline.md` やスライドの HTML に寸法や座標、色を手で書かない（要求文書 5章）。
- 部品は運用時は固定。運用中に部品を書き換えない。
- **部品は道具であり、必ずどれかを使わなければならないわけではない（ユーザーが決定）**。目的に合う部品があれば必ずそれを使い、似たものを独自に作らない（`flowchart` があるのに、流れの図を独自に書かない）。一方で、部品では表しにくいものを無理に当てはめない。そのときは 4.1 の決まりで独自の表現を書き、`build-log.md` に記録する。

## 1. 呼び出し方

```js
import bar from "./components/bar.mjs";
const html = bar(data, { width: 1172, height: 440 });
```

| 引数 | 中身 |
|---|---|
| `data` | `outline.md` の `diagram:` の中身（`kind:` を除く）。項目は下の 3章 |
| `opt.width`・`opt.height` | 部品を置く枠の大きさ（px）。スライドの型が渡す。既定は `title-diagram` の 1172×440 |

- 必須の項目がない、上限（本数・系列数など）を超えた、名前の食い違い（`highlight` に存在しない名前）があると、部品はエラーで止まる。直すのは `outline.md` の側。
- CSS だけの部品（bar・hbar・table など）は `opt` を受け取らず、親の枠いっぱいに広がる。置く場所の大きさは親（スライドの型や組み合わせの枠）が決める。

## 2. すべての部品に共通すること

| 項目 | 決まり |
|---|---|
| 強調 | `highlight` に書いたものだけ `primary` の青。ほかは灰色。書かなければ強調しない（全部を同じ色にする部品もある） |
| 強調表示 | 大きな数字は `callout: { value, label }` に書く。部品は計算しない。どの部品でも任意（ユーザーが決定） |
| 箱と線の色 | 枠と矢印は `line` で変えられるが、既定の `deepnavy`（Light Blue 1200 #00234B）のまま使う（ユーザーが決定）。塗りの箱には必ず枠を付ける |
| 角 | 箱の角は `rounded-panel`（8）。矢印や線の曲がり角も半径 8。**tree だけは直角**（ユーザーが決定） |
| 文字 | 図の中は 12px 以上。灰色の棒など、白地で 3:1 に届かない面には必ず数値を書く |
| 区別 | 色だけで区別しない。印の形、線の種類、直接のラベル、記号の形を使う |
| 単位・出典 | 単位は部品が図の左上に書く。出典と時点はスライドの `source:` に書き、部品には渡さない |

## 3. 部品ごとのデータ

「既定」はユーザーが見本で決めたもの。24の部品はすべて 4-5 の見本で採用が決まった（ユーザーが決定）。

### 3.1 データ

| 部品 | data の項目 | 選べるもの（既定） | 上限 |
|---|---|---|---|
| `kpi` | items（label, value, unit?, compare?, trend?, highlight?） | — | 1〜4個 |
| `bar` | data（label, value, highlight?）, unit | callout | 2〜12本。1本の列は幅 160 まで |
| `hbar` | data（label, value, highlight?）, unit | sort（true：大きい順）, callout | 2〜10本 |
| `stacked-bar` | categories, series（name, values）, unit | percent, callout | 系列5・分類8 |
| `line` | x, series（name, values）, unit | highlight（系列名）, target, zero, callout | 系列4・時点24 |
| `area` | x, series（name, values）, unit | percent, callout | 系列5・時点24 |
| `combo` | x, bar（name, values, unit）, line（name, values, unit） | callout | 時点12 |
| `donut` | items（label, value）, unit | legend（**direct**・compact・table）, total, callout | 5項目 |
| `scatter` | points（x, y, label?）, x_label, x_unit, y_label, y_unit | highlight, callout | 点50 |
| `table` | columns, rows | style（**zebra**・panel・lines・light・light-zebra）, highlight（行）, align | 8行×6列 |
| `heatmap` | rows, columns, values, unit | steps（3〜**5**） | 12行×12列 |
| `map` | data（pref, value）, unit | style（**shape**・tile）, steps, highlight | 47都道府県 |

### 3.2 構造・時間

| 部品 | data の項目 | 選べるもの（既定） | 上限 |
|---|---|---|---|
| `flowchart` | nodes（label, caption?, type?） | direction（**right**・down）, wrap, highlight。枝分かれは nodes に id・col・row、edges（from, to, label?） | 箱12 |
| `steps` | items（title, text?） | direction（**right**・down）, highlight（段の番号） | 横5段・縦6段 |
| `timeline` | items（date, label, text?） | highlight（番号） | 3〜6個 |
| `roadmap` | periods, lanes（name, items: start, end, label, highlight?） | — | 期間8・レーン4 |
| `sequence` | actors, messages（from, to, label, reply?） | highlight（番号） | 登場5・やりとり10 |
| `er` | entities（name, fields: name, key?）, relations（from, to, card?, label?） | highlight, col・row | 表6 |

### 3.3 概念

| 部品 | data の項目 | 選べるもの（既定） | 上限 |
|---|---|---|---|
| `matrix` | x_axis・y_axis（label, low, high）, cells（4つ: title, text?, items?） | highlight（1〜4） | 箇条書きは各マス3つ |
| `pyramid` | levels（label, text?）。上から書く | highlight（段の番号） | 3〜5段 |
| `tree` | root, children（label, children?） | direction（**down**・right）, highlight | 3階層・子5 |
| `compare` | options, criteria, values（◯・△・×、短い文、{ mark, note }） | recommend | 選択肢2〜3・観点6 |
| `venn` | sets（label, items?）, overlaps（sets, items） | highlight（true：全部の重なりを塗る） | 集合3 |
| `math` | tex | size（**large**・body）, caption, output（**html**・mathml） | — |

## 4. 組み合わせ方

1枚に複数の図を置くときは、スライドの枠を分け、それぞれの部品に分けた後の大きさを渡す。

| 組み合わせ | 置き方 | 例（見本） |
|---|---|---|
| 2つの図を左右に | 枠を左右に分け、間を 48 空ける。SVG の部品には `{ width: 562 }` を渡す | line ＋ stacked-bar、donut ×2 |
| 棒が少ない bar（2〜4本） | **案B**：bar を下半分いっぱいに置かず、kpi や文章を左に縦に積み、bar を右に置く（ユーザーが決定。基準線だけが長く見えるため） | kpi（左）＋ bar（右） |
| donut を他の図と並べる | `legend: "compact"` にし、幅 400 の枠に置く | donut（compact）＋ bar |
| 文章と図 | `text-diagram` の型を使う。右側の図の枠は 572×500 | — |

- 1枚のスライドに置く図は2つまでにする（シンプルにするため。ユーザーが決定）。3つ以上になりそうなら、スライドを分けるか、どれかを文章や kpi にして2つに収める。
- それでも3つ以上になったスライドは、ビルドの検査で「図が3つ以上」と報告し、人間の確認（承認ゲート）で見てもらう。ビルドは止めない。
- 横に並べた図のどちらにも強調の青を使ってよい。

## 4.1 文章と独自の部品も枠に収める

- 文章（タイトル・本文・箇条書き・説明）は、スライドの型が決めた枠（`layout-catalog.md` の「枠」）に入れる。文字数の上限は型ごとに決めてあり、最後はブラウザで実際の行数と大きさを測って判定する。
- はみ出しの検査は、部品ごとではなく**枠ごと**に行う。枠の中のすべての要素が枠の内側に収まっているかを測るので、文章でも、部品でも、AI がその場で書いた HTML でも同じように検査できる。
- 目的に合う部品があるときは、独自の表現を作らない。部品では表しにくいときだけ、枠の中に入れる HTML として書き、次を守る。
  - 色・文字の大きさ・余白は `theme.css` のトークンだけを使う（トークン外の色の検査で止まる）。
  - 枠の大きさを超えない（はみ出しの検査で止まる）。
  - `build-log.md` に「独自の表現」と記録し、人間の確認で見てもらう。よく使うものは、あとで正式な部品にするかを人間が決める。

## 4.2 文章の太字

- 本文や箇条書きで特に伝えたい語句は、AI が構成（`outline.md`）を作るときに `**語句**` で囲み、ビルドが太字（`<strong>`、`primary` の色ではなく `ink` の太字）にする。
- 目安：1つの箇条書きに1か所まで、1枚のスライドに3か所まで。数字や結論の語句を優先する。太字ばかりにすると強調にならないため。
- 太字にした語句は、構成の確認（承認ゲート）で人間が見られるよう、`outline.md` にそのまま残る。

## 5. 部品が使う素材

| 部品 | 素材 | 扱い |
|---|---|---|
| `math` | KaTeX の CSS とフォント | 数式のあるデッキだけ、`katexCss()` の CSS を `deck.html` に入れる。クレジットに MIT と OFL-1.1 を載せる |
| `map`（shape） | `license-notice/assets/natural-earth/japan-prefectures.json` | 部品が読み込む。作り直すときは `scripts/make-japan-map.mjs`。クレジットに「Made with Natural Earth.」 |
| すべて | Noto Sans JP | 使う文字だけにサブセット化して埋め込む |

素材はすべて `license-notice/registry.yaml` に登録済みのものだけを使う（D9）。

## 6. 確かめること

- ビルド後、ブラウザで各スライドを開き、スライドの外にはみ出した要素がないかを検査する。KaTeX の読み上げ用の要素（`.katex-mathml`）と、KaTeX が内部で使う SVG は、見た目に出ないので検査から外す。
- 見本（4-5）では、全部の型を1つのデッキに並べ、スクリーンショットで確認する。

---

出典：部品の仕様は各部品のファイルの冒頭のコメント、既定と不採用の決定は `task.md` の決定事項（2026-10-17）にもとづく。「推測」と書いた目安は、4-5 の見本で見直す。
