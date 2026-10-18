# claude-code-slide-html

Claude Code に、構成の検討から HTML スライド（`deck.html`）の作成までを任せるためのハーネスです。

> 調査とファクトチェック（Web で出典を開く部分）は、まだ実際のネットワークでは試していません。使い始めたら、出典が本当に開かれているかを確かめてください。

## 環境構築

このリポジトリ（public）はそのまま使わず、**複製して自分用の private リポジトリを作り、そこでスライドを作ります**。スライドの中身を公開しないためです。

### 0. 必要なツールを入れる

| ツール | 版 | 何に使うか | 確かめ方 |
|---|---|---|---|
| Node.js | 22 以上 | ビルドと各スクリプト | `node -v` |
| uv | — | Python とそのパッケージ（フォントの処理）。Python は uv が入れるので、別に入れなくてよい | `uv --version` |
| git | — | 版の管理 | `git --version` |
| Claude Code | — | スライドを作る AI | `claude --version` |
| GitHub CLI（推奨） | — | リポジトリと PR の作成 | `gh auth status` |

macOS と Linux（Windows は WSL の Ubuntu）で同じ手順です。[Homebrew](https://brew.sh) は Linux でも使えるので、ツールはまとめて Homebrew で入れます。

```sh
# 1. Homebrew（入っていなければ）。終わりに表示される「Next steps」のコマンドも実行して、brew を使えるようにする
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. ツール
brew install node git gh uv
curl -fsSL https://claude.ai/install.sh | bash   # Claude Code（公式のインストーラー）

# 3. GitHub にログイン（ブラウザが開く）
gh auth login
```

- Linux では、Homebrew の前に `sudo apt-get install build-essential procps curl file git` が要ります（Homebrew の公式の前提）。
- Windows では WSL の中で使ってください（Windows のまま動かすことは試していません）。

入れたら、新しいターミナルを開き、表の「確かめ方」のコマンドで版が出ることを確かめます。GitHub CLI がなくても進められますが、リポジトリの作成と設定を手で行うことになります。

### 1. スライド用リポジトリを作る

```sh
git clone https://github.com/GinjiHayashi/claude-code-slide-html.git
cd claude-code-slide-html
cp .env.sample .env        # .env を開き、SLIDE_REPO=自分のアカウント/my-slides のように書く
npm run create-slide-repo
```

先に中身だけ確かめたいときは、`npm run create-slide-repo -- --dry-run` を実行します（何も作らず、することを表示するだけ）。

これで GitHub に private リポジトリができ、このリポジトリの隣（`../my-slides`）に clone されます。このあとの作業はすべてそちらで行います。最初に clone したこのリポジトリは消してかまいません。

<details>
<summary>スクリプトがしていること・gh がないとき</summary>

- private の空リポジトリを作る（すでにあれば、private で空であることを確かめる。中身があれば止める）
- ハーネスの `main` と `develop` を履歴ごと送る（フォークは private にできないため複製する。GitHub Docs「Duplicating a repository」）
- 既定ブランチを `develop` にする
- clone して `decks/.gitignore` を消し、`decks/` を git で管理する
- 更新を取り込むための remote `harness` を足す

gh がないときは、GitHub で private の空リポジトリ（README やライセンスは付けない）を先に作ってから実行し、最後に Settings → General → Default branch を `develop` にします。

</details>

### 2. セットアップ

```sh
cd ../my-slides
npm run setup                          # npm のパッケージ、Chromium、Python とそのパッケージ（uv）を入れる
npm run build -- examples/sample-deck  # 見本をビルドして確かめる
```

エラーなく終わり、`examples/sample-deck/build/deck.html` をブラウザで開けば準備完了です。

### 3. Claude Code を起動する

```sh
claude
```

`my-slides` の中で起動します。初回はログインと、フォルダを信頼するかの確認が出ます。

## 使い方

### 頼み方

`my-slides` で Claude Code を起動し、`/make-slides` に続けて依頼を書きます。

```text
/make-slides 新任職員向けに、行政のデジタル化の歩みを10分で話したい。
```

資料があれば、チャットに貼るか、ファイルの場所を伝えます。AI がデッキのフォルダ（`decks/<deck-id>/inputs/`）に写して読みます。

| 渡せるもの | 例 |
|---|---|
| チャットの文章 | 依頼、メモ、箇条書き、構成案 |
| ファイル | Markdown・テキスト・CSV、Excel（.xlsx）、PDF、画像 |
| 事前記入シート（任意） | `.claude/skills/slide-intake/intake-form.md`。目的・聞き手・長さなどを先に書いておくと、質問が減ります |

Word と PowerPoint は直接読めないので、PDF かテキストに書き出して渡します。

### 作成開始から完了までの流れ

承認は3回（✅）です。承認されるまで、AI は次の工程に進みません。

| # | 工程 | AI がすること | あなたがすること | できるもの |
|---|---|---|---|---|
| 1 | 始める | ブランチ `feature/<deck-id>` とデッキのフォルダを作る | `/make-slides` で依頼し、資料を渡す | `decks/<deck-id>/` |
| 2 | 前提を固める | 資料を読んでまとめ、足りないことを質問する | 質問に答える | `brief.md` |
| ✅ | 承認1 | 承認を頼む | 前提（目的・聞き手・長さなど）を確かめて答える | コミット |
| 3 | 構成と調査 | スライドの並びと中身を書き、必要なことを Web で調べる | 構成の相談に答える（下の「構成の進め方」） | `outline.md`、`research.md` |
| 4 | ファクトチェック | 書いた内容が事実と合うかを、出典で確かめる | 誤りの直し方を決める | `factcheck.md` |
| ✅ | 承認2 | 承認を頼む | 構成とファクトチェックの結果を確かめて答える | コミット |
| 5 | ビルド | HTML を作り、はみ出し・ライセンスなどを機械で検査する | なし | `build/deck.html`、`deck.pdf` |
| 6 | 最終確認 | 見るときの確認表を示す | `deck.html` をブラウザで開いて見た目を確かめる | — |
| ✅ | 承認3 | 承認を頼む | 仕上がりを確かめて答える | コミット |
| 7 | 完成 | push して `develop` への PR を作る | PR を確かめて squash マージする | PR |

- **承認の答え方**：「OK」「承認します」のように自由な言葉で答えます。直してほしいときは「3枚目の数字を直して」のように書けば、その工程に戻ります。
- **AI がしないこと**：承認の記録（あなたの答えを受けて仕組みが記録します）、見た目や文章の良し悪しの判断、PR のマージ。
- **途中で止まったとき**：`/make-slides 続き` のように頼めば、どこまで進んだかを AI が確かめて、続きから始めます。

### 構成の進め方

工程2で、構成をどう決めるかを聞かれます。

| 選ぶもの | AI の動き方 |
|---|---|
| 決まっている | あなたの構成（並びと中身）を変えない。問題があれば報告だけし、直すかはあなたが決める |
| たたき台がある | たたき台をもとに、調査に基づく修正案を出す。採用するかはあなたが決める |
| 相談して決めたい | 目的と伝えたい結論から章立ての案を出し、相談しながら固める |

### できあがったスライドを直すとき

`/make-slides` で直したいことを伝えます。`deck.html` は直接直さず、元の `outline.md` を直してビルドし直します。

| 直したいこと | 戻る工程 |
|---|---|
| 目的・聞き手・長さなどの前提 | 2（前提を固める）から |
| 文・数値・スライドの並び、スライドの型や図の型 | 3（構成）から。変えたスライドだけファクトチェックし直す |
| 色・フォント・部品の形 | 直せません（ハーネスで決まっているため。変えたいときはハーネスを直す） |

直したあとは、戻った工程よりあとの承認をもう一度行います。

### 発表した版を残すとき（任意）

「発表した版を残して」と頼むと、AI が `develop` から `main` への PR を作ります。あなたがマージすると、AI が `main` にタグ（`<deck-id>`）を付けます。

### できるファイル

```text
decks/<deck-id>/
├── inputs/        渡した資料（AI は書き換えない）
├── brief.md       前提
├── outline.md     スライドの元ファイル（直すときはここ）
├── research.md    調査の結果と出典
├── factcheck.md   ファクトチェックの結果
└── build/
    ├── deck.html  完成したスライド（1ファイルで完結。そのまま渡せる）
    └── deck.pdf
```

## ハーネスの更新を取り込む

**何のため**：`my-slides` は、作った時点のハーネスの写しです。そのあとハーネス（このリポジトリ）に機能の追加や修正が入っても、`my-slides` には自動では反映されません。この手順で、ハーネスの新しい版を `my-slides` に取り込みます。スライド（`decks/`）はハーネスにないので、消えたり変わったりしません。

**いつ**：ハーネスの `main` が新しくなったときです（ハーネスの更新は `main` に区切りよくまとめて入ります）。更新がなければ、実行しても何もしません。

**やること**：`my-slides` の中で実行し、できた PR をマージします。

```sh
npm run update-harness
```

スクリプトは次の順に進みます。

1. ハーネスの最新の `main` を取ってくる
2. `develop` から取り込み用のブランチ `feature/harness-update` を作り、そこにハーネスの `main` を merge する
3. push して、`develop` への PR を作る

PR で変わったファイル（`.claude/` や `CLAUDE.md` など）を確かめ、**マージコミット** でマージします。squash にすると「どこまで取り込んだか」の記録が残らず、次の取り込みで衝突します。

- 衝突したときは、スクリプトが途中で止まり、衝突したファイルと続け方を表示します。衝突するのは `CLAUDE.md` や `.claude/` を `my-slides` の側で直していたときだけです。
- `package-lock.json` が変わったときは、マージのあとで `npm run setup` をやり直します。

## git の運用ルール

簡易 GitFlow です。ハーネスの開発でも、スライド用リポジトリでも同じルールを使います。

| ブランチ | 用途 | 切り元 → マージ先 | マージの方法 |
|---|---|---|---|
| `main` | 区切りのよい完成版 | — | — |
| `develop` | 作業の統合先（既定ブランチ） | `main` → `main` | マージコミット |
| `feature/*` | 1つの作業（デッキ1件も1つ） | `develop` → `develop` | squash |
| `feature/harness-update` | ハーネスの更新の取り込み | `develop` → `develop` | マージコミット |
| `hotfix/*` | `main` の緊急修正 | `main` → `main` と `develop` | — |

スライド用リポジトリでは、発表した版の `main` に `<deck-id>` のタグを付けます。

### コミットメッセージ

`feat:`・`fix:`・`docs:`・`chore:` のどれかを付け、日本語で書きます（例：`docs: README を整理する`）。デッキのコミットにはデッキの ID を付けます（例：`feat(2026-10-17-data-platform): outline.md を承認`）。

トークンやパスワードはコミットしないでください（このリポジトリは public です）。

## ハーネスを直すとき

- `develop` から `feature/*` を切り、`develop` への PR を作ります。
- 確かめるコマンド：`npm test`、`npm run build -- examples/sample-deck`（PR では CI も同じものを実行します）。
- 書式は `npx prettier@3.3.3 --write "**/*.mjs"` でそろえます。
- スライドの型や部品の決まりはコードが正です：`node .claude/skills/html-build/scripts/schema.mjs`。
- `.claude/` と `CLAUDE.md` は、スライド用リポジトリでは AI が変えるたびに確認が出ます。このリポジトリでは出ません（`SLIDE_HARNESS_MODE=slides` で出せます）。`.claude/settings.json` と `approvals.yaml` は AI からは変えられないので、手で編集します。

## ライセンス

[MIT](LICENSE)
