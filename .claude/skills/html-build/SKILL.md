---
name: html-build
description: 承認済みの outline.md から、1ファイルで完結する deck.html（と、必要なら deck.pdf）をビルドし、機械的な検査とライセンスの照合を通すためのスキル。HTML 作成の工程と、スライドを直したあとの再ビルドで使う。
---

# HTML 作成（html-build）

`decks/<deck-id>/outline.md` から `deck.html` を作る。HTML は手で書かず、ビルドのスクリプトが部品（`components/`）とスライドの型（`layouts.mjs`）で組み立てる。

## ビルドする

1. 承認を確かめる：`node .claude/skills/make-slides/scripts/gate.mjs decks/<deck-id> build`。止められたら、ビルドせずに理由を人間に伝え、`make-slides` に戻る（ビルドのスクリプトはゲートで止まらず、注意として記録するだけなので、ここで確かめる）。
2. ビルドする：

```
npm run build -- decks/<deck-id>
```

Chromium を指定するときは、環境変数 `CHROMIUM_PATH` にパスを入れる（なければ Playwright が入れたものを使う）。

- 終了コードが 0 なら合格。1 なら不合格で、理由は `decks/<deck-id>/build/build-log.md` に書かれている。
- 書き出すもの（すべて `decks/<deck-id>/build/` の中）：`deck.html`、`assets-manifest.yaml`、`build-log.md`。`outline.md` が `pdf: true` で合格したときは `deck.pdf` も。
- 初めて使う環境では、README の「セットアップ」を先に行う。

ビルドの中でやること（順番どおり）：

1. 書式チェック（`scripts/check-outline.mjs`）。エラーがあれば止める。承認ゲートが通らなければ注意として記録する（単独で呼んだとき）
2. スライドを組み立て、Tailwind の CSS、使う文字だけのフォント、数式があれば KaTeX を埋め込む
3. 使った素材を走査し、`registry.yaml` と照合する（license-notice）。不合格なら `deck.html` を書かずに止める
4. 最後に「ライセンス表記」のスライドとライセンスの全文を入れて、`deck.html` を書き出す
5. ブラウザで開いて検査する（`scripts/inspect.mjs`）
6. `pdf: true` なら PDF を作る

## 守ること

- **ソースは `outline.md` だけ。** `deck.html` は直さない。直すときは `outline.md` の該当スライドの節（`## S05` から次の見出しまで）だけを読んで書き換え、ビルドし直す。`deck.html` は読まない（大きく、読む量が無駄になる）。結果は `build-log.md` で見る。
- **部品にはデータだけを渡す。** 棒の長さや座標などの寸法は部品とビルドが計算し、AI は書かない。強調する数値（「約1/7」など）も `outline.md` に書き、承認とファクトチェックの対象にする。部品に計算で増やさせない。
- 出典はスライドごとに `source:`（スライドの下部に出る）、発表者ノートは `notes:` に書く。
- 書き方は `slide-outline/outline-template.md`、型は `layout-catalog.md`、図は `diagram-catalog.md` と `components.md`。
- 図は `idea`・`match` に従う。`match: そのまま` なら部品を使い、「意味が欠ける」「描けない」なら `html:` に独自の表現を書く（`components.md` 4.1：トークンだけ、枠に収める、画像やスクリプトを入れない）。
- 承認済みかどうかは自分で判断しない。`make-slides/scripts/gate.mjs` で確かめる。

## 不合格のとき

| 記録の見出し | 直し方 |
|---|---|
| 書式チェックのエラー | 行番号の場所を `outline-template.md` に合わせて直す |
| はみ出し・余白不足・文字の重なり | 文字数を減らす、改行の位置を変える、図のデータの数を減らす。内容を変える直しは人間に報告して判断を仰ぐ |
| 文字が小さすぎる・トークン外の色 | 多くは `html:` の独自の表現が原因。トークンのクラスに直す |
| 説明文が3行を超えた | 説明文（lead）を短くする |
| ブラウザが起動しない（`Host system is missing dependencies`、`libnss3.so` がないなど） | 環境の不足。個々のライブラリを `apt install` で頼まず、人間に `npx playwright install-deps chromium` の実行を頼む（sudo のパスワードが要る。`sudo npx` は nvm だと動かないので付けない）。済んだらビルドし直す |
| 外部への通信・スクリプトのエラー | `html:` から外部の読み込みやスクリプトを外す |
| ライセンスの照合のエラー | 素材を外す。使う必要があるなら、license-notice の手順で人間に登録の承認を求める。`registry.yaml` を自分で承認済みにしない |
| 注意（人が確認する） | 直さなくてよい。人間に一覧を伝える（図が3つ以上、`html:` を使った、識別子のない SVG など） |

## ファイル

| ファイル | 中身 |
|---|---|
| `base.html` | スライドの土台（ページ送り、発表者ビュー、印刷）。固定 |
| `theme.css` | 色・文字・余白のトークン。固定 |
| `layouts.mjs` | スライドの型を HTML にする。credits スライドもここ |
| `components/`、`components.md` | 図の部品と、その使い方 |
| `scripts/outline.mjs`・`check-outline.mjs` | outline.md の読み込みと書式チェック |
| `scripts/build.mjs` | ビルドの入口 |
| `scripts/font-subset.py` | フォントのサブセット化（Python の fontTools と Brotli） |
| `scripts/icons.mjs` | アイコン集（Phosphor）から英語の語でアイコンを探す。構成（slide-outline）で使う |
| `scripts/make-japan-map.mjs` | 地図（map）の都道府県の境界を Natural Earth から作り直す。ハーネスを直すときだけ使う |
| `scripts/inspect.mjs` | ブラウザでの検査 |
| `scripts/pdf.mjs` | PDF の書き出し |
| `scripts/setup.mjs` | セットアップ（`npm run setup`。npm のパッケージ、Chromium、Python のパッケージ） |
| `scripts/spec.mjs` | スライドの型の決まり（書ける項目・数・文字数）、図の型の一覧、寸法（余白は theme.css から読む） |
| `scripts/schema.mjs` | スライドの型と図の部品に書ける項目を出す（`node .claude/skills/html-build/scripts/schema.mjs [型の名前]`。正は spec.mjs と各部品の `schema`） |
