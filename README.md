# claude-code-slide-html

Claude Code で、構成の検討から HTML スライド（`deck.html`）の作成までを半自動化するハーネスです。

> 資料を Web で開いて確かめる調査（researcher・fact-checker）は、通信を許した環境ではまだ試していません。使い始めたら、出典が実際に開かれているかを確かめてください。

## クイックスタート

必要なもの：Node.js 22 以上、Python 3、git、Claude Code。

1. **スライド用の private リポジトリを作る**（初回だけ）：下の「[1. スライド用リポジトリを作る](#1-スライド用リポジトリを作る)」の手順で、このリポジトリを複製します。
2. **セットアップする**（初回だけ）：作ったリポジトリで実行し、見本のビルドが終了コード 0 で終われば準備完了です（`examples/sample-deck/build/deck.html` をブラウザで開けます）。

   ```sh
   npm run setup
   npm run build -- examples/sample-deck
   ```

3. **スライドを頼む**：Claude Code を起動し、`/make-slides` に続けて依頼を書きます。

   ```text
   /make-slides 新任職員向けに、行政のデジタル化の歩みを10分で話したい。
   ```

4. **質問と承認に答える**：AI が足りないことを質問し、3回（前提の `brief.md`、構成とファクトチェック、できあがった `deck.html`）承認を求めます。答えは自由な言葉で構いません。
5. **受け取る**：`decks/<deck-id>/build/deck.html` ができます。1ファイルで完結しているので、そのまま渡して共有できます。

途中で止まったときや、完成したスライドを直したいときも `/make-slides` で続きを頼めます。流れの全体は `.claude/skills/make-slides/SKILL.md` の「全体の流れ」にあります。

## このリポジトリの位置づけ

| リポジトリ | 公開範囲 | 置くもの |
|---|---|---|
| このリポジトリ（ハーネス） | public | `CLAUDE.md`、`.claude/`、サンプル。スライドの中身は置かない |
| スライド用リポジトリ（利用者が作る） | private | ハーネス一式 ＋ `decks/`（スライド1件ごとの作業フォルダ） |

このリポジトリでは `decks/` を `.gitignore` で管理外にしています。スライドの中身が公開されないようにするためです。

## 使い方

### 1. スライド用リポジトリを作る

public リポジトリのフォークは private にできません。そのため、フォークではなく **複製** で private リポジトリを作ります（GitHub Docs「Duplicating a repository」の手順を、`main` と `develop` だけを送るように変えたもの）。

1. GitHub で private の空リポジトリを作ります（例：`my-slides`。README やライセンスは追加しない）。
2. このリポジトリの `main` と `develop` を、履歴ごと送ります。`--mirror` で送ると、ハーネスの作業用のブランチ（`feature/*`）まで複製されるため、2つだけを送ります。

   ```sh
   git clone --bare https://github.com/<owner>/claude-code-slide-html.git
   cd claude-code-slide-html.git
   git push https://github.com/<owner>/my-slides.git main develop
   cd ..
   rm -rf claude-code-slide-html.git
   ```

3. GitHub の `my-slides` の Settings → General → Default branch を `develop` にします。
4. 手元に clone し、`decks/.gitignore` を消してコミットします。これで `decks/` も git で管理されます（承認の依頼の一時ファイル `approval-request.yaml` だけは、ルートの `.gitignore` で管理外のまま）。

   ```sh
   git clone https://github.com/<owner>/my-slides.git
   cd my-slides
   git rm decks/.gitignore
   git commit -m "chore: decks/ を git で管理する（スライド用リポジトリ）"
   git push origin develop
   ```

   ルートの `.gitignore` は書き換えません。書き換えると、ハーネスが `.gitignore` を変えたときに、更新の取り込みで衝突するためです。

### 2. ハーネスの更新を取り込む

複製したリポジトリは履歴を引き継いでいるため、ハーネスの更新を merge で取り込めます。取り込むのはハーネスの `main`（区切りのよい完成版）です。

```sh
# 初回だけ
git remote add harness https://github.com/<owner>/claude-code-slide-html.git

# 更新を取り込むとき
git fetch harness
git switch -c feature/harness-update develop
git merge harness/main
git push -u origin feature/harness-update
# develop への PR を作り、マージコミットで取り込む（squash にしない）
```

- この PR だけは **squash ではなくマージコミット** でマージします。squash にすると、ハーネスの履歴とのつながりが切れ、次の取り込みで、前回取り込んだ行がまた変わっているところが衝突します。
- `decks/` の中身はハーネスにないので、衝突しません。
- 衝突するのは、ハーネスと同じファイル（`CLAUDE.md` や `.claude/` の中）を、スライド用リポジトリで直していたときだけです。ハーネスのファイルは直さず、直したいときはハーネスの側を直してから取り込みます。
- 取り込んだら、見本のビルド（下の「3. セットアップ」の確認）が通るかを見ます。`package-lock.json` が変わっていたら、`npm run setup` をやり直します。

### 3. セットアップ（初回だけ）

コマンドは「クイックスタート」の 2 です。`npm run setup` は、npm のパッケージ（版は `package-lock.json` で固定）、検査と PDF に使うブラウザ（Chromium）、フォントのサブセット化に使う Python のパッケージをまとめて入れます。

- 使っているパッケージとその版は、すべて `.claude/skills/license-notice/registry.yaml` に登録しています。版を変えるとビルドの照合で止まります。
- 見本のビルドでは、`examples/sample-deck/build/` に `deck.html`（ブラウザで開く）、`deck.pdf`、`build-log.md`、`assets-manifest.yaml` ができます。

### 4. スライドを作る

頼み方は「クイックスタート」の 3〜5 です。ここでは、そのあいだに git で起きることを説明します。

git は次のように進みます（AI が行うのは 1〜3 と、頼まれたときの 4。マージは人間）。

| いつ | git でのこと |
|---|---|
| デッキを始めるとき | `develop` から `feature/<deck-id>` を作る（デッキ＝発表1回分のスライド一式） |
| 承認するたび（brief、構成とファクトチェック、最終確認） | そのデッキのフォルダをコミットする。最終確認のコミットには `build/` の `deck.html`・`deck.pdf` も入る |
| 完成したとき | push して `develop` への PR を作る。人間が確認して squash マージする |
| 完成後に直すとき | `develop` から `feature/<deck-id>-fix` を作り、同じ流れで PR |
| 発表した版を残すとき | 人間が頼むと `develop` → `main` の PR を作る。人間がマージしたあと、`main` に `<deck-id>` のタグを付けて push する（直したあと2回目の発表なら `<deck-id>-2`） |

承認の依頼中の一時ファイル（`approval-request.yaml`）はコミットされません。

ハーネスのファイル（`.claude/` と `CLAUDE.md`）は、スライド作成中に AI が変えないよう `.claude/settings.json` で守っています（詳しくは `CLAUDE.md`「固定ファイル」）。ハーネスそのものを直すときは、Claude Code が変更のたびに確認を出すので、その場で許可してください。`.claude/settings.json` と `approvals.yaml` は AI からは変えられないので、直すときは手で編集します。

完成したスライドは `build/deck.html` の1ファイルを渡して共有します（外部から何も読み込まないので、そのままブラウザで開けます）。

## git の運用ルール（簡易 GitFlow）

ハーネスの開発と、スライド用リポジトリでの作業の両方で、このルールを使います。

### ブランチ

| ブランチ | 役割 | 切り元 | マージ先 |
|---|---|---|---|
| `main` | 区切りのよい完成版だけを置く | — | — |
| `develop` | 作業の統合先。GitHub の既定ブランチにする | `main` | `main` |
| `feature/<短い英語>` | 1つの作業（例：`feature/claude-md`） | `develop` | `develop` |
| `hotfix/<短い英語>` | `main` の緊急修正 | `main` | `main` と `develop` |

既定ブランチを `develop` にする方法（リポジトリの管理者が行う。どちらか1つ）：

- 画面から：リポジトリの Settings → General → Default branch で、切り替えのボタン（⇄）を押して `develop` を選び、Update を押す。
- コマンドから（gh で管理者としてログインしているとき）：

  ```sh
  gh api -X PATCH repos/<owner>/<repo> -f default_branch=develop
  gh api repos/<owner>/<repo> --jq .default_branch   # develop と出れば完了
  ```

### マージ

| 向き | 方法 | タイミング |
|---|---|---|
| `feature/*` → `develop` | PR を作り、確認してから **squash マージ**（1つの作業を1コミットにまとめる） | 作業が終わったとき |
| `feature/harness-update` → `develop`（スライド用リポジトリ） | PR を作り、**マージコミット** で取り込む（squash にすると、次の取り込みで衝突する） | ハーネスの更新を取り込むとき |
| `develop` → `main` | PR を作り、**マージコミット** で取り込む（ハーネスではタグは付けない。区切りは main のマージコミットで分かるため。スライド用リポジトリでは、発表した版に `<deck-id>` のタグを付ける） | 区切りのよいところ（ハーネスでは、まとまった変更が develop にそろったとき） |
| `hotfix/*` → `main`、`develop` | PR を作り、両方に取り込む | 修正が終わったとき |

### コミットメッセージ

先頭に種類を付け、本文は日本語で書きます。

| 種類 | 使う場面 |
|---|---|
| `feat:` | 機能の追加（Skill、スクリプトなど） |
| `fix:` | 不具合の修正 |
| `docs:` | 文書だけの変更 |
| `chore:` | 設定やフォルダ構成などの雑務 |

例：`docs: README に git の運用ルールを追加`

スライド用リポジトリのデッキのコミットは、種類の後ろにデッキの ID を付けます（例：`feat(2026-10-17-data-platform): outline.md と factcheck.md を承認`）。

### 注意

- このリポジトリは public です。トークン、パスワード、案件の情報をコミットしないでください。

## ハーネスを直すとき

- `develop` から `feature/<短い英語>` を切って直し、`develop` への PR を作ります（上の「git の運用ルール」）。
- テストは `npm test`、見本のビルドは `npm run build -- examples/sample-deck` です。PR では CI（GitHub Actions）が同じものを実行します。
- コードの書式は Prettier でそろえています（設定は `.prettierrc.json`）。直したあとに `npx prettier@3.3.3 --write "**/*.mjs"` をかけます。Prettier はビルドに使わないので、`package.json` には入れていません。
- スライドの型や図の部品の決まりは、コード（`.claude/skills/html-build/scripts/spec.mjs` と各部品の `schema`）が正です。文書には書き写さず、`node .claude/skills/html-build/scripts/schema.mjs` を参照します。

## ライセンス

[MIT](LICENSE)
