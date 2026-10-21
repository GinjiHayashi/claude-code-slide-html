---
name: make-slides
description: スライド作成の全体の入口。新しいデッキを始めるとき、途中のデッキを続けるとき、できたスライドを直すときに使う。デッキの現在地を status.mjs で判定し、工程ごとのスキル（slide-intake、slide-hearing、slide-outline、slide-factcheck、html-build）を順に呼び、人間の承認が要るところで止まる。
---

# スライド作成の入口（make-slides）

人間の依頼から `decks/<deck-id>/build/deck.html` の完成までを、工程ごとのスキルをつないで進める。どこまで進んだかは自分で覚えて判断せず、毎回 `scripts/status.mjs` で確かめる。会話が途切れても、同じデッキで `status.mjs` を実行すれば続きから始められる。

## 全体の流れ

ワークフローの全体像はこの節にまとめてある（工程ごとの細かい手順は各スキル）。人間の承認は4回。工程の番号は `status.mjs` の「工程」と同じ。

ファクトチェックの時期は、`brief.md` の `factcheck` でデッキごとに選ぶ（ヒアリングで聞く）。既定は「最後に1回」。

```
依頼 → 1a 取り込み（slide-intake） → 1b ヒアリング（slide-hearing）
     → 承認1：brief.md（構成の草案があれば outline-draft.md も）
     → 2 構成と調査（slide-outline、researcher）
     → 承認2：outline.md
     → 3 HTML 作成（html-build。検査とライセンスの照合を含む）と、見た目の確認・直し
     → 4 ファクトチェック（slide-factcheck、fact-checker）
     → 承認3：outline.md と factcheck.md（まとめて1回）
     → 5 最終確認
     → 承認4：build/deck.html → 完成（スライド用リポジトリなら develop への PR）

「構成のあとと最後の2回」のとき：2 のあとに 2b ファクトチェック（構成のあと。数値と結論を支える事実だけ）を行い、
承認2を outline.md と factcheck.md の2つにする。4 では、2b で確かめていない記述と、2b のあとに文が変わったスライドを確かめる。

直すとき：中身・見た目 → 2 に戻る（文を変えたスライドだけ 4 をやり直し、承認3から。見た目だけなら 4 はやり直さない）。前提 → 1b に戻る（下の「直すとき」）
```

- **承認の仕組み**：AI が `request.mjs` で依頼を出す → 人間が答える → hook（`approve-hook.mjs`）が判定して `approvals.yaml` に sha256 付きで記録する → AI は `status.mjs`・`gate.mjs` で確かめる。承認のあとにファイルが変わると、ゲートが止める。
- **誰が何をするか**：AI は資料を読み、質問し、資料を md にして（`reference/`）、`brief.md`・`outline.md`・`reference/research.md`・`factcheck.md` を書き、ビルドする。人間は資料を渡し、質問に答え、承認し、ブラウザで見た目を確かめ、PR をマージする（チャットの承認で、AI に `merge.mjs` でマージさせることもできる）。
- **AI がしないこと**：承認の記録、`deck.html` を読む・直す、見た目や文章の良し悪しの判定、ハーネス（`.claude/`・`CLAUDE.md`）の変更。

## 手順

1. **デッキを決める**：
   - 新しいスライドの依頼なら、`slide-intake` から始める（デッキのフォルダもそこで作る）。スライド用リポジトリでは、`deck-id` を決めたら、フォルダを作る前に下の「git」の 1（ブランチ）を行う（先にフォルダを作ると、未コミットの変更があるとして `branch.mjs` が止まるため）。
   - 続きや直しの依頼なら、`ls decks/` で対象のデッキを探す。どれか分からなければ、候補（`deck-id` の一覧）を見せて人間に聞く。推測で選ばない。
   - `deck-id` が決まったら、下の「git」の 1（ブランチ）を行う。
