# スパイク（2026-10-17）：描画方式の比較

ハーネスの作り方を決めるために行った試作の記録。ここでの結果から、要求文書の Q1（スライドの仕組み）・Q7（図のライブラリ）・Q9（描画のタイミング）を決めた。

## 結論

- スライドは自前の HTML/CSS/JS で作る。
- 図表は HTML/CSS（Tailwind）の部品が主。Mermaid は複雑な関係図だけ。
- CSS・図・フォントはビルド時に作って1ファイルの HTML に埋め込み、外部から何も読み込まない。
- フォントは Noto Sans JP を使う文字だけにサブセット化して埋め込む。

詳しい比較は [comparison.md](comparison.md)、見た目の比較は [compare-c-d.png](compare-c-d.png)（左：Mermaid・Vega-Lite、右：HTML/Tailwind の部品）。

## ファイル

| ファイル | 内容 |
|---|---|
| `outline.md` | 試作用の3枚（表紙、フロー図、棒グラフ）。数値は架空。図は最初に試した Mermaid・Vega-Lite の書き方のまま |
| `comparison.md` | 方式A〜D の比較結果と、試作で見つかった注意点 |
| `compare-c-d.png` | 方式C と方式D の見た目の比較 |
| `d/build.mjs` | 方式D：部品（flow・bar）とレイアウトで `src.html` を組み立てる。寸法はスクリプトが計算する |
| `d/theme.css` | 方式D：Tailwind v4 の `@theme` によるトークン |
| `d/embed_font.py` | Noto Sans JP を使う文字だけにサブセット化して埋め込む |

- 方式A〜C のファイルと、生成した `deck.html`・PDF・スクリーンショットは含めていない。生成物にはフォントが埋め込まれており、ライセンス表記の仕組み（構築順序の2）ができるまで配布しないため。
- `build.mjs` は、スパイクでは方式A の `deck.html` からページ送りのコードを読んでいたが、単体で動くようにコードを直接書いた。
- 本番のハーネスでは、これらを `.claude/skills/html-build/` の部品とスクリプトとして作り直す。ここはあくまで記録。
- **見た目（色、部品のデザイン、レイアウト）は参考にしない。** スパイクで確かめたのは仕組み（ビルド時の描画、フォント埋め込み、寸法の自動計算）だけ。本番の `theme.css`・部品・レイアウトは、デジタル庁のダッシュボードのガイドブック（要求文書 9.2、構築順序の3）を基準に作る。

## 方式D を手元で再現する

Node.js と Python 3 が必要。

```sh
cd examples/spike-2026-10-17/d
npm install tailwindcss @tailwindcss/cli @fontsource/noto-sans-jp
python3 -m pip install fonttools brotli

node build.mjs                                        # src.html を作る
npx tailwindcss -i theme.css -o tw.css --minify       # 使っているクラスだけの CSS を作る
python3 -c "s=open('src.html',encoding='utf-8').read();c=open('tw.css',encoding='utf-8').read();open('styled.html','w',encoding='utf-8').write(s.replace('/*TAILWIND*/',c))"
python3 embed_font.py styled.html deck.html           # フォントを埋め込む
```

`deck.html` をブラウザで開き、`p` キーで発表モード、矢印キーでページ送り。生成したファイルはコミットしない。
