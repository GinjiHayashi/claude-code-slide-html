# factcheck.md の書式

`decks/<deck-id>/factcheck.md` は、承認済みの `outline.md` をファクトチェックした結果と、それに対する人間の判断をまとめるファイル（要求文書 8章）。`fact-checker` の結果を呼び出し元（`slide-factcheck`）がここにまとめる。

チェック：`node .claude/skills/slide-factcheck/scripts/check-factcheck.mjs decks/<deck-id>/factcheck.md`

## 書式

```markdown
---
deck_id: 2026-10-24-report-automation
---

## FC-101
- slide: S04                                   # スライドの番号（outline.md の見出し）
- claim_id: C-003                              # research.md の主張の ID。ID のない記述は「なし」
- target: 「〇〇は2020年に提供開始」             # 対象の記述。outline.md から言葉を変えずに写す
- level: P0                                    # P0・P1・要確認
- problem: 公式のリリースノートでは提供開始は2021年4月
- sources:                                     # 根拠。書き方は research.md の出典と同じ。要確認なら空でよい
    - url: https://example.com/release-notes
      title: リリースノート
      publisher: 〇〇株式会社
      published: 2021-04-01
      accessed: 2026-10-18
      tier: 一次
      locator: 「2021年4月1日 提供開始」の項
- suggestion: 「2021年に提供開始」に直す          # 修正案。P0・P1 は必須
- decision:                                    # 人間の判断：修正する・残す・削除する・出典を足す（AI が人間の言葉を写す）
- decision_note:                               # 判断の理由やメモ。「残す」のときは必須

## 問題がなかった記述

| スライド | 主張の ID | 記述 | 確かめた出典 |
|---|---|---|---|
| S02 | C-001 | 作成時間は現状の 1/7 | https://www.city.example.lg.jp/xxxx.html（3ページの表） |

## 検索の記録

| スライド | 検索語 | 絞り込み | 参照したページ |
|---|---|---|---|
| S04 | 〇〇 提供開始 | 対象の公式サイト | https://example.com/release-notes |
```

## 区分（level）

| 区分 | 定義 | 扱い |
|---|---|---|
| P0 | 明らかな間違い（事実と一致しない） | 人間の判断が書かれるまで HTML 作成に進まない（ゲートが止める） |
| P1 | 大筋は事実に即しているが、厳密には正確でない（聞き手の前提知識なら問題ない程度） | 報告のみ。直すかは人間が決める |
| 要確認 | 出典が見つからず、正しいか間違いかを判断できない | 報告のみ。出典を足すか削るかは人間が決める |

- P1 にあたるかどうかは、`brief.md` の「聞き手と前提知識」を基準にする。
- 根拠（`sources`）を示せない指摘は、P0・P1 にせず「要確認」にする。

## 人間の判断（decision）

| 値 | 意味 | 使える区分 |
|---|---|---|
| 修正する | `suggestion` か、人間が言った内容で `outline.md` を直す | P0・P1・要確認 |
| 残す | 直さずにそのまま残す。理由を `decision_note` に書く | P0・P1・要確認 |
| 削除する | その記述を `outline.md` から削る | P0・P1・要確認 |
| 出典を足す | 人間が出典を用意する。届いたら research.md に足して確かめ直す | 要確認 |

- 判断するのは人間。人間はチャットで「FC-101 は修正、FC-102 は残す（初学者向けなので）」のように答え、AI がそれを `decision` と `decision_note` に言葉どおり写す。AI が自分で判断を書かない。
- 写したあと、`factcheck.md` の承認を `request.mjs` で依頼する。承認のときに人間が判断の内容を確かめる。
- 「修正する」「削除する」で `outline.md` を直したら、`outline.md` も承認し直してもらう（承認後に変わるので、ゲートが止める）。
- P1 と要確認は、判断が空のままでも先に進める。

## 書き方のきまり

- 指摘は1つの見出し（`## FC-101`）に1つ。同じ間違いが複数のスライドにあれば、スライドごとに分ける。
- ID は `FC-` と3桁以上の数字。デッキの中で重複させない。一度付けた ID は変えない。
- `outline.md` を自動で直さない。直すのは人間の判断のあと。
- 指摘のない記述も、「問題がなかった記述」に書く（すべての記述を確かめたことがわかるように）。

## チェックで見ること

`check-factcheck.mjs` は次をエラーにする。

- ID の形と重複、必須の項目（slide・claim_id・target・level・problem）の抜け、決まった値以外の level・decision
- P0・P1 なのに `sources` か `suggestion` がない
- 根拠の出典の書き方（research.md と同じきまり。除外のドメインもエラー）
- 「残す」なのに `decision_note` がない、「出典を足す」を要確認以外に使っている

判断が空の P0 は、エラーではなく「判断待ち」として数を出す。HTML 作成に進むときは、ゲート（`gate.mjs … build`）が止める。
