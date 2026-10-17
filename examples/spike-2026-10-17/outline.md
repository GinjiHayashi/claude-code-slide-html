---
deck_id: 2026-10-17-spike
theme: default
aspect: "16:9"
---

<!-- スパイク用の試作。数値はすべて架空のサンプル。 -->

## S01
- layout: title
- title: データ基盤の導入提案
- subtitle: 2026年10月 データ基盤チーム（試作）

## S02
- layout: title-diagram
- title: 全体構成
- diagram:
    kind: mermaid
    spec: |
      flowchart LR
        A[業務システム] --> B[(GCS)]
        B --> C[(BigQuery raw)]
        C --> D[dbt で変換]
        D --> E[(BigQuery mart)]
        E --> F[ダッシュボード]
- caption: 図1 データの流れ
- notes: |
    左から右へ、データが集まって加工される流れを説明する

## S03
- layout: title-diagram
- title: 月次レポート作成時間の比較
- claims: [C-001]
- diagram:
    kind: vega-lite
    spec: |
      {
        "data": {"values": [
          {"方式": "現状（手作業）", "時間": 40},
          {"方式": "導入後（自動化）", "時間": 6}
        ]},
        "mark": "bar",
        "encoding": {
          "x": {"field": "方式", "type": "nominal", "sort": null, "axis": {"labelAngle": 0}},
          "y": {"field": "時間", "type": "quantitative", "title": "作成時間（時間／月）"}
        }
      }
- caption: 図2 月次レポートの作成時間
- source: 架空のサンプルデータ（スパイク用）
- notes: |
    作成時間が約7分の1になる見込みを示す
