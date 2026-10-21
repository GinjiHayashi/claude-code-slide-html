# claude-code-slide-html

Claude Code に、構成の検討から HTML スライド（`deck.html`）の作成までを任せるためのハーネスです。

> 調査とファクトチェック（Web で出典を開く部分）は、まだ実際のネットワークでは試していません。使い始めたら、出典が本当に開かれているかを確かめてください。

## 目次

- [環境構築](#環境構築)
  - [0. 必要なツールを入れる](#0-必要なツールを入れる)
  - [1. スライド用リポジトリを作る](#1-スライド用リポジトリを作る)
  - [2. セットアップ](#2-セットアップ)
  - [3. Claude Code を起動する](#3-claude-code-を起動する)
- [使い方](#使い方)
  - [頼み方](#頼み方)
  - [作成開始から完了までの流れ](#作成開始から完了までの流れ)
  - [構成の進め方](#構成の進め方)
  - [できあがったスライドを直すとき](#できあがったスライドを直すとき)
  - [発表した版を残すとき（任意）](#発表した版を残すとき任意)
  - [スライドの各部の呼び方](#スライドの各部の呼び方)
  - [できるファイル](#できるファイル)
- [ハーネスの更新を取り込む](#ハーネスの更新を取り込む)
- [git の運用ルール](#git-の運用ルール)
  - [コミットメッセージ](#コミットメッセージ)
- [ハーネスを直すとき](#ハーネスを直すとき)
- [ライセンス](#ライセンス)

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

Ubuntu（Windows では WSL の Ubuntu）を前提にしています。

**Windows のとき**：PowerShell を管理者として開いて `wsl --install` を実行し、再起動して Ubuntu を開きます。以降のコマンドはすべて Ubuntu の中で打ちます。作業フォルダは Ubuntu 側（`~/` の下）に置きます（`/mnt/c/...` は遅いため）。

```sh
# git と curl
sudo apt update && sudo apt install -y git curl

# Node.js（nvm で入れる。nvm を入れたら、新しいターミナルを開いてから次の行）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 22

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Claude Code
curl -fsSL https://claude.ai/install.sh | bash

# GitHub CLI（公式の apt リポジトリを足して入れる）
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install -y gh
gh auth login   # GitHub にログイン（表示に従ってブラウザで認証する）
```

入れたら、新しいターミナルを開き、表の「確かめ方」のコマンドで版が出ることを確かめます。GitHub CLI がなくても進められますが、リポジトリの作成と設定を手で行うことになります。

### 1. スライド用リポジトリを作る

```sh
git clone https://github.com/GinjiHayashi/claude-code-slide-html.git
cd claude-code-slide-html
cp .env.sample .env        # .env を開いて書く（下の「.env の書き方」）
npm run create-slide-repo
```

#### .env の書き方

書く項目は3つです。ふつうは `SLIDE_REPO` の1行だけを書きます。

| 項目 | 必須か | 書くもの |
|---|---|---|
| `SLIDE_REPO` | 必須 | 作るスライド用リポジトリ（`持ち主/リポジトリ名`） |
| `SLIDE_REPO_DIR` | 任意 | 手元に clone する場所。空なら、このリポジトリの隣（`../<リポジトリ名>`） |
| `HARNESS_REPO` | 任意 | 複製元のハーネス。空なら `GinjiHayashi/claude-code-slide-html` |

状況ごとの書き方：

| こんなとき | 書くこと |
|---|---|
| 自分のアカウントに作る（ふつうはこれ） | `SLIDE_REPO=your-name/my-slides` |
| 組織（Organization）に作る | `SLIDE_REPO=your-org/my-slides`（その組織でリポジトリを作る権限が要る） |
| GitHub に空のリポジトリをもう作ってある | 同じく `SLIDE_REPO=持ち主/名前`。private で空なら、そのまま使う（中身があれば止まる） |
| SSH で push したい | `SLIDE_REPO=git@github.com:your-name/my-slides.git`。URL で書くと gh を使わないので、空のリポジトリを先に作り、既定ブランチも手で `develop` にする |
| clone する場所を決めたい | `SLIDE_REPO_DIR=~/work/my-slides`（`~/` はホームのフォルダ） |
| ハーネスを自分のリポジトリに複製して直している | `HARNESS_REPO=your-name/claude-code-slide-html` |

例（自分のアカウント `taro` に `slides-2026` を作り、`~/work` の下に置く）：

```sh
SLIDE_REPO=taro/slides-2026
SLIDE_REPO_DIR=~/work/slides-2026
HARNESS_REPO=
```

先に中身だけ確かめたいときは、`npm run create-slide-repo -- --dry-run` を実行します（何も作らず、することを表示するだけ）。

これで GitHub に private リポジトリができ、`SLIDE_REPO_DIR` の場所（既定はこのリポジトリの隣の `../my-slides`）に clone されます。このあとの作業はすべてそちらで行います。最初に clone したこのリポジトリは消してかまいません。

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
cd ../my-slides                        # SLIDE_REPO_DIR を書いたときは、その場所
npm run setup                          # npm のパッケージ、Chromium と OS のライブラリ、Python とそのパッケージ（uv）を入れる
npm run build -- examples/sample-deck  # 見本をビルドして確かめる
```

`npm run setup` の途中で sudo のパスワードを聞かれます。Chromium が使う OS のライブラリ（`libnss3` など）を apt で入れるためです。最後に Chromium が起動するかを確かめ、足りないものがあればそこで止まって、入れ方を表示します。AI がスライドを画像にして確かめるときも、この Chromium を使います（`npm run shots`）。PDF を画像にする道具（`pdftoppm` など）は入れなくてかまいません。

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

承認は4回（✅）です。承認されるまで、AI は次の工程に進みません。工程の番号は、AI が現在地を示すときの番号（`status.mjs`）と同じです。

| # | 工程 | AI がすること | あなたがすること | できるもの |
|---|---|---|---|---|
| 1a | 始める・取り込み | ブランチ `feature/<deck-id>` とデッキのフォルダを作り、資料を読んでまとめる | `/make-slides` で依頼し、資料を渡す | `decks/<deck-id>/`、`brief.md` |
| 1b | ヒアリング | 足りないことを質問する | 質問に答える（ファクトチェックの時期も選ぶ） | `brief.md` |
| ✅ | 承認1 | 承認を頼む | 前提（目的・聞き手・長さなど）を確かめて答える | コミット |
| 2 | 構成と調査 | スライドの並びと中身を書き、必要なことを Web で調べる | 構成の相談に答える（下の「構成の進め方」） | `outline.md`、`research.md` |
| ✅ | 承認2 | 承認を頼む | 構成を確かめて答える | コミット |
| 3 | HTML 作成 | HTML を作り、はみ出し・ライセンスなどを機械で検査する。見た目の直しを頼まれたら直す | `deck.html` を見て、見た目の直しを頼む | `build/deck.html`、`deck.pdf` |
| 4 | ファクトチェック | 書いた内容が事実と合うかを、出典で確かめる | 誤りの直し方を決める | `factcheck.md` |
| ✅ | 承認3 | 承認を頼む | 構成とファクトチェックの結果を確かめて答える | コミット |
| 5 | 最終確認 | 見るときの確認表を示す | `deck.html` をブラウザで開いて見た目を確かめる | — |
| ✅ | 承認4 | 承認を頼む | 仕上がりを確かめて答える | コミット |
| — | 完成 | push して `develop` への PR を作る | PR を確かめてマージする（GitHub で行うか、チャットで頼んで「承認」と答える） | PR |

- **ファクトチェックの時期**：既定は「最後に1回」（上の表）です。見た目を直し終えてから1回だけ確かめるので、見た目の直しのたびに確かめ直すことがありません。数値や事実が結論を左右する資料では「構成のあとと最後の2回」を選べます。そのときは、2 のあとに数値と結論を支える事実だけを確かめ（2b）、承認2で構成と一緒に確かめてもらいます。4 では残りの記述と、そのあとに文が変わったスライドを確かめます。

- **承認の答え方**：「承認」「OK」のように、同意の言葉だけで答えます。ほかの言葉が混じると承認として記録されず、AI がもう一度聞きます。直してほしいときは「3枚目の数字を直して」のように書けば、その工程に戻ります。
- **AI がしないこと**：承認の記録（あなたの答えを受けて仕組みが記録します）、見た目や文章の良し悪しの判断、PR のマージ。
- **途中で止まったとき**：`/make-slides 続き` のように頼めば、どこまで進んだかを AI が確かめて、続きから始めます。

### 構成の進め方

工程1b で、構成をどう決めるかを聞かれます。

| 選ぶもの | AI の動き方 |
|---|---|
| 決まっている | あなたの構成（並びと中身）を変えない。問題があれば報告だけし、直すかはあなたが決める |
| たたき台がある | たたき台をもとに、調査に基づく修正案を出す。採用するかはあなたが決める |
| 相談して決めたい | 目的と伝えたい結論から章立ての案を出し、相談しながら固める |

### できあがったスライドを直すとき

`/make-slides` で直したいことを伝えます。`deck.html` は直接直さず、元の `outline.md` を直してビルドし直します。

| 直したいこと | 戻る工程 |
|---|---|
| 目的・聞き手・長さなどの前提 | 1b（ヒアリング）から |
| 文・数値・スライドの並び、スライドの型や図の型 | 2（構成）から。文を変えたスライドだけファクトチェックし直す（見た目だけの変更は承認し直すだけ） |
| 色・フォント・部品の形 | 直せません（ハーネスで決まっているため。変えたいときはハーネスを直す） |

直したあとは、戻った工程よりあとの承認をもう一度行います。

### 発表した版を残すとき（任意）

「発表した版を残して」と頼むと、AI が `develop` から `main` への PR を作ります。あなたがマージすると、AI が `main` にタグ（`<deck-id>`）を付けます。

### スライドの各部の呼び方

| 呼び方 | 場所と中身 |
|---|---|
| タイトル | 左上の1行。結論を1文で書く |
| lead（説明文） | タイトルの下の2〜3行の平文。タイトルを補い、図の読み方と言いたいことを書く。「note」と呼ぶこともある |
| 本文 | lead の下。図や箇条書き |
| 発表者ノート（`notes`） | スライドには出ない、話すときの補足。lead とは別物 |

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

- GitHub でマージする代わりに、Claude Code に「PR #<番号> をマージして」と頼むこともできます。「承認」と答えるとマージコミットでマージします。続けて `develop` から `main` への PR も、同じように頼めます（タグは付けません）。
- 衝突したときは、スクリプトが途中で止まり、衝突したファイルと続け方を表示します。衝突するのは `CLAUDE.md` や `.claude/` を `my-slides` の側で直していたときだけです。
- `package-lock.json` が変わったときは、マージのあとで `npm run setup` をやり直します。
- 取り込んでも、承認済みのデッキ（`deck.html`）は自動では作り直しません。部品の見た目が変わっていても、作り直すまでは承認したときのままです。新しいハーネスで作り直したいときは、`/make-slides` で頼みます。「[できあがったスライドを直すとき](#できあがったスライドを直すとき)」と同じく直しとして扱い、作り直したあとの承認をもう一度行います。
- ビルドが「Host system is missing dependencies」や `libnss3.so` などのライブラリがないことで止まったときは、`npx playwright install-deps chromium` を実行します（sudo のパスワードを聞かれます）。`sudo npx …` とすると、nvm で入れた npx が見つからないことがあります。

## git の運用ルール

簡易 GitFlow です。ハーネスの開発でも、スライド用リポジトリでも同じルールを使います。

| ブランチ | 用途 | 切り元 → マージ先 | マージの方法 |
|---|---|---|---|
| `main` | 区切りのよい完成版 | — | — |
| `develop` | 作業の統合先（既定ブランチ） | `main` → `main` | マージコミット |
| `feature/*` | 1つの作業（デッキ1件も1つ） | `develop` → `develop` | squash |
| `feature/harness-update` | ハーネスの更新の取り込み | `develop` → `develop` | マージコミット |
| `hotfix/*` | `main` の緊急修正 | `main` → `main` と `develop` | — |

スライド用リポジトリでは、発表した版の `main` に `<deck-id>` のタグを付けます（2回目からは `<deck-id>-2`…）。

PR のマージは、GitHub で行うか、チャットで AI に頼みます。チャットで頼むと、AI が承認を頼むので「承認」だけを送ってください。承認のあと、決まったスクリプト（`merge.mjs`）だけがマージします。承認のあとに PR へ push されたときと、マージ先が `develop`・`main` 以外のときは、マージしません。`main` へマージしたときは、タグもスクリプトが付けます。AI が `gh pr merge` を直接実行することはできません。

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
