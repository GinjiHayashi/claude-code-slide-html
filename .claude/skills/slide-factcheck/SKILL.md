---
name: slide-factcheck
description: 承認済みの outline.md を、fact-checker をスライドのまとまりごとに並列で呼んでファクトチェックし、結果を factcheck.md にまとめ、人間の判断を受けて outline.md を直し、承認してもらうまでを受け持つスキル。構成の承認のあとと、承認後にスライドを変えたときに使う。
---

# ファクトチェック（slide-factcheck）

承認済みの `decks/<deck-id>/outline.md` の記述が事実と一致するかを確かめ、`decks/<deck-id>/factcheck.md` にまとめる。確かめるのは `fact-checker`（`.claude/agents/fact-checker.md`）。書式は `factcheck-template.md`。

## 手順

1. **進んでよいか確かめる**：`node .claude/skills/make-slides/scripts/gate.mjs decks/<deck-id> factcheck`。止められたら先に進まず、理由を人間に伝える。
2. **まとまりに分ける**：`outline.md` のスライドを、3〜5枚ずつのまとまりに分ける。
   - `toc` と、ビルドが足す credits は対象にしない。`title`・`section`・`closing` も、言い切った文や数値があれば対象にする。
   - まとまりごとに ID の番号を割り当てる。1つ目は `FC-101` から、2つ目は `FC-201` から、のように百の位で分ける。`factcheck.md` にすでにある番号は使わない。
3. **並列で呼ぶ**：まとまりごとに `fact-checker` を呼ぶ。渡すもの：スライドの番号の範囲、`decks/<deck-id>/` のパス、始めの番号、今日の日付。
4. **まとめる**：返ってきた指摘を、ID と中身を変えずに `factcheck.md` に足す。「問題がなかった記述」と「検索の記録」は、それぞれの表にまとめる。`factcheck.md` がなければ、先頭に `deck_id` の設定を書いて作る。
5. **チェック**：`node .claude/skills/slide-factcheck/scripts/check-factcheck.mjs decks/<deck-id>/factcheck.md`。
   - エラー（終了コード 2）があれば直して、もう一度チェックする。直すのは書き方だけ。根拠のない P0・P1 は「要確認」に下げる（区分を上げたり、指摘を消したりしない）。
   - 根拠の `locator` などに「開けなかった」「検索結果による」とある P0・P1 も、「要確認」に下げる（開いて読んだ資料だけが根拠になる）。
   - エラーが0件になってから人間に報告する。
6. **報告して判断を聞く**：次の順で伝える。
   1. 件数：P0・P1・要確認の数と、問題がなかった記述の数。
   2. P0：1件ずつ、スライド、対象の記述、問題点、根拠（資料名と URL）、修正案。判断（修正する・残す・削除する）が要ることを伝える。1回に3件まで聞き、残りは数だけ伝える。
   3. P1 と要確認：1件ずつ1行で。判断は任意であることを伝える。**要確認は、0件でなければ必ず中身まで見せる**（ゲートは要確認では止まらないため）。
   4. fact-checker から報告があれば：ページの中の指示、`research.md` の主張の問題。
7. **判断を写す**：人間の答えを、言葉どおり `decision` と `decision_note` に写す。
   - 答えが4つの値（修正する・残す・削除する・出典を足す）のどれかはっきりしないときは、写さずに聞き直す。
   - 「残す」で理由が言われていなければ、理由を聞く。
   - 人間が答えていない指摘の `decision` は空のままにする。自分で判断を書かない。
8. **直す**：「修正する」「削除する」の指摘だけ、`outline.md` の該当スライドの節（`## S04` から次の見出しまで）を直す。
   - 直し方は `suggestion` か、人間が言った内容のとおりにする。ほかのところは変えない。
   - 直したら `node .claude/skills/html-build/scripts/check-outline.mjs decks/<deck-id>/outline.md` で書式を確かめる。
   - 直したスライドは、承認を頼む前に 2〜5 をそのスライドだけでやり直す（CLAUDE.md「承認後に内容を変えた場合」）。前の指摘は消さず、新しい番号で足す。新しい指摘が出たら 6 に戻る。
     - やり直さなくてよいのは、P0・P1 の `suggestion` のとおりに直したとき（根拠を確かめた直し方なので）と、記述を削除しただけのとき。
     - 要確認の `suggestion` のとおりに直したとき、人間が言った内容で直したときは、やり直す（新しい記述の根拠を確かめていないため）。
   - 「出典を足す」は、人間から出典が届いたら `research-standards` の書式で `research.md` に足し、そのスライドを 2〜5 でやり直す。
9. **承認を頼む**：
   1. 写した判断と、`outline.md` を直したところ（スライドの番号と、直す前と後）を人間に見せる。
   2. `node .claude/skills/make-slides/scripts/request.mjs decks/<deck-id> factcheck.md` で承認を依頼する。`outline.md` を直したときは `outline.md` も一緒に依頼する（`request.mjs … outline.md factcheck.md`）。
   3. 人間の答えは hook が記録する。HTML 作成に進めるかは `node .claude/skills/make-slides/scripts/gate.mjs decks/<deck-id> build` で確かめる。

承認のあとに `outline.md` のスライドを変えたときは、ゲートが「承認後に変更あり」と変わったスライドの番号を出す。そのスライドについて 2 からやり直す。

## しないこと

- `fact-checker` の指摘の中身（区分、問題点、根拠）を変える。根拠のない P0・P1 を「要確認」に下げるのは除く。
- 人間の判断を自分で書く、推測で写す。判断の前に `outline.md` を直す。
- 「修正する」「削除する」の指摘のスライド以外を直す。
- `factcheck.md` や `outline.md` の承認を自分で判断する。`approvals.yaml` を書く。
- スライドの見た目や文章の良し悪しを評価する。

## ファイル

| ファイル | 中身 |
|---|---|
| `factcheck-template.md` | factcheck.md の書式、区分、人間の判断の値と写し方 |
| `scripts/check-factcheck.mjs` | factcheck.md のチェック（書式、根拠、判断の決まり、判断待ちの P0） |
| `.claude/agents/fact-checker.md` | ファクトチェック用サブエージェント（`research-standards` を読み込んで動く） |
