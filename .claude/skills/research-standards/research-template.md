# research.md の書式

`decks/<deck-id>/research.md` は、調査の結果を主張ごとにまとめるファイル。`researcher` の結果を呼び出し元がここにまとめ、`outline.md` の `claims` と `factcheck.md` が同じ ID で参照する。

チェック：`node .claude/skills/research-standards/scripts/check-research.mjs decks/<deck-id>/research.md`

## 書式

```markdown
---
deck_id: 2026-10-24-report-automation
---

## C-001
- topic: 他の自治体の事例                     # 論点（brief.md の「調査が必要な項目」の言葉）
- claim: 〇〇市は2025年度に月次報告の作成を自動化し、作成時間を約7割減らした   # 主張を1文で
- kind: 事実                                 # 事実・推測
- confidence: おおむね確実                    # 確認済み・おおむね確実・未確認・矛盾あり
- as_of: 2025年度                            # いつ時点の情報か（版があれば版も）
- sources:
    - url: https://www.city.example.lg.jp/xxxx.html
      title: 令和7年度 業務改善の取り組み       # 資料名
      publisher: 〇〇市 総務課                 # 発行元
      published: 2026-03-31                  # 公開日（更新日があれば「2026-03-31（更新 2026-05-10）」）。わからなければ「不明」
      accessed: 2026-10-18                   # 取得日
      tier: 一次                             # 一次・準公式・二次・個人（domains.md の分け方）
      locator: 3ページ「作成時間の変化」の表     # 該当箇所（ページ、節、表、引用した文）
      interest:                              # 利害関係（ベンダー自身の記事など）。なければ空
      reuse:                                 # 図表を載せる可能性があるとき：転載の可否と、出典表示の要否
    - url: https://www.example.go.jp/yyyy.pdf
      title: 自治体のデジタル化の事例集
      publisher: 〇〇省
      published: 2026-06-01
      accessed: 2026-10-18
      tier: 一次
      locator: 12ページ「〇〇市」
- counter:                                   # 反対の情報・食い違う情報（探したが見つからなければ「見つからなかった」）
- basis:                                     # kind が推測のとき、推測の根拠

## 調べきれなかったこと

- 論点「費用の目安」：自治体の公開資料に金額の記載が見つからなかった

## 検索の記録

| 論点 | 検索語 | 絞り込み | 参照したページ |
|---|---|---|---|
| 他の自治体の事例 | 月次報告 自動化 自治体 RPA | 優先ドメイン | https://www.city.example.lg.jp/xxxx.html |
```

## 書き方のきまり

- 主張は1つの見出し（`## C-001`）に1つ。段落ではなく主張ごとに出典を付ける。
- ID は `C-` と3桁以上の数字。デッキの中で重複させない。一度付けた ID は変えない（`outline.md` と `factcheck.md` が参照する）。使わなくなった主張は消さずに `- dropped: 理由` を足す。
- 出典のない主張は書かない（「調べきれなかったこと」に書く）。
- `confidence` の付け方：

| 確度 | 条件 |
|---|---|
| 確認済み | 発行元の異なる一次情報が2つ以上あり、内容が一致する |
| おおむね確実 | 発行元の異なる情報源が2つ以上あり、内容が一致する（一次情報でないものを含む） |
| 未確認 | 情報源が1つだけ |
| 矛盾あり | 情報源どうしが食い違う。`counter` に食い違う内容を書く |

- 同じ元記事の転載は、発行元が違っても1つと数える。その場合は元の記事だけを `sources` に書く。
- 数値や引用は、元の資料（原典）を出典にする。孫引きしない。

## チェックで見ること

`check-research.mjs` は次をエラーにする（内容が正しいかは見ない。ファクトチェックで確かめる）。

- ID の形と重複、必須の項目（topic・claim・kind・confidence・as_of・sources）の抜け、決まった値以外の kind・confidence・tier
- 出典の必須の項目（url・title・publisher・published・accessed・tier・locator）の抜け、URL や日付の形
- 確度と出典の数・発行元・tier の食い違い（例：確認済みなのに一次情報が1つ）
- 矛盾ありなのに `counter` が空、推測なのに `basis` が空
- 除外ドメイン（`domains.md`）の URL を出典にしている