2. **現在地を確かめる**：`node .claude/skills/make-slides/scripts/status.mjs decks/<deck-id>`。出力の「工程」「状態」「次に」「理由」を読む。
3. **次の工程を進める**：「次に」に書かれたスキルを読み、その手順のとおりに進める（下の「工程と止まるところ」）。
4. **区切りごとに 2 に戻る**：スキルの手順が終わったら、また `status.mjs` を実行して次を決める。「完成」になったら、手順 6 の報告をして終わる。
5. **止まるところで止まる**：人間の答えが要るところ（下の表の「止まる」）では、聞いて答えを待つ。答えを待たずに次の工程に進まない。承認が記録されたら、下の「git」の 2（コミット）を行う。
6. **完成の報告**：`build/deck.html` と（あれば）`build/deck.pdf` のパス、枚数、ビルドの注意（`build-log.md` の「注意」）を伝える。作業記録の集計（`node .claude/skills/make-slides/scripts/worklog-report.mjs decks/<deck-id>` の表）も見せる。下の「git」の 3（PR）を行い、その URL も伝える。

## 工程と止まるところ

| status.mjs の工程 | 使うスキル | 出力 | 止まる（人間に聞く） | 止まらずに進む |
|---|---|---|---|---|
| 0 開始・1a 事前情報の取り込み | `slide-intake` | `decks/<deck-id>/`、`brief.md`（草案） | 入力に足りないものを聞くとき | 入力から brief.md を書き、ヒアリングへ |
| 1b ヒアリング | `slide-hearing` | `brief.md` | 質問（聞き方は `slide-hearing/questions.md`）。brief.md（と outline-draft.md）の承認 | — |
| 2 構成 | `slide-outline` | `outline.md`、`reference/research.md` | モードごとの相談（章立ての案、修正案、問題の報告）。outline.md の承認 | 調査（`researcher`） |
| 2b ファクトチェック（構成のあと。「2回」のときだけ） | `slide-factcheck` | `factcheck.md`（`round: 構成のあと`） | P0 の判断。outline.md と factcheck.md をまとめて1回で承認 | fact-checker の実行 |
| 3 HTML 作成（ライセンスを含む） | `html-build`（ライセンスはビルドの中で `license-notice` のスクリプトが行う） | `build/` の `deck.html`・`deck.pdf`・`build-log.md`・`assets-manifest.yaml` | ビルドが不合格で、内容を変える直しが要るとき。見た目の直しを人間に頼まれたとき | 構成の承認のあと、ゲートが通ればそのままビルドする。見た目の直しは、承認を頼まずに直してビルドし直す |
| 4 ファクトチェック | `slide-factcheck` | `factcheck.md` | P0 の判断。outline.md と factcheck.md をまとめて1回で承認 | 見た目の直しが済んだら、そのまま fact-checker を実行する |
| 5 最終確認 | なし（人間） | — | build/deck.html の承認 | — |
| 承認の確認 | なし | — | 人間の答え待ち。答えは hook が記録する | — |

- **承認を頼むとき**は、下の「承認の頼み方」に従う。答えが「直して」なら、そのスキルの手順に戻って直す。
- **ビルド**は `html-build` で行う（承認の確認は `html-build` の手順1）。止められたら理由を人間に伝え、`status.mjs` の「次に」に戻る。検査の不合格は、ふつうは構成の工程の試しのビルド（`slide-outline` の手順6）で片付いている。
- **ビルドが不合格**のときは、`html-build` の「不合格のとき」に従う。内容を変えない直し（改行や太字の位置、図のラベルの略し方など、主張・数値・順序が変わらないもの）は `outline.md` を直してビルドし直してよい。
  - 工程 3 のうちは、構成の承認のあとに `outline.md` を直しても、承認は頼み直さない（ゲートは注意を出すだけ）。工程 4 のあとの承認3で、変わったところをまとめて見てもらう。
  - 工程 4 のあと（承認3のあと）に `outline.md` を直したら、承認3をやり直す。文が変わったスライドは、ファクトチェックもやり直す（下の「直すとき」）。
  - 内容を変える直し、内容を変えるかどうか迷う直しは、人間に報告して判断を仰ぐ。
  - brief.md の「構成の進め方」が「決まっている」なら、人間が書いた文は字数のためでも変えず、どこが収まらないかを伝えて人間に聞く（`slide-outline`）。

## 承認の頼み方

