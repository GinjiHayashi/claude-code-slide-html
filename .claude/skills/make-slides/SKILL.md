---
name: make-slides
description: スライド作成の全体の入口。新しいデッキを始めるとき、途中のデッキを続けるとき、できたスライドを直すときに使う。デッキの現在地を status.mjs で判定し、工程ごとのスキル（slide-intake、slide-hearing、slide-outline、slide-factcheck、html-build）を順に呼び、人間の承認が要るところで止まる。
---

# スライド作成の入口（make-slides）

人間の依頼から `decks/<deck-id>/build/deck.html` の完成までを、工程ごとのスキルをつないで進める。どこまで進んだかは自分で覚えて判断せず、毎回 `scripts/status.mjs` で確かめる。会話が途切れても、同じデッキで `status.mjs` を実行すれば続きから始められる。

## 手順

1. **デッキを決める**：
   - 新しいスライドの依頼なら、`slide-intake` から始める（デッキのフォルダもそこで作る）。
   - 続きや直しの依頼なら、`ls decks/` で対象のデッキを探す。どれか分からなければ、候補（`deck-id` の一覧）を見せて人間に聞く。推測で選ばない。
   - `deck-id` が決まったら、下の「git」の 1（ブランチ）を行う。
2. **現在地を確かめる**：`node .claude/skills/make-slides/scripts/status.mjs decks/<deck-id>`。出力の「工程」「状態」「次に」「理由」を読む。
3. **次の工程を進める**：「次に」に書かれたスキルを読み、その手順のとおりに進める（下の「工程と止まるところ」）。
4. **区切りごとに 2 に戻る**：スキルの手順が終わったら、また `status.mjs` を実行して次を決める。「完成」になったら、手順 6 の報告をして終わる。
5. **止まるところで止まる**：人間の答えが要るところ（下の表の「止まる」）では、聞いて答えを待つ。答えを待たずに次の工程に進まない。承認が記録されたら、下の「git」の 2（コミット）を行う。
6. **完成の報告**：`build/deck.html` と（あれば）`build/deck.pdf` のパス、枚数、ビルドの注意（`build-log.md` の「注意」）を伝える。下の「git」の 3（PR）を行い、その URL も伝える。

## 工程と止まるところ

| status.mjs の工程 | 使うスキル | 出力 | 止まる（人間に聞く） | 止まらずに進む |
|---|---|---|---|---|
| 0 開始・1a 事前情報の取り込み | `slide-intake` | `decks/<deck-id>/`、`brief.md`（草案） | 入力に足りないものを聞くとき | 入力から brief.md を書き、ヒアリングへ |
| 1b ヒアリング | `slide-hearing` | `brief.md` | 質問（聞き方は `slide-hearing/questions.md`）。brief.md（と outline-draft.md）の承認 | — |
| 2 構成 | `slide-outline` | `outline.md`、`research.md` | モードごとの相談（章立ての案、修正案、問題の報告） | 調査（`researcher`）。構成ができたら、承認を頼まずにファクトチェックへ |
| 3 ファクトチェック | `slide-factcheck` | `factcheck.md` | P0 の判断。outline.md と factcheck.md をまとめて1回で承認 | fact-checker の実行 |
| 4 HTML 作成・5 ライセンス | `html-build`（ライセンスはビルドの中で `license-notice` のスクリプトが行う） | `build/` の `deck.html`・`deck.pdf`・`build-log.md`・`assets-manifest.yaml` | ビルドが不合格で、内容を変える直しが要るとき | factcheck.md の承認のあと、ゲートが通ればそのままビルドする |
| 6 最終確認 | なし（人間） | — | build/deck.html の承認 | — |
| 承認の確認 | なし | — | 人間の答え待ち。答えは hook が記録する | — |

- **承認を頼むとき**は、下の「承認の頼み方」に従う。答えが「直して」なら、そのスキルの手順に戻って直す。
- **ビルドの前**には `node .claude/skills/make-slides/scripts/gate.mjs decks/<deck-id> build` を実行し、通ったときだけ `html-build` でビルドする。止められたら理由を人間に伝え、`status.mjs` の「次に」に戻る。
- **ビルドが不合格**のときは、`html-build` の「不合格のとき」に従う。字数や改行など、内容を変えない直しは `outline.md` を直してビルドし直してよい。ただし `outline.md` を変えたので、承認とファクトチェックをやり直す（手順の「直すとき」）。内容を変える直しは人間に報告して判断を仰ぐ。

## 承認の頼み方

1. 承認してもらうファイルを決めて、`node .claude/skills/make-slides/scripts/request.mjs decks/<deck-id> <ファイル…>` を実行する（例：`brief.md`、`outline.md factcheck.md`、`build/deck.html`）。依頼は `approval-request.yaml` に書かれる。
2. そのあとで「outline.md と factcheck.md を承認しますか？」のように聞く。人間は自由な言葉で答えてよい。
3. 答えは hook が判定して記録し、結果を伝えてくる。AI は記録しない。
4. 承認されたかは自分で判断せず、`status.mjs` か `gate.mjs decks/<deck-id> <outline|factcheck|build>` で確かめる。

## 最終確認（工程6）

1. 人間に、`decks/<deck-id>/build/deck.html` をブラウザで開いて見てもらうよう頼む（`deck.pdf` があればそれも）。AI は `deck.html` を読まない。
2. 合わせて、`build-log.md` の注意（図が3つ以上のスライド、`html:` を使ったスライドなど）を伝え、見た目を確かめるときの確認表として `design-reference/checklist.md` を示す（AI は見た目をレビューしない。確かめるのは人間）。
3. 「承認の頼み方」で `build/deck.html` の承認を頼む。
4. 直してほしいと言われたら、下の「直すとき」に進む。承認されたら `status.mjs` が「完成」になる。

