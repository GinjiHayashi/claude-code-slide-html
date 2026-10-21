# git（make-slides。スライド用リポジトリのとき）

`make-slides` の続き。スライド用リポジトリでデッキを決めたときに読む（`branch.mjs` が「使わない」と出すハーネスのリポジトリでは読まない）。

スライド用リポジトリ（README「1. スライド用リポジトリを作る」）では、デッキも git で管理する。ブランチとマージのきまりは README「git の運用ルール」。

1. **ブランチ**：1つのデッキ（発表1回分のスライド一式）につき1本。どのブランチで作業するかは自分で判断せず、`node .claude/skills/make-slides/scripts/branch.mjs decks/<deck-id>` で決める。
   - 「すること」が「使わない」なら、この節はすべて行わない（ハーネスのリポジトリなど、`decks/` が git の管理外のとき）。
   - 「新規」「続き」「直し」なら、「コマンド」があれば実行する。新規は `feature/<deck-id>`、完成後の直しは `feature/<deck-id>-fix`（2回目からは `-fix2`…）になる。
   - 「人間に聞く」なら、理由を伝えて答えを待つ。コミットしていない変更は消さない。
   - squash マージのあとは、元のブランチも残っている。そこで直しを始めない（マージ済みの古い中身のため）。
2. **コミット**：承認が記録されるたびに、そのデッキのフォルダだけをコミットする（承認の記録 `approvals.yaml` と、承認された内容が同じコミットに入るように）。
   - 最終確認より前：`git add decks/<deck-id> ':(exclude)decks/<deck-id>/build' && git commit -m "feat(<deck-id>): <承認されたもの> を承認"`（例：`brief.md と outline-draft.md を承認`、`outline.md を承認`、`outline.md と factcheck.md を承認`）。直しの途中でビルドした `build/` は入れない。
   - 最終確認：`git add decks/<deck-id> && git commit -m "feat(<deck-id>): build/deck.html を承認（最終確認）"`（承認3と一緒なら `outline.md と factcheck.md と build/deck.html を承認（最終確認）`）。ビルドの結果（`build/` の `deck.html`・`deck.pdf`・`build-log.md`・`assets-manifest.yaml`）を入れる（承認した成果物そのものを残すため）。
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