1. 承認してもらうファイルを決めて、`node .claude/skills/make-slides/scripts/request.mjs decks/<deck-id> <ファイル…>` を実行する（例：`brief.md`、`outline.md factcheck.md`、`build/deck.html`）。依頼は `approval-request.yaml` に書かれる。
2. そのあとで、次の決まった文で聞く（`request.mjs` が対象を入れた文を出す）。言い回しを変えない。
   > 〈対象〉を承認しますか？承認なら『承認』だけを送ってください。直したいところがあれば、その内容を書いてください。
   - 承認になるのは、短い同意の語（「承認」「OK」「はい」など）だけの答え。ほかの言葉が混じると hook は判断できないとして記録しない。
   - 記録されなかったときは、次の決まった文で聞き直す：
     > ほかの言葉が混じっていたので、承認として記録されませんでした。承認なら『承認』だけを送ってください。
   - 「承認もします。ついでに S03 も直して」のように、承認とほかの依頼が一緒に来たら、依頼を先に片付ける。直したらファイルが変わるので、そのあとで承認をあらためて頼む（`request.mjs` からやり直す）。依頼がなければ、上の決まった文で聞き直すだけにする。
3. 答えは hook が判定して記録し、結果を伝えてくる。AI は記録しない。承認した人として、git の `user.name` が記録される（空なら記録されない）。人間が自分の名前を設定した環境で使う。
4. 承認されたかは自分で判断せず、`status.mjs` か `gate.mjs decks/<deck-id> <outline|factcheck|build|final>` で確かめる。

## 最終確認（工程5）

1. 人間に、`decks/<deck-id>/build/deck.html` をブラウザで開いて見てもらうよう頼む（`deck.pdf` があればそれも）。AI は `deck.html` を読まない。
2. 合わせて、`build-log.md` の注意（図が3つ以上のスライド、`html:` を使ったスライドなど）を伝え、見た目を確かめるときの確認表として `design-reference/checklist.md` を示す（AI は見た目をレビューしない。確かめるのは人間）。
3. 「承認の頼み方」で `build/deck.html` の承認を頼む。
4. 直してほしいと言われたら、下の「直すとき」に進む。承認されたら `status.mjs` が「完成」になる。

## 直すとき

人間の直したい内容で、戻る工程を決める。`deck.html` は直さない。

| 直したい内容 | 戻る工程 | やること |
|---|---|---|
| 目的・聞き手・長さなど前提が変わる | 1b ヒアリング | `slide-hearing` で brief.md を直して承認し直し、そのあと構成から見直す |
| スライドの中身（文、数値、並び、足す・削る） | 2 構成 | `slide-outline` で該当スライドの節だけ直し、ビルドし直して、そのスライドをファクトチェックし直し、outline.md と factcheck.md を承認し直す |
| 見た目のうち outline.md で決まるもの（型、図の型、置き方、大きさ、改行、太字） | 2 構成 | `slide-outline` で該当スライドの節だけ直し、ビルドし直して、outline.md と factcheck.md を承認し直す（ファクトチェックはやり直さない） |
| 人間が outline.md の文を自分で直した | 2 構成 | 下の「人間が outline.md を直したとき」。AI は人間の書いた文を書き換えない |
| 図を変えてほしい（人間が `change` に書いた） | 2 構成 | 下の「図の変更の指示（change）」 |
| 色・フォント・部品の形など、固定ファイルで決まるもの | 直さない | 固定ファイルは変えない（CLAUDE.md）。人間に理由を伝えて判断を仰ぐ |
| ハーネスの更新を取り込んだあと、新しいハーネスで作り直す | 3 HTML 作成 | 人間に頼まれたときだけ作り直す（承認済みの deck.html を自動で作り直さない）。ビルドし直して、最終確認をもう一度頼む。ビルドや検査が outline.md の直しを求めたら、2 構成に戻る |

- outline.md を直したら、文を変えたスライドはファクトチェックからやり直す。ゲートが、ファクトチェックのあとに文が変わったスライドの番号を出す（`slide-factcheck` の手順 2〜5 をそのスライドだけで行い、outline.md と factcheck.md を承認し直す）。見た目だけの変更は、承認のやり直しだけで済む（文と見た目の分け方は `slide-factcheck` の手順 9 のあと）。
- そのあとビルドし直し、最終確認をもう一度頼む。
- どこからやり直すかは `status.mjs` が示すので、直したら 2 に戻る。