## 直すとき（工程7）

人間の直したい内容で、戻る工程を決める。`deck.html` は直さない。

| 直したい内容 | 戻る工程 | やること |
|---|---|---|
| 目的・聞き手・長さなど前提が変わる | 1b ヒアリング | `slide-hearing` で brief.md を直して承認し直し、そのあと構成から見直す |
| スライドの中身（文、数値、並び、足す・削る） | 2 構成 | `slide-outline` で該当スライドの節だけ直し、そのスライドをファクトチェックし直して、outline.md と factcheck.md を承認し直す |
| 見た目のうち outline.md で決まるもの（型、図の型、改行、太字） | 2 構成 | 同上 |
| 色・フォント・部品の形など、固定ファイルで決まるもの | 直さない | 固定ファイルは変えない（CLAUDE.md）。人間に理由を伝えて判断を仰ぐ |

- outline.md を直したら、変えたスライドはファクトチェックからやり直す。ゲートが、ファクトチェックのあとに変わったスライドの番号を出す（`slide-factcheck` の手順 2〜5 をそのスライドだけで行い、outline.md と factcheck.md を承認し直す）。
- そのあとビルドし直し、最終確認をもう一度頼む。
- どこからやり直すかは `status.mjs` が示すので、直したら 2 に戻る。

## git（スライド用リポジトリのとき）

スライド用リポジトリ（README「1. スライド用リポジトリを作る」）では、デッキも git で管理する。ブランチとマージのきまりは README「git の運用ルール」。

1. **ブランチ**：1つのデッキ（発表1回分のスライド一式）につき1本。どのブランチで作業するかは自分で判断せず、`node .claude/skills/make-slides/scripts/branch.mjs decks/<deck-id>` で決める。
   - 「すること」が「使わない」なら、この節はすべて行わない（ハーネスのリポジトリなど、`decks/` が git の管理外のとき）。
   - 「新規」「続き」「直し」なら、「コマンド」があれば実行する。新規は `feature/<deck-id>`、完成後の直しは `feature/<deck-id>-fix`（2回目からは `-fix2`…）になる。
   - 「人間に聞く」なら、理由を伝えて答えを待つ。コミットしていない変更は消さない。
   - squash マージのあとは、元のブランチも残っている。そこで直しを始めない（マージ済みの古い中身のため）。
2. **コミット**：承認が記録されるたびに、そのデッキのフォルダだけをコミットする（承認の記録 `approvals.yaml` と、承認された内容が同じコミットに入るように）。
   - `git add decks/<deck-id> && git commit -m "feat(<deck-id>): <承認されたもの> を承認"`（例：`brief.md と outline-draft.md を承認`、`outline.md と factcheck.md を承認`、`build/deck.html を承認（最終確認）`）。
   - ビルドの結果（`build/` の `deck.html`・`deck.pdf`・`build-log.md`・`assets-manifest.yaml`）は、最終確認のコミットに入れる（承認した成果物そのものを残すため）。
   - 今いるブランチが `feature/<deck-id>`（か `-fix`）であることを、コミットの前に確かめる。違えば止めて人間に伝える。
   - `approval-request.yaml` は `.gitignore` で管理外。
3. **PR**：「完成」になったら、`git push -u origin <ブランチ>` のあと、develop への PR を作る（`gh pr create --base develop`）。PR の本文には、デッキの題名、枚数、ファクトチェックの要確認の数、ビルドの注意を書く。マージは人間が行う（squash マージ）。AI はマージしない。
4. **発表した版（main とタグ）**：人間に頼まれたときだけ行う。
   - develop から main への PR を作る（`gh pr create --base main --head develop`）。マージは人間が行う（マージコミット）。
   - マージされたら、main の最新のコミットにタグを付けて push する：`git tag <deck-id>`（直したあと2回目の発表なら `<deck-id>-2`）→ `git push origin <タグ>`。

## しないこと

- 現在地を `status.mjs` を使わずに決める。承認されたかを自分で判断する。`approvals.yaml` を書く。
- 人間の答えを待たずに、承認が要る工程を越える。
- `deck.html` を読む、手で直す。
- 固定ファイル（CLAUDE.md）を変える。
- PR をマージする。develop・main に直接コミットする。ハーネスのリポジトリ（`decks/` が管理外）でデッキをコミットする。

## ファイル

AI が実行するスクリプト：

| ファイル | 中身 |
|---|---|
| `scripts/status.mjs` | デッキの現在地（工程・状態・次に使うスキル・理由）を、ファイルと承認の記録とゲートから判定する |
| `scripts/gate.mjs` | 工程に進めるか（outline・factcheck・build）を承認の記録で判定する |
| `scripts/branch.mjs` | スライド用リポジトリで、デッキの作業をどのブランチで行うか（新規・続き・直し）を決める |
| `scripts/request.mjs` | 承認の依頼を出す（approval-request.yaml を書く） |
| `scripts/approvals.mjs` | 承認の記録の読み書き（ほかのスクリプトが使う） |

hook（`.claude/settings.json` から呼ばれる。AI は実行しない）：

| ファイル | いつ | 中身 |
|---|---|---|
| `scripts/approve-hook.mjs` | 人間が答えたとき（UserPromptSubmit） | 人間の答えを判定して approvals.yaml に記録する |
| `scripts/protect-bash.mjs` | Bash を実行する前（PreToolUse） | approvals.yaml への書き込みを止め、ハーネスのファイル（`.claude/`・`CLAUDE.md`）への書き込みには確認を出す |
| `scripts/protect-check.mjs` | 会話の始めと、ターンの終わり（SessionStart・Stop） | ハーネスのファイルの状態を覚え、すり抜けた変更を見つけて伝える |
