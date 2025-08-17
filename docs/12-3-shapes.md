# 12-3. プラグイン: shapes（ベクトルデータ）

本章では、GeoJSON の取り込み・簡略化・タイル生成などを担う shapes プラグインについて、6/7/8/11章の統合プラグイン設計に基づく仕様と受け入れ基準、そして現状の不備を TODO として整理する。なお、本リポジトリには現時点で packages/plugins/shapes は見当たらない（未実装）。

- 参照ドキュメント
  - 6章: docs/6-plugin-modules.md（12.2.2.3の想定）
  - 7章: docs/7-aop-architecture.md
  - 8章: docs/8-plugin-routing-system.md
  - 11章: docs/11-plugin-ui.md

## 12.3.1 概要
- 目的: GeoJSON のアップロード、選択的読み込み、簡略化（simplify）、ベクトルタイル（tiles）生成を提供。
- Tree: Resources ツリー配下。
- NodeType: `shapes`

## 12.3.2 データモデル（Entity / Sub-Entity / Working Copy）
- Entity: ShapeEntity（例）
  - id: string
  - name: string
  - sourceType: 'geojson' | 'file' | 'url'
  - sourcePath?: string
  - simplifyLevel?: number // 例: 0〜10
  - filters?: Array<FilterRule>
  - stats?: ShapeStats // 例: フィーチャ数、バウンディングボックス
  - createdAt: number
  - updatedAt: number
- Sub-Entity: FeatureSubEntity（任意）
  - 特定のフィーチャに関するメタ情報を格納
- WorkingCopy: ShapeWorkingCopy（例）
  - 簡略化やフィルタの試行錯誤を安全に行うための一時状態

## 12.3.3 UnifiedPluginDefinition（想定）

```ts
export const ShapesUnifiedDefinition: UnifiedPluginDefinition<ShapeEntity, FeatureSubEntity, ShapeWorkingCopy> = {
  nodeType: 'shapes',
  name: 'Shapes',
  displayName: 'Shapes',
  database: { entityStore: 'shapes', schema: {}, version: 1 },
  entityHandler: new ShapesHandler(),
  routing: {
    actions: {
      upload: { component: lazy(() => import('../ui/GeoJsonUpload')), displayName: 'Upload' },
      simplify: { component: lazy(() => import('../ui/ShapeSimplify')), displayName: 'Simplify' },
      tiles: { component: lazy(() => import('../ui/VectorTiles')), displayName: 'Tiles' }
    },
    defaultAction: 'upload'
  },
  meta: {
    version: '1.0.0',
    description: 'GeoJSONの取り込みと処理（簡略化・ベクトルタイル生成）',
    tags: ['geojson', 'vector', 'resources']
  }
};
```

## 12.3.4 ルーティングと UI
- 外部仕様 URL（8章）
  - `/t/:treeId/.../shapes/upload`
  - `/t/:treeId/.../shapes/simplify`
  - `/t/:treeId/.../shapes/tiles`
- 想定 UI コンポーネント
  - GeoJsonUpload: ファイル/URL から読み込み、検証、統計表示
  - ShapeSimplify: 簡略化パラメータの設定、実行、結果比較
  - VectorTiles: タイル生成（ローカル/ワーカー）、成果物の参照

## 12.3.5 Worker/API 拡張
- 想定 API
  - loadGeoJson(path|url)
  - simplifyGeoJson(geojson, level, opts?)
  - generateVectorTiles(geojson|datasetRef, opts?)
  - computeStats(geojson)
- 処理コストが高い操作は Web Worker または専用 WorkerAPI で非同期実行。

## 12.3.6 PropertyResolver / StyleMap との関係
- propertyresolver によるプロパティ正規化の後、stylemap によりスタイルを適用するパイプラインを想定。
- shapes 単独でも簡易プレビューは可能だが、本来の色付けは stylemap と連携。

## 12.3.7 権限
- 9章に準拠。アップロード/生成は編集権限が必要。

## 12.3.8 受け入れ基準（サマリ）
- NodeTypeRegistry に `shapes` が登録可能
- `/t/.../shapes/{upload|simplify|tiles}` で UI が動的ロード
- GeoJSON 読み込み→簡略化→タイル生成の基本フローが成立

## 12.3.9 TODO（仕様の不備・設計の矛盾・未実装）
- 未実装: `packages/plugins/shapes` が見当たらない（2025-08-17時点）
  - 対応: `packages/plugins/shapes` を新設し UnifiedPluginDefinition を実装
- 高負荷処理の実行環境（クライアント/ワーカー/サーバ）方針未確定
  - 対応: フロントではプレビュー用の簡易簡略化、重処理は将来 BFF/サーバに委譲する設計を明文化
- タイル生成結果の保存先（IndexedDB? FileSystem API?）が未確定
  - 対応: 保存先と上限、クリーンアップポリシーを策定
- フィルタルール DSL の仕様未確定
  - 対応: 最小 DSL（プロパティ条件式と AND/OR）から開始し拡張余地を確保
