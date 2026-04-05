# @hierarchidb/shape-plugin

最終更新: 2026-04-05

HierarchiDB の地理的形状データ管理プラグイン。オンラインデータソース（Natural Earth、geoBoundaries、GADM）から国・行政区域のシェープデータをインポートし、ベクトルタイルを生成して Map プレビューで可視化する。BuildSession によるバッチ処理、ステージベースのパイプライン実行、一時停止/再開をサポートする。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `shape` |
| extends | `folder` |
| category | `geographic`（menuGroup: `geo`、createOrder: `800`） |
| priority | `800` |

shape-plugin は folder-plugin を継承し、地理的形状データの取得・変換・タイル生成・プレビューを提供する。basemap-plugin はオプション依存であり、Map プレビュー時にベースマップレイヤを利用する。

## UI 層

### ダイアログステップ

shape-plugin は `PluginStepRegistry` ベースの 6 ステップウィザードを提供する（ステップ 1 は共通プラグインが提供）:

| ステップ | ID | コンポーネント | 説明 |
| --- | --- | --- | --- |
| 1 | `basicInfo` | *(ui-plugin-basic-info)* | 基本情報（name / description）— `@hierarchidb/ui-plugin-basic-info` が提供 |
| 2 | `data-source` | `ShapeDataSourceStep` | データソースの選択（Natural Earth / geoBoundaries / GADM） |
| 3 | `country-selection` | `ShapeCountrySelectionStep` | 国・行政区域レベルの選択 |
| 4 | `processing-configuration` | `ShapeBuildConfigStep` | ビルド設定（簡略化パラメータ、ズーム帯等） |
| 5 | `build` | `ShapeBuildStep` | ビルド実行・進捗表示 |
| 6 | `preview` | `ShapePreviewStep` | ベクトルタイルの Map プレビュー |

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `ShapeDataSourceStep` | データソース選択 UI（ライセンス同意を含む） |
| `ShapeCountrySelectionStep` | 国・ADM レベルのチェックボックス選択 |
| `ShapeBuildConfigStep` | ビルド設定（簡略化許容誤差、ズーム帯、フィルタ等） |
| `ShapeBuildStep` | ビルド進捗表示（ステージ別進捗、一時停止/再開/キャンセル） |
| `ShapePreviewStep` | MapLibre ベースのベクトルタイルプレビュー |
| `ErrorDisplay` | エラー表示コンポーネント |

### Jotai Atom（SSOT 状態木）

ビルドセッションの状態は jotai atom ツリーを唯一の真実の源（SSOT）とする:

| Atom | 説明 |
| --- | --- |
| `buildSessionStateAtoms` | セッションフェーズ、ステージ進捗、タスク状態 |
| `shapeBuildProgressAtoms` | ビルド進捗の集約・表示用 |
| `shapePreviewAtoms` | プレビュー検索・選択・ホバー状態 |
| `buildSessionWorkerEventAdapter` | Worker→UI イベントの atom 更新アダプタ |

### アイコン

```typescript
// Entry point: @hierarchidb/shape-plugin/icon
import { ShapePluginIcon } from '@hierarchidb/shape-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Hexagon` |
| Emoji | ♦️ |
| カラー | `#a3b030` |

## Worker 層

### ShapeEntityService（EntityHandler）

`ShapeEntityService` は CoreDB の `TreeNode` payload/draftData を通じて ShapeEntity の CRUD を行う:

- `getEntity(nodeId)` — TreeNode から ShapeEntity を復元（draftData 優先）
- `updateEntity(nodeId, updates)` — payload/draftData のマージ更新
- `updateProcessingStatus(nodeId, status)` — 処理ステータスの更新

### ShapeWorkerPlugin

Worker 環境でのプラグイン登録を行う。ビルド API、エンティティハンドラ、バリデーション、ライフサイクルフックを提供する:

```typescript
// Worker plugin exports
export { registerShapeWorkerStores } from './factory/registerShapeWorkerStores.js';
export { shapeBuildAPI } from './api.js';
export { ShapeWorkerPlugin } from './ShapeWorkerPlugin.js';
```

### ライフサイクル

| イベント | 処理 |
| --- | --- |
| `afterCreate` | リソース初期化（予約） |
| `beforeDelete` | `shapeBuildAPI.cleanupProcessingData(nodeId)` で処理データをクリーンアップ |
| `afterUpdate` | 設定変更時の再処理トリガー（予約） |

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerShapeWorkerStores', 'loadShapeEntitiesDbModule'],
}
```

## データベーススキーマ

shape-plugin は Dexie ベースの専用データベースを使用する。

### メインテーブル（featureMetadata）

```typescript
// plugin-manifest.ts — database definition
database: {
  dbName: 'shape',
  tableName: 'featureMetadata',
  version: 7,
  schema: {
    fields: [
      { name: 'nodeId', indexed: true },
      { name: 'adminLevel', indexed: true },
      { name: 'featureId', indexed: true },
      { name: 'createdAt', indexed: true },
      { name: 'updatedAt', indexed: true },
    ],
  },
}
```

### 追加テーブル（ShapeWorkerPlugin）

| テーブル | スキーマ | 説明 |
| --- | --- | --- |
| `shapeBuildSessions` | `&nodeId` | ビルドセッション状態 |
| `shapeBuildTasks` | `&taskId, nodeId, stage, progress` | ビルドタスク |
| `shapeFeatures` | `&featureId, nodeId, countryCode, adminLevel, geometry` | フィーチャデータ |
| `shapeVectorTiles` | `&tileId, nodeId, z, x, y, data, size` | ベクトルタイル |
| `shapeCache` | `&cacheKey, nodeId, cacheType, data, size, createdAt` | キャッシュ |

### VectorTileEntity

```typescript
interface VectorTileEntity {
  tileId: string;       // "${nodeId}-${z}-${x}-${y}"
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers: LayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}
```

## 依存プラグイン

```typescript
// PluginManifest
dependencies: ['folder'],
optionalDependencies: ['basemap'],
```

| プラグイン | 関係 |
| --- | --- |
| `folder` | 必須依存 — 基盤ノードタイプを継承 |
| `basemap` | オプション依存 — Map プレビューのベースマップレイヤ |

`spreadsheet-plugin` は peerDependency として宣言されており、Tabular Preview 機能で連携する。

## 設定項目

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,
  canBeRoot: false,
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: false,
  supportsBuildProcessing: true,  // batch processing support
}
```

### Schema

```typescript
schema: {
  inherits: 'folder',
  fields: [
    { name: 'selectedArrayByCountries', type: 'array', required: true },
    { name: 'licenseAgreement', type: 'boolean', required: true },
  ],
}
```

### データソース

| データソース | 表示名 | ライセンス | 最大 ADM レベル | 国コード形式 |
| --- | --- | --- | --- | --- |
| `naturalearth` | Natural Earth | Public Domain | 2 | ISO2 |
| `geoboundaries` | geoBoundaries | CC BY 4.0 | 5 | ISO3 |
| `geoboundaries-topojson` | geoBoundaries:TopoJSON | CC BY 4.0 | 5 | ISO3 |
| `gadm` | GADM | Academic Use | 4 | ISO3 |

内部の基準コード体系は ISO2 を採用し、`sourceKey` とキャッシュキーは ISO2 統一で運用する。ISO3 を要求するデータソースでは DataSourceStrategy が ISO2→ISO3 変換を行う。

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `shape-plugin` |
| ロケール | `en`, `ja` |

## バッチ処理

shape-plugin は `supportsBuildProcessing: true` を宣言し、ステージベースのパイプラインでバッチ処理を実行する。

### パイプラインステージ

```text
source → geometry → tileEmit → profile → metadata → cleanup
```