### 人間が outline.md を直したとき

文（`title`・`lead`・本文・図の中の字・数値）は、人間が `outline.md` を直接直してよい。`deck.html` は直さない。

人間の手順：

1. `decks/<deck-id>/outline.md` をエディタで開き、直したいスライドの節（`## S05` から次の `##` まで）を探す。
2. 値だけを書き換える。`- 項目:` の名前、字下げ（スペース）、`## S05` の見出しは変えない。文に `:` や `#` を含むときは `"…"` で囲む。
3. 図の形・並び・強調を変えたいときは、図のデータを自分で直さず、そのスライドに `- change: <どう変えたいか>` の1行を書く（下の「図の変更の指示（change）」）。
4. 保存して、AI に「S05 を直した」のように、直したスライドを伝える。

AI の手順：

1. `node .claude/skills/html-build/scripts/check-outline.mjs decks/<deck-id>/outline.md` で書式を確かめる。エラーや字数の注意があれば、どこがなぜかを人間に伝える。**人間の書いた文は、モードによらず AI が書き換えない**（直すかどうかは人間が決める）。
2. `change` があれば、下の「図の変更の指示（change）」に進む。
3. ビルドし直し（`html-build`）、`status.mjs` の「次に」に戻る。文を変えたスライドは、ゲートがファクトチェックのやり直しを示す。

### 図の変更の指示（change）

図は、人間がスライドごとに `change` に指示を書き、AI が直す。AI が直してよいのは、`change` を書いたスライドの図の項目（`diagram`・`diagrams`・`html`・`idea`・`match`）だけ。ほかのスライドと、文の項目は変えない。

人間の手順：

1. `outline.md` の直したいスライドの節に、`idea`・`match` のすぐ下に1行足す（例：`- change: 窓口サービスの棒の横に「全体の3割」と書き添える`）。何を・どう変えたいかを1〜2文で書く。図の部品の名前は書かなくてよい。
2. 複数のスライドに一度に書いてよい。文も一緒に直したいときは、文は自分で直す（上の「人間が outline.md を直したとき」）。
3. 保存して、AI に「change を反映して」と伝える。

AI の手順：

1. `node .claude/skills/make-slides/scripts/edit-check.mjs start decks/<deck-id>` を実行する。`change` のあるスライドが一覧になり、直す前の `outline.md` が写される（`build/.edit-check.json`。git の管理外）。`change` の文は作業記録に残る。
2. 一覧のスライドだけ、図を直す。決め方は構成のときと同じ（`slide-outline` の手順5）：`change` を反映した新しい絵を考え、`idea` を**その絵の説明に書き換える**（書き足さない。3行・全角120字まで）。`match` を見直し、図のデータを直す。
3. 直し終えたら、`change` を空にする（`- change:` のまま値を消すか、行ごと消す）。
4. 文（`title`・`lead`・本文・`source`・`notes`・`claims`）も変えないと図が成り立たないときは、変えずに止めて、どこをどう変えたいかを人間に聞く。
5. `node .claude/skills/make-slides/scripts/edit-check.mjs end decks/<deck-id>` を実行する。エラーなら、出たところを元に戻して end をやり直す（写しは残っている）。合格なら写しが消え、`idea` の前と後が出る。
6. ビルドし直し（`html-build`）、人間に `idea` の前と後と、直したスライドの番号を伝える。図の中の字や数値を変えたスライドは、ゲートがファクトチェックのやり直しを示す（`change` の行そのものは承認の比べ方に入らない）。

- `change` が残っている間は、書式チェックが注意を出し、`request.mjs` は outline.md の承認の依頼を出さない。

## git（スライド用リポジトリのとき）

スライド用リポジトリ（README「1. スライド用リポジトリを作る」）では、デッキも git で管理する。ブランチとマージのきまりは README「git の運用ルール」。

