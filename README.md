# claude-code-slide-html

Claude Code に、構成の検討から HTML スライド（`deck.html`）の作成までを任せるためのハーネスです。

> 調査とファクトチェック（Web で出典を開く部分）は、まだ実際のネットワークでは試していません。使い始めたら、出典が本当に開かれているかを確かめてください。

## 環境構築

このリポジトリ（public）はそのまま使わず、**複製して自分用の private リポジトリを作り、そこでスライドを作ります**。スライドの中身を公開しないためです。

### 0. 必要なもの

| ツール | 版 | 確かめ方 |
|---|---|---|
| Node.js | 22 以上 | `node -v` |
| Python | 3（pip を含む） | `python3 -m pip --version` |
| git | — | `git --version` |
| Claude Code | — | `claude --version` |
| GitHub CLI（推奨） | — | `gh auth status` |

GitHub CLI がなくても進められますが、リポジトリの作成と設定を手で行うことになります。使うときは、先に `gh auth login` でログインしておきます。

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
npm run setup                          # npm のパッケージ、Chromium、Python のパッケージを入れる
npm run build -- examples/sample-deck  # 見本をビルドして確かめる
```

エラーなく終わり、`examples/sample-deck/build/deck.html` をブラウザで開けば準備完了です。

### 3. Claude Code を起動する

```sh
claude
```

`my-slides` の中で起動します。初回はログインと、フォルダを信頼するかの確認が出ます。

## 使い方

Claude Code で `/make-slides` に続けて依頼を書きます。

```text
/make-slides 新任職員向けに、行政のデジタル化の歩みを10分で話したい。
```

1. AI が足りないことを質問します。自由な言葉で答えます。
2. 途中で3回、承認を求められます（前提の `brief.md`、構成とファクトチェック、できあがった `deck.html`）。
3. `decks/<deck-id>/build/deck.html` ができます。1ファイルで完結しているので、そのまま渡せます。

途中で止まったときや、できたスライドを直したいときも `/make-slides` で続きを頼めます。

git の操作（ブランチ、承認ごとのコミット、PR）は AI が行います。人間が行うのは PR のマージだけです。

## ハーネスの更新を取り込む

`my-slides` の中で実行します。

```sh
npm run update-harness
```

`develop` への PR ができるので、確かめて **マージコミット** でマージします（squash にすると、次の取り込みで衝突します）。

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