| ステージ | 説明 |
| --- | --- |
| `source` | データソースから GeoJSON を国×ADM レベル単位で取得し、flatgeobuf に変換して保存 |
| `geometry` | ズーム帯ごとに Douglas–Peucker 簡略化を適用し、簡略化済み FGB を生成 |
| `tileEmit` | geojson-vt でベクトルタイル（MVT）を生成し VectorTileStore に保存 |
| `profile` | ステージ実行のプロファイリング |
| `metadata` | フィーチャメタデータの生成・更新 |
| `cleanup` | 中間データのクリーンアップ |

### BuildSession ライフサイクル

ビルドセッションは以下のフェーズを持つ:

| フェーズ | 意味 |
| --- | --- |
| `idle` | セッション未開始または完全終了後の待機状態 |
| `starting` | ビルド開始処理中 |
| `running` | ステージ実行中 |
| `pausing` | 一時停止命令送信済み、Worker 応答待ち |
| `paused` | 一時停止中（再開可能） |
| `resuming` | 再開命令送信済み、Worker 応答待ち |
| `finalizing` | 全ステージ完了後の後処理中 |
| `completed` | 正常完了（終端状態） |
| `failed` | エラー終了（終端状態） |

### タスクステータス

| ステータス | 意味 |
| --- | --- |
| `queued` | 処理待ち |
| `running` | 処理中 |
| `completed` | 処理成功 |
| `failed` | 処理失敗 |
| `skipped` | 処理実行・成果物なし |
| `recycled` | 有効キャッシュ存在のため処理スキップ |

### Worker→UI イベント

ビルドセッションの進捗は `@hierarchidb/build-api` で定義された正規イベントを通じて UI に伝達される:

- `SessionStatusUpdatedEvent` — セッションフェーズの変更
- `StageSnapshotUpdatedEvent` — ステージスナップショットの更新
- `TaskProgressUpdatedEvent` — タスク進捗の更新
- `HeartbeatEvent` — ハートビート
- `CriticalErrorEvent` — 致命的エラー

### キャッシュとリコンシリエーション

`shapeStageReconcile` がステージ間のキャッシュ整合性を検証し、有効なキャッシュが存在するタスクは `recycled` としてスキップする。`CacheValidator` がキャッシュエントリの妥当性を検証する。

## Map プレビュー

shape-plugin は MapLibre GL JS を使用してベクトルタイルの Map プレビューを提供する。

### プレビュー機能

- ビルド完了後（または処理中）にベクトルタイルを地図上に表示
- フィーチャの検索・選択・ホバーハイライト
- ADM レベル別のフィーチャフィルタリング
- ベースマップレイヤとの重ね合わせ（basemap-plugin 連携）
- プレビュー状態（中心座標・ズーム）の永続化（`ShapePreviewMapView`）

### プレビューコンポーネント構成

```text
ShapePreviewStep
├── ShapePreviewStepView        # Main preview view
├── useShapePreviewStep          # Preview step logic
├── useShapePreviewStepSceneView # Scene view management
├── useVectorTilePreviewTable    # Vector tile data table
└── internal/
    ├── useShapePreviewFeatureSection  # Feature section display
    └── useShapePreviewStepUtils       # Utility hooks
```

### Tabular Preview

`SHAPE_TABULAR=1` フラグを有効にすると、Build Progress ビューに「Data Table」タブが追加され、簡略化後のプロパティ表を閲覧できる。複数条件フィルタ（AND）、列の可視切替、`eq` 条件の索引（初回遅延作成）をサポートする。

## 使用例

### PluginManifest の参照

```typescript
import { ShapePluginManifest } from '@hierarchidb/shape-plugin/common';

console.log(ShapePluginManifest.nodeType); // 'shape'
console.log(ShapePluginManifest.capabilities.supportsBuildProcessing); // true
```

### データソース設定の参照

