# 12-2. プラグイン: stylemap（スタイルマップ)

本章では、CSV ベースのスタイル情報を管理・提供する stylemap プラグインについて、6/7/8/11章の設計に沿って仕様をまとめる。命名規則に基づき、本プラグインの nodeType は単数形の `stylemap` に統一する。リポジトリには packages/plugins/stylemap として実装（Unified 定義・DB・UI）が存在するため、ここでは実装要点の要約と統合確認の TODO を整理する。

- 参照ドキュメント
  - 6章: docs/6-plugin-modules.md（12.2.2.2の想定）
  - 7章: docs/7-aop-architecture.md
  - 8章: docs/8-plugin-routing-system.md
  - 11章: docs/11-plugin-ui.md

## 12.2.1 概要
- 目的: CSV などの外部データをもとに地図上のスタイル（色、サイズ、分類ルール）を定義し、他プラグイン（shape/location/route 等）で利用可能なスタイル解決を提供する。
- Tree: Resources ツリー配下。
- NodeType: `stylemap`（単数形）

## 12.2.2 データモデル（Entity / Sub-Entities）
- Entity: StyleMapEntity（例）
  - id: string
  - name: string
  - sourceType: 'csv' | 'json' | 'inline'
  - sourcePath?: string // CSV/JSONの取得パス
  - rules: Array<StyleRule>
  - legend?: Array<LegendItem>
  - createdAt: number
  - updatedAt: number
- Sub-Entities（任意）
  - ルールや凡例を個別エンティティに分離する可能性あり

型の最終決定は 6章の例示＋実装進捗に合わせる。

## 12.2.3 UnifiedPluginDefinition（想定）

```ts
export const StyleMapUnifiedDefinition: UnifiedPluginDefinition<StyleMapEntity, never, never> = {
  nodeType: 'stylemap',
  name: 'StyleMap',
  displayName: 'Style Map',
  database: { entityStore: 'stylemaps', schema: {}, version: 1 },
  entityHandler: new StyleMapHandler(),
  routing: {
    actions: {
      import: { component: lazy(() => import('../ui/StyleImport')), displayName: 'Import' },
      preview: { component: lazy(() => import('../ui/StylePreview')), displayName: 'Preview' },
      export: { component: lazy(() => import('../ui/StyleExport')), displayName: 'Export' }
    },
    defaultAction: 'preview'
  },
  meta: {
    version: '1.0.0',
    description: 'CSV等からスタイル定義を生成・管理',
    tags: ['style', 'resources']
  }
};
```

## 12.2.4 ルーティングと UI
- 外部仕様 URL（8章）
  - `/t/:treeId/.../stylemap/preview`
- 想定 UI コンポーネント
  - StyleImport: CSV/JSON の取り込みとプレビュー
  - StylePreview: 規則のプレビュー（カテゴリ分け、カラーマップ）
  - StyleExport: 外部出力（JSON/CSV 等）

## 12.2.5 Worker/API 拡張
- 6章の想定 API
  - parseCSVStyles(csvPath | content)
  - applyStyles(featureProperties): ルールに基づきスタイル属性を返す
  - validateStyleData(rules): ルール定義の検証

## 12.2.6 PropertyResolver との関係
- 6章では propertyresolver プラグインも別に定義されている。
- stylemap が定義するルールと propertyresolver の responsibilities の切り分けが未確定。
  - 候補: propertyresolver は「プロパティ名や値の正規化」、stylemap は「正規化済みプロパティに対するスタイル付与」。

## 12.2.7 権限
- 9章に準拠。インポート/エクスポートは編集権限を要求。

## 12.2.8 受け入れ基準（サマリ）
- NodeTypeRegistry に `stylemap` が登録可能
- `/t/.../stylemap/preview` でプレビュー UI が動的ロード
- CSV からの取り込み→ルール生成→プレビュー→保存の基本フローが成立

## 12.2.9 TODO（仕様の不備・設計の矛盾・未実装）
- 実装確認済み: `packages/plugins/stylemap` に Unified 定義・DB・UI が存在
  - 対応: 実装要点のドキュメント反映、NodeTypeRegistry 登録とルーティング統合（11章）を実機確認
- propertyresolver との責務境界が曖昧
  - 対応: propertyresolver がプロパティ正規化、stylemap がスタイル解決という二層モデルを明文化
- ルールスキーマ未確定（色表現、連続/離散、範囲境界の開閉区間など）
  - 対応: 仕様サンプル・バリデーション仕様・エラーハンドリングを策定
- プレビューの描画方式（MapLibre依存 or 汎用UI）未決定
  - 対応: 最初は表形式＋色サンプル、将来地図プレビューに拡張
