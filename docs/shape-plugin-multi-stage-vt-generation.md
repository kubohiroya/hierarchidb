# shape-pluginにおけるマルチステージでのベクトルタイル生成

このドキュメントは、shape-plugin の Step5 に相当するマルチステージ処理（fetch → transform → vt）について、
タスク生成・ダウンロード・永続化・検索・アルゴリズム呼び出しの流れを整理したものです。

## 全体の流れ（コールチェーン図）

```mermaid
flowchart TD
  A[shapePipeline.run] --> B[runShapeFetchStage]
  B --> C[putTasks(fetch)]
  C --> D[runStageTasks(fetch)]
  D --> E[createFetchHandler]
  E --> F[DataSourceStrategy.fetchData/processData]
  E --> G[putFetchCache -> ephemeralShapeDB.fetchCache]
  A --> H[buildTransformByBandTasks]
  H --> I[putTasks(transform)]
  I --> J[runStageTasks(transform)]
  J --> K[createTransformByBandHandler]
  K --> L[fetchCache decode/simplify/validate]
  K --> M[put transformCache + tileIdToBufferRelations]
  A --> N[buildVtTasks]
  N --> O[putTasks(vt)]
  O --> P[runStageTasks(vt)]
  P --> Q[createVtHandler]
  Q --> R[collectFeatures + geojson-vt + vt-pbf]
  Q --> S[tileWriter -> storeVectorTile]
```

## ファイル別の責務

### オーケストレーション / タスク生成
- `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
  - fetch/transform/vt の各ステージを順に実行するメインフロー。
  - タスク生成: `buildFetchTasks`, `buildTransformByBandTasks`, `buildVtTasks`
  - タスク投入: `putTasks`
  - タスク実行: `runStageTasks`
  - vt 出力の永続化: `tileWriter` から `shapeMutationAPIImpl.storeVectorTile(...)`
  - 後処理: `buildFeatureMetadataFromTransformCaches`, `updateShapeStageMetadata`, cleanup

### タスクキューの永続化・検索
- `packages/vt-orchestrator/src/task/taskQueue.ts`
  - タスク DB (`VtTaskQueueDb`) と CRUD API。
  - `putTasks` / `listTasksByStage` / `listTasksByStageAndStatus` / `updateTask` が中心。

- `packages/vt-orchestrator/src/compareTaskOrder.ts`
  - `runStageTasks` の実装。
  - 並列度・実行順序・失敗時の挙動を統括。

### Fetch ステージ（ダウンロードと fetch cache）
- `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`
  - タスク生成: `buildFetchTasks`
  - ステージ実行: `runShapeFetchStage`
  - タスク処理: `createFetchHandler`
    - 既存キャッシュ検索: `getFetchCache`
    - ダウンロード: `DataSourceStrategyFactory` → `strategy.fetchData` / `processData`
    - fetch cache 永続化: `putFetchCache`（`ephemeralShapeDB.fetchCache`）

- `plugins/shape-plugin/src/services/datasources/DataSourceStrategy.ts`
  - データソース戦略の抽象インターフェース（fetch/process/validate）。

- `plugins/shape-plugin/src/services/utils/rawDataPipeline.ts`
  - Raw data ダウンロードと chunk store への保存（再利用可能）。

### Transform ステージ（simplify/validate と transform cache）
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
  - `fetchCache` を読み込み、デコード → 簡略化 → 検証 → flatgeobuf 化。
  - `ephemeralDB.transformCache` への保存。
  - `tileIdToBufferRelations` の作成（vt 生成時の検索キー）。

- `packages/features/shape-store/src/EphemeralShapeDB.ts`
  - `fetchCache` / `transformCache` / `tileIdToBufferRelations` の保存先。

### VT ステージ（ベクトルタイル生成・保存）
- `packages/vt-orchestrator/src/vt/vtStage.ts`
  - transform cache を収集して GeoJSON を構築。
  - `geojson-vt` でタイル分割。
  - `vt-pbf` で MVT 生成。
  - `tileWriter` へ出力して永続化。

- `plugins/shape-plugin/src/services/vt/shapePipeline.ts`
  - `createVtHandler` の `tileWriter` で `shapeMutationAPIImpl.storeVectorTile(...)` を呼び出し。

### 永続化内容の検索（UI/外部 API からの参照）
- `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`
  - `ShapeQueryAPIImpl` が shapeDB / ephemeralShapeDB の検索を担当。
  - タスク一覧、タイル取得、セッション情報の読み出しを提供。

- `packages/features/shape-store/src/ShapeDB.ts`
  - VectorTile や build session の永続化先。