1. **ブランチ**：1つのデッキ（発表1回分のスライド一式）につき1本。どのブランチで作業するかは自分で判断せず、`node .claude/skills/make-slides/scripts/branch.mjs decks/<deck-id>` で決める。
   - 「すること」が「使わない」なら、この節はすべて行わない（ハーネスのリポジトリなど、`decks/` が git の管理外のとき）。
   - 「新規」「続き」「直し」なら、「コマンド」があれば実行する。新規は `feature/<deck-id>`、完成後の直しは `feature/<deck-id>-fix`（2回目からは `-fix2`…）になる。
   - 「人間に聞く」なら、理由を伝えて答えを待つ。コミットしていない変更は消さない。
   - squash マージのあとは、元のブランチも残っている。そこで直しを始めない（マージ済みの古い中身のため）。
2. **コミット**：承認が記録されるたびに、そのデッキのフォルダだけをコミットする（承認の記録 `approvals.yaml` と、承認された内容が同じコミットに入るように）。
   - 最終確認より前：`git add decks/<deck-id> ':(exclude)decks/<deck-id>/build' && git commit -m "feat(<deck-id>): <承認されたもの> を承認"`（例：`brief.md と outline-draft.md を承認`、`outline.md を承認`、`outline.md と factcheck.md を承認`）。直しの途中でビルドした `build/` は入れない。
   - 最終確認：`git add decks/<deck-id> && git commit -m "feat(<deck-id>): build/deck.html を承認（最終確認）"`。ビルドの結果（`build/` の `deck.html`・`deck.pdf`・`build-log.md`・`assets-manifest.yaml`）を入れる（承認した成果物そのものを残すため）。
   - 種類の後ろの `(<deck-id>)` は、どのデッキのコミットかを示すため（README「コミットメッセージ」）。
   - 今いるブランチが `feature/<deck-id>`（か `-fix`）であることを、コミットの前に確かめる。違えば止めて人間に伝える。
   - `approval-request.yaml` は `.gitignore` で管理外。
   - 作業記録 `worklog.jsonl` は hook がターンごとに足すので、コミットのあとも変わる。次のコミットでまとめて入る（`branch.mjs` の判断には使わない）。
3. **PR**：「完成」になったら、`git push -u origin <ブランチ>` のあと、develop への PR を作る（`gh pr create --base develop`）。PR の本文には、デッキの題名、枚数、ファクトチェックの要確認の数、ビルドの注意を書く。
4. **マージ**：人間が GitHub でマージするか、チャットの承認でマージする。AI は `gh pr merge` を直接使わない（`.claude/settings.json` で止める）。
   - チャットで頼まれたら、`node .claude/skills/make-slides/scripts/request.mjs decks/<deck-id> --merge <PR の番号>` で依頼を出し、出力の決まった文で聞く。CI が失敗しているチェックが出たら、その名前も伝えて、それでもよいかを聞く。
   - 承認されたら `node .claude/skills/make-slides/scripts/merge.mjs decks/<deck-id> <PR の番号>` でマージする。承認の記録がない、承認のあとに PR へ push された、マージ先が develop・main 以外なら、スクリプトが止める。止まったら理由を伝え、必要なら承認を頼み直す。
   - マージの方式はスクリプトが決める：develop へは squash、main へはマージコミット（ハーネスの更新の取り込み `feature/harness-update` は develop へもマージコミット）。
   - ハーネスの更新の PR（`npm run update-harness` が作る `feature/harness-update` → develop と、そのあとの develop → main）は、デッキがないので `decks/<deck-id>` の代わりに `decks/_harness` を使う（`request.mjs decks/_harness --merge <PR の番号>` → `merge.mjs decks/_harness <PR の番号>`）。ほかの PR は頼めず、main へのマージでもタグは付けない。承認の記録は `.gitignore` で管理外。
5. **発表した版（main とタグ）**：人間に頼まれたときだけ行う。
   - develop から main への PR を作る（`gh pr create --base main --head develop`）。マージは 4 と同じ（人間が GitHub でマージするか、チャットの承認で `merge.mjs`）。
   - `merge.mjs` でマージしたら、スクリプトが main の最新のコミットにタグを付けて push する（`<deck-id>`、すでにあれば `<deck-id>-2`、`-3`…）。人間が GitHub でマージしたときは、`git tag <deck-id>`（2回目からは `<deck-id>-2`）→ `git push origin <タグ>` を行う。

