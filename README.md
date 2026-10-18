# claude-code-slide-html

Claude Code で、構成の検討から HTML スライド（`deck.html`）の作成までを半自動化するハーネスです。

> **構築中です。** Skill やスクリプトはまだ揃っていません。

## このリポジトリの位置づけ

| リポジトリ | 公開範囲 | 置くもの |
|---|---|---|
| このリポジトリ（ハーネス） | public | `CLAUDE.md`、`.claude/`、サンプル。スライドの中身は置かない |
| スライド用リポジトリ（利用者が作る） | private | ハーネス一式 ＋ `decks/`（スライド1件ごとの作業フォルダ） |

このリポジトリでは `decks/` を `.gitignore` で管理外にしています。スライドの中身が公開されないようにするためです。

## 使い方

### 1. スライド用リポジトリを作る

public リポジトリのフォークは private にできません。そのため、フォークではなく **複製** で private リポジトリを作ります。

1. GitHub で private の空リポジトリを作ります（例：`my-slides`。README やライセンスは追加しない）。
2. このリポジトリを履歴ごと複製します。

   ```sh
   git clone --bare https://github.com/<owner>/claude-code-slide-html.git
   cd claude-code-slide-html.git
   git push --mirror https://github.com/<owner>/my-slides.git
   cd ..
   rm -rf claude-code-slide-html.git
   ```

3. 複製したリポジトリを手元に clone し、`.gitignore` から次の2行を削除してコミットします。これで `decks/` も git で管理されます。

   ```gitignore
   decks/*
   !decks/.gitkeep
   ```

### 2. ハーネスの更新を取り込む

複製したリポジトリは履歴を引き継いでいるため、ハーネスの更新を merge で取り込めます。

```sh
# 初回だけ
git remote add harness https://github.com/<owner>/claude-code-slide-html.git

# 更新を取り込むとき
git fetch harness
git merge harness/main
```

> この手順は、構築の後半で実際に動くことを確認します。

### 3. セットアップ（初回だけ）

必要なもの：Node.js 22 以上、Python 3、git。

```sh
# ビルドに使う npm パッケージ（版は package-lock.json で固定）
cd .claude/skills/html-build
npm ci
# 検査と PDF に使うブラウザ（Chromium）
node node_modules/playwright/cli.js install chromium
cd ../../..

# フォントのサブセット化に使う Python のパッケージ
python3 -m pip install fonttools==4.67.0 brotli==1.2.0
```

- 使っているパッケージとその版は、すべて `.claude/skills/license-notice/registry.yaml` に登録しています。版を変えるとビルドの照合で止まります。
- 確認：見本をビルドして、終了コードが 0 なら準備完了です。

  ```sh
  node .claude/skills/html-build/scripts/build.mjs examples/sample-deck
  ```

  `examples/sample-deck/build/` に `deck.html`（ブラウザで開く）、`deck.pdf`、`build-log.md`、`assets-manifest.yaml` ができます。

### 4. スライドを作る

（構築後に記載します。いまは `decks/<deck-id>/outline.md` を `examples/sample-deck/outline.md` にならって書き、上のコマンドの `examples/sample-deck` を `decks/<deck-id>` に変えてビルドできます）

## git の運用ルール（簡易 GitFlow）

ハーネスの開発と、スライド用リポジトリでの作業の両方で、このルールを使います。

### ブランチ

| ブランチ | 役割 | 切り元 | マージ先 |
|---|---|---|---|
| `main` | 区切りのよい完成版だけを置く | — | — |
| `develop` | 作業の統合先。GitHub の既定ブランチにする | `main` | `main` |
| `feature/<短い英語>` | 1つの作業（例：`feature/claude-md`） | `develop` | `develop` |
| `hotfix/<短い英語>` | `main` の緊急修正 | `main` | `main` と `develop` |

### マージ

| 向き | 方法 | タイミング |
|---|---|---|
| `feature/*` → `develop` | PR を作り、確認してから **squash マージ**（1つの作業を1コミットにまとめる） | 作業が終わったとき |
| `develop` → `main` | PR を作り、**マージコミット** で取り込む（区切りは main のマージコミットで分かるため、タグは付けない） | 区切りのよいところ（ハーネスでは構築順序の1フェーズごと） |
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

### 注意

- このリポジトリは public です。トークン、パスワード、案件の情報をコミットしないでください。

## ライセンス

[MIT](LICENSE)
