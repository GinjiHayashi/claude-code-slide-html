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

### 3. スライドを作る

（構築後に記載します）

## ライセンス

[MIT](LICENSE)