## しないこと

- 現在地を `status.mjs` を使わずに決める。承認されたかを自分で判断する。`approvals.yaml` を書く。
- 人間の答えを待たずに、承認が要る工程を越える。
- `deck.html` を読む、手で直す。
- 固定ファイル（CLAUDE.md）を変える。
- 承認の記録なしに PR をマージする（`gh pr merge` を直接使う）。develop・main に直接コミットする。ハーネスのリポジトリ（`decks/` が管理外）でデッキをコミットする。

## ファイル

AI が実行するスクリプト：

| ファイル | 中身 |
|---|---|
| `scripts/status.mjs` | デッキの現在地（工程・状態・次に使うスキル・理由）を、ファイルと承認の記録とゲートから判定する |
| `scripts/gate.mjs` | 工程に進めるか（outline・factcheck・build・final）を承認の記録で判定する。final は最終確認の前 |
| `scripts/branch.mjs` | スライド用リポジトリで、デッキの作業をどのブランチで行うか（新規・続き・直し）を決める |
| `scripts/request.mjs` | 承認の依頼を出す（approval-request.yaml を書く）。`--merge <PR の番号>` で PR のマージの承認を頼む |
| `scripts/merge.mjs` | 承認された PR だけをマージし、main のあとはタグを付けて push する |
| `scripts/github.mjs` | PR を gh で読む・マージする共通の処理（ほかのスクリプトが使う） |
| `scripts/approvals.mjs` | 承認の記録の読み書き（ほかのスクリプトが使う） |
| `scripts/edit-check.mjs` | 図の変更の指示（`change`）の反映を確かめる。`start` で直す前の outline.md を写し、`end` で、`change` のあるスライドの図の項目のほかが変わっていないか、`change` が空になったかを確かめる |
| `scripts/worklog-report.mjs` | 作業記録（`worklog.jsonl`）を集計し、工程ごとの開始・終了、AI の作業時間、人の待ち時間、やり取り・ビルド・サブエージェントの回数、工程の戻り、承認の聞き直しを表で出す（ファイルには書かない） |

hook（`.claude/settings.json` から呼ばれる。AI は実行しない）：

| ファイル | いつ | 中身 |
|---|---|---|
| `scripts/approve-hook.mjs` | 人間が答えたとき（UserPromptSubmit） | 人間の答えを判定して approvals.yaml に記録する |
| `scripts/protect-bash.mjs` | Bash を実行する前（PreToolUse） | approvals.yaml への書き込みを止め、ハーネスのファイル（`.claude/`・`CLAUDE.md`）への書き込みには確認を出す |
| `scripts/protect-edit.mjs` | Edit・Write を実行する前（PreToolUse） | ハーネスのファイルの編集に確認を出す |
| `scripts/protect-check.mjs` | 会話の始めと、ターンの終わり（SessionStart・Stop） | ハーネスのファイルの状態を覚え、すり抜けた変更を見つけて伝える |
| `scripts/worklog.mjs hook` | 会話の始め、人間が書いたとき、ターンの終わり、サブエージェントの終わり（SessionStart・UserPromptSubmit・Stop・SubagentStop） | デッキの `worklog.jsonl` に時刻と工程を足す（作業記録）。ターンの終わりには、使ったツールの回数・変えたファイル・トークン数も足す。どのデッキかはブランチ `feature/<deck-id>` で決め、わからなければ書かない。人間の発言の本文は書かない。ビルドの結果は `build.mjs`、承認の依頼は `request.mjs` が足す |

ハーネスの確認（protect-*）は、スライド作成中だけ出す。ハーネスのリポジトリ（`decks/.gitignore` を git で管理）での開発中は出さず、approvals.yaml と `.claude/settings.json` だけを守る。判定は `.claude/lib/common.mjs` の `harnessDev`。環境変数 `SLIDE_HARNESS_MODE`（`dev`・`slides`）で上書きできる。