```typescript
import { SHAPE_DATA_SOURCES, SHAPE_DATA_SOURCE_BY_NAME } from '@hierarchidb/shape-plugin/common';

// List all available data sources
for (const ds of SHAPE_DATA_SOURCES) {
  console.log(`${ds.displayName}: ${ds.license} (max ADM ${ds.maxAdminLevel})`);
}

// Look up a specific data source
const gb = SHAPE_DATA_SOURCE_BY_NAME['geoboundaries'];
console.log(gb.displayName); // 'geoBoundaries'
```

### ShapePluginIcon の使用

```tsx
import { ShapePluginIcon } from '@hierarchidb/shape-plugin/icon';

<ShapePluginIcon sx={{ color: '#a3b030' }} />
```

## ディレクトリ構成

```text
src/
├── plugin-manifest.ts              # PluginManifest definition
├── common/
│   ├── index.ts                    # Common public API entry point
│   ├── config/
│   │   └── previewFlags.ts         # Feature flags (SHAPE_TABULAR etc.)
│   ├── types/
│   │   ├── BuildTaskResult.ts      # ShapeBuildConfig, ShapeRuntimeBuildConfig
│   │   ├── constants.ts            # Data source definitions, default configs
│   │   ├── create-update.ts        # Create/update data types
│   │   ├── data-source.ts          # DataSourceName, CountryMetadata, SourceTaskPayload
│   │   ├── session-events.ts       # Re-exports from @hierarchidb/build-api
│   │   ├── ShapeEntity.ts          # ShapeEntity, ShapeEntityPayload
│   │   ├── ShapeFeaturePayload.ts  # Feature payload type
│   │   ├── validation.ts           # Validation utilities
│   │   └── VectorTileEntity.ts     # VectorTileEntity type
│   └── utils/
│       ├── estimates.ts            # Time estimation utilities
│       ├── taskMessages.ts         # Task message formatting
│       └── taskTitles.ts           # Task title formatting
├── icon/
│   └── index.ts                    # ShapePluginIcon (re-export of MUI Hexagon)
├── services/
│   ├── index.ts                    # Service exports
│   ├── CacheValidator.ts           # Cache entry validation
│   ├── stageProfile.ts             # Stage profiling
│   ├── build/                      # Build API client, session mappers, stage aliases
│   ├── datasources/                # DataSourceStrategy (NaturalEarth, GeoBoundaries, GADM)
│   ├── metadata/                   # Metadata loader and sources
│   ├── tabular/                    # ShapeTabularMetadataManager
│   ├── utils/                      # Chunk store, fetch, ISO3166, pipeline utilities
│   └── vt/                         # Vector tile pipeline (runShapePipeline, stages)
├── ui/
│   ├── index.ts                    # UI entry point (step registration + resource registration)
│   ├── atoms/                      # Jotai atoms (build session state, progress, preview)
│   ├── components/
│   │   ├── build-config/           # Build configuration step
│   │   ├── build-progress/         # Build progress step (ShapeBuildStep)
│   │   ├── country-selection/      # Country/ADM selection step
│   │   ├── data-source/            # Data source selection step
│   │   ├── preview/                # Map preview step (MapLibre integration)
│   │   ├── processing/             # Processing components
│   │   └── steps-provider.tsx      # PluginStepRegistry registration
│   ├── hooks/                      # UI hooks (country metadata, build cache, config sections)
│   ├── locales/                    # i18n resources (en.json, ja.json)
│   ├── utils/                      # UI utilities (build warnings, sanitize, cache clear)
│   └── workers/                    # Country availability web worker
└── worker/
    ├── index.ts                    # Worker entry point
    ├── ShapeWorkerPlugin.ts        # Worker plugin definition
    ├── api.ts                      # Build API export
    ├── api/                        # Build API implementation modules
    ├── factory/                    # Worker store registration
    ├── handlers/                   # ShapeEntityHandler / ShapeEntityService
    ├── createShapeFeatureStoreDexie.ts
    ├── shapeVectorTileStore.dexie.ts
    └── taskOrdering.ts             # Task execution ordering
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/shape-plugin/common` | 型定義、PluginManifest、データソース定数、バリデーション |
| `@hierarchidb/shape-plugin/ui` | UI コンポーネント（ステップ登録、リソース登録） |
| `@hierarchidb/shape-plugin/icon` | ShapePluginIcon |
| `@hierarchidb/shape-plugin/worker` | Worker プラグイン（ストア登録、ビルド API、ShapeWorkerPlugin） |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../packages/core-types/) — NodeId、NodeType、ISO2 等の共有型定義
- [`@hierarchidb/folder-plugin`](../plugins/folder-plugin/) — 基盤ノードタイプ（継承元）
- [`@hierarchidb/shape-store`](../packages/shape-store/) — Shape データストア（Dexie）
- [`@hierarchidb/shape-api`](../packages/shape-api/) — Shape API 型定義
- [`@hierarchidb/vectortile-store`](../packages/vectortile-store/) — ベクトルタイルストア
- [`@hierarchidb/vectortile-orchestrator`](../packages/vectortile-orchestrator/) — ベクトルタイルオーケストレータ
- [`@hierarchidb/vt-orchestrator`](../packages/vt-orchestrator/) — VT オーケストレータ
- [`@hierarchidb/build-api`](../packages/build-api/) — ビルド API 型定義・セッションイベント
- [`@hierarchidb/build-runtime-services`](../packages/build-runtime-services/) — ビルドランタイムサービス
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker ランタイム（CoreDB、FeatureStore、VectorTileStore）
- [`@hierarchidb/gis-sdk`](../packages/gis-sdk/) — GIS SDK（ジオメトリ設定型、簡略化パラメータ）
- [`@hierarchidb/chunk-store`](../packages/chunk-store/) — チャンクストア（ダウンロードデータ永続化）
- [`@hierarchidb/download`](../packages/download/) — ダウンロードサービス
- [`@hierarchidb/auth`](../packages/auth/) — 認証基盤（fetchWithAuth、401 復帰）
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode 型定義
- [`@hierarchidb/tabular-store`](../packages/tabular-store/) — 表形式データストア
- [`@hierarchidb/gen-iso3166-2`](../packages/tools/gen-iso3166-2/) — ISO 3166-2 コード生成
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — プラグイン UI SDK
- [`@hierarchidb/plugin-service-api`](../packages/plugin-service-api/) — プラグインサービス API
- [`@hierarchidb/ui-map`](../packages/ui/map/) — 地図 UI コンポーネント
- [`@hierarchidb/ui-build-progress`](../packages/ui/build-progress/) — ビルド進捗 UI
- [`@hierarchidb/ui-build-sessions`](../packages/ui/build-sessions/) — ビルドセッション管理 UI
- [`@hierarchidb/ui-country-select`](../packages/ui/country-select/) — 国選択 UI
- [`@hierarchidb/ui-datasource`](../packages/ui/datasource/) — データソース選択 UI
- [`@hierarchidb/spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — Tabular Preview 連携

### 関連プラグイン

- [`basemap-plugin`](../plugins/basemap-plugin/) — Map プレビューのベースマップ（オプション依存）
- [`location-plugin`](../plugins/location-plugin/) — 位置エンティティ（Shape データ連携）
- [`route-plugin`](../plugins/route-plugin/) — 経路生成（Shape データ連携）

### 設計ドキュメント

- [`docs/build-session-spec.md`](../docs/build-session-spec.md) — ビルドセッションライフサイクル仕様
- [`docs/vt-shape-pipeline-design.md`](../docs/vt-shape-pipeline-design.md) — Shape パイプライン設計
- [`docs/build-session-worker-ui-event-spec.md`](../docs/build-session-worker-ui-event-spec.md) — Worker→UI イベント仕様

## ライセンス

MIT
