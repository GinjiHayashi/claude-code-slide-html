// 図の部品ごとの、最小の正しいデータ（部品の冒頭のコメントの data にもとづく）
export const DIAGRAMS = {
  kpi: { items: [{ label: "作成時間", value: "6", unit: "時間" }] },
  bar: {
    data: [
      { label: "現状", value: 40 },
      { label: "導入後", value: 6, highlight: true },
    ],
    unit: "時間",
  },
  hbar: {
    data: [
      { label: "A", value: 3 },
      { label: "B", value: 5 },
    ],
    unit: "件",
  },
  "stacked-bar": {
    categories: ["4月", "5月"],
    series: [
      { name: "a", values: [1, 2] },
      { name: "b", values: [3, 4] },
    ],
    unit: "件",
  },
  line: { x: ["4月", "5月", "6月"], series: [{ name: "今年度", values: [1, 2, 3] }], unit: "人" },
  area: {
    x: ["4月", "5月", "6月"],
    series: [
      { name: "a", values: [1, 2, 3] },
      { name: "b", values: [2, 2, 2] },
    ],
    unit: "人",
  },
  combo: { x: ["4月", "5月"], bar: { name: "件数", values: [10, 20], unit: "件" }, line: { name: "率", values: [1, 2], unit: "%" } },
  donut: {
    items: [
      { label: "A", value: 60 },
      { label: "B", value: 40 },
    ],
    unit: "%",
  },
  scatter: {
    points: [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 5 },
    ],
    x_label: "x",
    x_unit: "件",
    y_label: "y",
    y_unit: "時間",
  },
  table: {
    columns: ["項目", "値"],
    rows: [
      ["A", 1],
      ["B", 2],
    ],
  },
  heatmap: {
    rows: ["A", "B"],
    columns: ["x", "y"],
    values: [
      [1, 2],
      [3, 4],
    ],
    unit: "件",
  },
  map: {
    data: [
      { pref: "東京都", value: 10 },
      { pref: "大阪府", value: 5 },
    ],
    unit: "件",
  },
  flowchart: { nodes: [{ label: "受付" }, { label: "確認" }, { label: "完了" }] },
  steps: { items: [{ title: "1" }, { title: "2" }, { title: "3" }] },
  timeline: {
    items: [
      { date: "2024", label: "a" },
      { date: "2025", label: "b" },
      { date: "2026", label: "c" },
    ],
  },
  roadmap: { periods: ["Q1", "Q2"], lanes: [{ name: "A", items: [{ start: "Q1", end: "Q2", label: "作業" }] }] },
  sequence: { actors: ["利用者", "システム"], messages: [{ from: "利用者", to: "システム", label: "申請" }] },
  er: {
    entities: [
      { name: "利用者", fields: [{ name: "id", key: "PK" }] },
      { name: "申請", fields: [{ name: "user_id", key: "FK" }] },
    ],
    relations: [{ from: "利用者", to: "申請", card: "1:N" }],
  },
  matrix: {
    x_axis: { label: "影響", low: "小", high: "大" },
    y_axis: { label: "緊急度", low: "低", high: "高" },
    cells: [{ title: "a" }, { title: "b" }, { title: "c" }, { title: "d" }],
  },
  pyramid: { levels: [{ label: "上" }, { label: "中" }, { label: "下" }] },
  tree: { root: "本部", children: [{ label: "A部" }, { label: "B部" }] },
  compare: { options: ["案A", "案B"], criteria: ["費用"], values: [["◯", "×"]] },
  venn: { sets: [{ label: "A" }, { label: "B" }] },
  math: { tex: "E = mc^2" },
  code: { lang: "python", code: "print(1)\n" },
  image: { src: "inputs/screen-entry.png", alt: "画面" },
  canvas: {
    shapes: [
      { type: "box", id: "a", at: [1, 2], text: "入力" },
      { type: "box", id: "b", at: [8, 2], text: "出力" },
      { type: "line", from: "a", to: "b" },
    ],
  },
  dirtree: { tree: "project/\n  src/\n    * main.py  # 入口\n  README.md\n" },
  cards: { items: [{ heading: "a", text: "説明" }, { heading: "b" }, { heading: "c", tone: "primary" }], summary: { text: "まとめ" } },
  cycle: { items: [{ label: "a" }, { label: "b" }, { label: "c" }, { label: "d" }], exit: { from: 2, label: "抜ける" } },
  layers: { items: [{ label: "a", text: "説明", tone: "primary" }, { label: "b" }, { label: "c", tone: "muted" }], top: "上", bottom: "下", note: "注記" },
  hub: { top: { label: "上" }, hub: { label: "口", text: "説明" }, items: [{ label: "a", text: "説明" }, { label: "b" }] },
  nested: { items: [{ label: "外", text: "説明" }, { label: "中", tone: "soft" }, { label: "内" }] },
  "flow-notes": {
    items: [
      { label: "a", note: "説明" },
      { label: "b", note: "説明" },
    ],
    base: { label: "帯" },
  },
};
