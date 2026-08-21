# @hierarchidb/route-plugin

最終更新: 2026-08-21

HierarchiDB の交通路・輸送ルート管理プラグイン。OpenStreetMap、OpenFlights、searoute-js、Transitland、Natural Earth 等のオープンデータソースから航路・海路・道路・鉄道・高速鉄道のルートデータをバッチダウンロードし、IndexedDB に永続化して地図上で可視化・分析する。`RouteBuildSession`（`AbstractBuildSession` を継承）による 3 ステージバッチ処理（source → geometry → tileEmit）、レーンポリシーによる並列制御、MapLibre ベースの Map プレビュー（交通モード別色分け・線幅調整）をサポートする。

## 正規仕様と移行状況

- Step2〜Step6、location連動、設定SSOT、cache identityの正規仕様は
  `docs/route-build-flow-spec.md`を参照する。
- ステージ詳細は`docs/vt-route-pipeline-design.md`、Worker→UI eventは
  `docs/build-session-worker-ui-event-spec.md`を参照する。
- 永続build設定は`RouteEntity.buildConfig`内の`RouteBuildConfig`だけをSSOTとする。
- routeは既定で方向付きであり、契約どおりbidirectionalと明示されたrouteだけ
  始終点を正規化して同一`sourceKey`にする。
- build sessionの正規entry pointは`RouteBuildSessionOrchestrator -> RouteBuildSession`とする。
- 2026-08-21時点ではUIの直接実行経路とsession経路が併存し、session側の
  `geometry` / `tileEmit`は実成果物を生成しない。Issue #549で単一の正規経路へ統合する。
- 未実装stage、engine欠落、不正設定をno-op成功や別engineへの暗黙fallbackで処理しない。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `route` |
| extends | `shape` |
| category | `geographic`（menuGroup: `geo`、createOrder: `60`） |
| dependencies | `['shape']` |

route-plugin は shape-plugin を継承し、location-plugin の始点・終点座標に依存して経路を生成する。shape-plugin のビルドインフラ（`runStageTasks`、`VtTaskQueueDb`）とベクトルタイル生成パイプラインを共用する。

## UI 層

### ダイアログステップ

route-plugin は `PluginStepRegistry` ベースの 5 ステップウィザードを提供する（ステップ 1 は共通プラグインが提供）:

| ステップ | ID | コンポーネント | 説明 |
| --- | --- | --- | --- |
| 1 | `basicInfo` | *(ui-plugin-basic-info)* | 基本情報（name / description）— `@hierarchidb/ui-plugin-basic-info` が提供 |
| 2 | `data-source` | `RouteDataSourceStep` | データソースの選択（OSM / OpenFlights / searoute / IDE-GSM 等） |
| 3 | `route-config` | `RouteSelectionStep` | 国×交通モードの選択マトリックス |
| 4 | `processing` | `RouteProcessingStep` | ビルド設定（TileEmit 設定カードを含む） |
| 5 | `build` | `RouteBuildStep` | ビルド実行・進捗表示 |
| 6 | `preview` | `RoutePreviewStep` | Map プレビュー（オプション） |

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `RouteDataSourceStep` | データソース選択 UI（ライセンス確認を含む） |
| `RouteSelectionStep` | 国×交通モードのチェックボックスマトリックス（OR/AND 切り替え） |
| `RouteProcessingStep` | ビルドパラメータ設定（geometry / tileEmit 設定） |
| `RouteBuildStep` | ビルド実行・進捗モニタリング |
| `RoutePreviewStep` | MapLibre ベースのルートプレビュー |
| `RouteBuildLaunchForm` | ビルド起動フォーム |
| `RouteBuildLiveProgress` | リアルタイムビルド進捗表示 |
| `RouteBuildProgressBar` | ビルド進捗バー |
| `RouteBuildSummary` | ビルド結果サマリー |

### アイコン

```typescript
// Entry point: @hierarchidb/route-plugin/icon
import { RoutePluginIcon } from '@hierarchidb/route-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Route` |
| Emoji | 〰️ |
| カラー | `#a3b030` |

## Worker 層

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerRouteWorkerStores'],
}
```

`registerRouteWorkerStores` は Worker 環境でのストア登録を行う。

### FeatureStore / VectorTileStore

- `createRouteFeatureStoreDexie` — `RouteDB` を基に `FeatureStore<RouteFeature>` を生成（`createDexieFeatureStore` ラッパー）
- `createRouteVectorTileStoreDexie` — `RouteDB` を基に `VectorTileStore` を生成（タイル ID は `${nodeId}-${z}-${x}-${y}` 形式）

### ビルドタスク取得

`getBuildTasks(nodeId)` が `VtTaskQueueDb` から指定ノードのビルドタスク一覧を取得し、`BuildTaskSummary[]` として返す。

### Tabular ビルド

`runRouteTabularBuild` が表形式データからルートセグメントを生成する:

1. `extractTabularRows` — TabularDataApi から行データを抽出
2. `materializeRouteSegmentsFromTabular` — 抽出行をルートセグメントに変換・永続化

### ライフサイクル

ルートデータの CRUD 操作は CoreDB TreeNode API と RouteDB を通じて行われる:

- **作成**: TreeNode 作成 + payload/draft への設定格納
- **ビルド**: `RouteBuildSession` による 3 ステージ並列処理（source → geometry → tileEmit）
- **更新**: TreeNode metadata の更新 + RouteDB のルートデータ更新
- **削除**: TreeNode 削除 + RouteDB のルートデータクリーンアップ

## データベーススキーマ

route-plugin は `@hierarchidb/route-store` が提供する Dexie ベースの `RouteDB` を使用する。

### メインテーブル（features）

```typescript
// plugin-manifest.ts — database definition
database: {
  dbName: 'route',
  tableName: 'features',
  version: 3,
  schema: {
    fields: [
      { name: 'id', indexed: true },
      { name: 'nodeId', indexed: true },
      { name: 'startLocationId', indexed: true },
      { name: 'endLocationId', indexed: true },
      { name: 'transportMode', indexed: true },
      { name: 'processingStatus', indexed: true },
      { name: 'createdAt', indexed: true },
      { name: 'updatedAt', indexed: true },
    ],
  },
}
```

### ベクトルタイルテーブル

`RouteVectorTileRecord` が `vectorTiles` テーブルに格納される。タイル ID は `${nodeId}-${z}-${x}-${y}` 形式で、MVT バイナリデータを保持する。

## 依存プラグイン

```typescript
// PluginManifest
dependencies: ['shape'],
```

| プラグイン | 関係 |
| --- | --- |
| `shape` | 必須依存 — ビルドインフラ（`runStageTasks`、`VtTaskQueueDb`）とベクトルタイルパイプラインを継承 |

location-plugin とは始点・終点座標を通じて連携する。location の変更時は route への波及（カスケード削除/変更）が前提となる。

## 設定項目

### Capabilities

```typescript
capabilities: {
  draft: true,           // draft mode support
  batch: true,           // batch processing support
  visualization: true,   // map visualization support
}
```

### データソース

route-plugin は 8 種類のデータソースをサポートする:

| データソース | 表示名 | ライセンス | 説明 |
| --- | --- | --- | --- |
| `openstreetmap` | OpenStreetMap | ODbL 1.0 | ルーティングベースライン・参照データ |
| `searoute` | searoute | MIT | 港湾間の海上ルート計算 |
| `openflights` | OpenFlights | ODbL 1.0 | 世界の航空路データ |
| `transitland` | Transitland | 事業者別 | GTFS フィードによる公共交通データ |
| `searoute-js` | searoute-js | MIT | 港湾間の海上ルート計算（JS 版） |
| `naturalearth-rivers` | Natural Earth Rivers | Public Domain | 主要河川システム |
| `ide-gsm` | IDE-GSM | IDE-GSM License | IDE-GSM スキーマファイル |
| `custom` | Custom | ユーザー提供 | ユーザー提供のルートデータ |

### 交通モード（RouteMode）

| モード | 定数 | デフォルト色 |
| --- | --- | --- |
| 航路 | `ROUTE_MODES.AIRWAY` | `#1f77b4` |
| 水路 | `ROUTE_MODES.WATERWAY` | `#17becf` |
| 高速鉄道 | `ROUTE_MODES.H_RAILWAY` | `#d62728` |
| 鉄道 | `ROUTE_MODES.RAILWAY` | `#ff7f0e` |
| 道路 | `ROUTE_MODES.ROAD` | `#2ca02c` |
| 高速道路 | `ROUTE_MODES.HIGHWAY` | `#9467bd` |

### ビルド設定（RouteBuildConfig）

デフォルト設定は `DEFAULT_ROUTE_BUILD_CONFIG` で定義される:

| カテゴリ | 主要パラメータ | デフォルト値 |
| --- | --- | --- |
| routeGeneration | method | `'direct'` |
| routeGeneration | parallel | `true` |
| routeGeneration | maxConcurrent | `4` |
| sourceConfig | maxConcurrent | `2` |
| sourceConfig | timeoutMs | `300000` |
| geometryConfig | enableFeatureFiltering | `true` |
| tileEmitConfig | format | `'mvt'` |
| tileEmitConfig | compression | `'gzip'` |
| tileEmitConfig | tileSize | `256` |

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `route-plugin` |
| ロケール | `en`, `ja` |

## バッチ処理

route-plugin は `batch: true` を宣言し、`RouteBuildSession`（`AbstractBuildSession` を継承）による 3 ステージバッチ処理を実行する。

### ビルドフロー

```text
RouteBuildManager.startRouteBuildSession()
  → RouteBuildTask[] 生成（source / geometry / tileEmit）
  → VtTaskQueueDb に永続化
  → RouteBuildSession.processBatch()
    → runStageTasks('source')   — ルート経路生成（RouteGenerator）
    → runStageTasks('geometry') — ジオメトリ処理
    → runStageTasks('tileEmit') — ベクトルタイル生成
```

### 3 ステージパイプライン

| ステージ | 処理内容 | 並列制御 |
| --- | --- | --- |
| `source` | 始点・終点座標から経路を生成（`RouteGenerator`） | レーンポリシーによるメソッド別並列制御 |
| `geometry` | ジオメトリ処理（簡略化・フィルタリング） | `geometryConfig.maxConcurrent` |
| `tileEmit` | MVT ベクトルタイル生成 | `tileEmitConfig.maxConcurrent` |

### レーンポリシー

source ステージでは `lanePolicy` によりルート生成メソッド別の並列数を制御する:

| メソッド | デフォルト並列数 |
| --- | --- |
| `osm_route` | 1 |
| `searoute` | 3 |
| `direct` | 64 |
| `great_circle` | 64 |
| `custom` | 8 |

### RouteBuildOrchestrationService

`RouteBuildOrchestrationService` が高レベルのビルドオーケストレーションを提供する:

| メソッド | 説明 |
| --- | --- |
| `startFromSources` | データソースから OD ペアを取得してビルド開始 |
| `startMatrix` | 起点×終点のマトリックスビルド |
| `startEnrich` | 既存ルートのエンリッチメントビルド |

### RouteSourceOrchestrator

`RouteSourceOrchestrator` がデータソース戦略の選択と実行を担当する:

- `TabularStrategy` — 表形式データソース（IDE-GSM 等）
- `GeoJsonStrategy` — GeoJSON データソース
- `FetchNetworkPort` によるホスト単位の同時接続管理（4 接続）、CORS プロキシ対応

### Location 連携

route の成果物は location の始点・終点座標に依存する。location 変更時の波及:

- **削除**: 参照中 route もカスケード削除するかキャンセル
- **座標/admin code 変更**: fetch キャッシュ削除 + `rebuild required` 表示 + 再ビルド予約
- **その他の項目変更**: route metadata を即時更新

## Map プレビュー

route-plugin は MapLibre GL JS を使用してルートデータの Map プレビューを提供する。

### プレビュー機能

- ビルド完了後にルートデータを LineString レイヤとして地図上に表示
- 交通モード別の色分け表示（6 モード: 航路・水路・高速鉄道・鉄道・道路・高速道路）
- 線幅調整（`lineWidth` パラメータ）
- 線スタイル切り替え（solid / dashed / dotted）
- 交通モード別のフィルタリングトグル
- FloatingWindow でメタデータ・交通モードトグル・スタイル設定を重ね表示

### スタイル設定

```typescript
import { buildDefaultRouteStyleConfig, mergeRouteStyleConfig } from '@hierarchidb/route-plugin/common';

// Default style configuration
const defaultStyle = buildDefaultRouteStyleConfig();
// { modeColors: { airway: '#1f77b4', ... }, lineWidth: 2, lineStyle: 'solid' }

// Merge with custom overrides
const customStyle = mergeRouteStyleConfig({
  lineWidth: 3,
  lineStyle: 'dashed',
});
```

### MapLibre レイヤ式

`buildRouteColorExpression` が `routeMode` プロパティに基づく MapLibre の `match` 式を生成し、交通モード別の色分けを実現する。`resolveLineDashArray` が線スタイルに応じたダッシュ配列を返す。

### Tabular Preview

ビルド実行後にデータテーブルタブでルートデータの表ビューを閲覧できる。複数条件フィルタ（AND）、表示列の切替、`eq` 条件の索引（初回遅延作成）をサポートする。`RouteTabularMetadataManager` が表形式メタデータの管理を担当する。

## 使用例

### PluginManifest の参照

```typescript
import { RoutePluginManifest } from '@hierarchidb/route-plugin/common';

console.log(RoutePluginManifest.nodeType); // 'route'
console.log(RoutePluginManifest.extends);  // 'shape'
console.log(RoutePluginManifest.dependencies); // ['shape']
```

### RoutePluginIcon の使用

```tsx
import { RoutePluginIcon } from '@hierarchidb/route-plugin/icon';

<RoutePluginIcon sx={{ color: '#a3b030' }} />
```

### データソース定義の参照

```typescript
import { ROUTE_DATA_SOURCES } from '@hierarchidb/route-plugin/common';

// List all available data sources
ROUTE_DATA_SOURCES.forEach((ds) => {
  console.log(`${ds.displayName}: ${ds.license}`);
});

// Find a specific data source
const searoute = ROUTE_DATA_SOURCES.find((ds) => ds.name === 'searoute');
console.log(searoute?.displayName); // 'searoute'
```

### ルートスタイル設定

```typescript
import {
  buildDefaultRouteStyleConfig,
  buildRouteColorExpression,
  resolveLineDashArray,
} from '@hierarchidb/route-plugin/common';

// Build a MapLibre color expression for route mode coloring
const style = buildDefaultRouteStyleConfig();
const colorExpr = buildRouteColorExpression(style);
// ['match', ['get', 'routeMode'], 'airway', '#1f77b4', ...]

// Resolve dash array for line style
const dashArray = resolveLineDashArray('dashed'); // [2, 2]
```

### RuntimeBridge の使用

```typescript
import { RouteRuntimeBridge } from '@hierarchidb/route-plugin/common';

// Register runtime worker adapters (flag ROUTE_RUNTIME_WORKER=1 required)
await RouteRuntimeBridge.registerRuntimeWorkerAdapters();
```

## ディレクトリ構成

```text
src/
├── plugin-manifest.ts                # PluginManifest definition
├── common/
│   ├── index.ts                      # Common public API entry point
│   ├── config/
│   │   └── buildConfig.ts            # DEFAULT_ROUTE_BUILD_CONFIG, mergeRouteBuildConfig
│   ├── datasource/
│   │   └── ROUTE_DATA_SOURCES.ts     # Data source config array (8 sources)
│   ├── entities/                     # Entity definitions
│   ├── i18n/
│   │   ├── en.ts                     # English translations
│   │   ├── ja.ts                     # Japanese translations
│   │   └── types.ts                  # i18n type definitions
│   ├── orchestrator/
│   │   ├── RouteBuildOrchestrationService.ts  # High-level build orchestration
│   │   ├── RouteSourceOrchestrator.ts         # Data source strategy orchestration
│   │   ├── TaskMapper.ts                      # OD pair → task mapping
│   │   ├── types.ts                           # Orchestrator types
│   │   └── strategies/                        # TabularStrategy, GeoJsonStrategy
│   ├── styles/
│   │   └── routeStyle.ts             # Route style config, color expressions
│   ├── tabular/
│   │   ├── createRouteTabularApi.ts           # Tabular API factory
│   │   └── RouteTabularMetadataManager.ts     # Tabular metadata manager
│   ├── types/
│   │   └── index.ts                  # RouteUpdaterPayload, TagId
│   └── utils/
│       └── draft.ts                  # Draft utilities
├── icon/
│   └── index.ts                      # RoutePluginIcon (re-export of MUI Route)
├── services/
│   ├── LocationResolver.ts           # Location coordinate resolution
│   ├── RouteBuildManager.ts          # Build session manager (task creation, session lifecycle)
│   ├── RouteBuildSession.ts          # Build session (3-stage pipeline with lane policy)
│   ├── RouteBuildSessionOrchestrator.ts  # Session orchestrator (extends BaseBuildSessionManager)
│   ├── build/
│   │   └── adapters/                 # Runtime worker adapter registration
│   ├── config/
│   │   ├── isFlagEnabled.ts          # Feature flag check
│   │   └── osrm-defaults.ts          # OSRM engine defaults
│   ├── engines/
│   │   ├── OsrmEngine.ts             # OSRM routing engine
│   │   └── types.ts                  # Engine types
│   ├── ide-gsm/
│   │   ├── applyIdeGsmWaypoints.ts   # IDE-GSM waypoint application
│   │   └── ideGsmCsv.ts             # IDE-GSM CSV import
│   └── net/
│       ├── getNetPort.ts             # Network port factory
│       └── ThrottledPort.ts          # Throttled network port
├── ui/
│   ├── index.ts                      # UI entry point (deprecated getDialogComponent)
│   ├── i18n.ts                       # i18n setup
│   ├── components/
│   │   ├── steps-provider.tsx        # PluginStepRegistry registration (5 steps)
│   │   ├── RouteBuildLaunchForm.tsx   # Build launch form
│   │   ├── RouteBuildLiveProgress.tsx # Live progress display
│   │   ├── RouteBuildProgressBar.tsx  # Progress bar
│   │   ├── RouteBuildSummary.tsx      # Build summary
│   │   ├── useRouteBuildLaunchForm.ts # Build launch form hook
│   │   └── steps/
│   │       ├── RouteBuildStep.tsx     # Build execution step
│   │       ├── RouteDataSourceStep.tsx # Data source selection
│   │       ├── RoutePreviewStep.tsx   # Map preview step
│   │       ├── RouteProcessingStep.tsx # Processing config step
│   │       └── RouteSelectionStep.tsx  # Country × mode selection
│   ├── hooks/
│   │   ├── useRouteBuildCrashInsight.ts  # Build crash insight hook
│   │   └── useRouteBuildProgress.ts      # Build progress hook
│   ├── locales/
│   │   ├── en.json                   # English translations
│   │   └── ja.json                   # Japanese translations
│   └── utils/
│       └── clearRouteDataSourceCache.ts  # Cache clearing
└── worker/
    ├── index.ts                      # Worker entry point (getBuildTasks, registerRouteWorkerStores)
    ├── createRouteFeatureStoreDexie.ts    # Dexie FeatureStore factory
    ├── createRouteVectorTileStoreDexie.ts # Dexie VectorTileStore factory
    ├── getBuildTasks.ts              # Build task retrieval from VtTaskQueueDb
    ├── factory/
    │   └── index.ts                  # Factory entry (re-export)
    └── tabular/
        ├── extractTabularRows.ts              # Tabular row extraction
        ├── materializeRouteSegmentsFromTabular.ts  # Tabular → RouteSegment conversion
        ├── progress.ts                        # Progress reporter type
        └── runRouteTabularBuild.ts            # Tabular build runner
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/route-plugin/common` | 型定義、PluginManifest、データソース定義、スタイル設定、RuntimeBridge |
| `@hierarchidb/route-plugin/ui` | UI コンポーネント（ステップ登録、deprecated getDialogComponent） |
| `@hierarchidb/route-plugin/icon` | RoutePluginIcon |
| `@hierarchidb/route-plugin/worker` | Worker ストア登録、getBuildTasks |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../packages/core-types/) — NodeId、NodeType 等の共有型定義
- [`@hierarchidb/route-api`](../packages/route-api/) — Route API 型定義（RouteEntity、RouteBuildConfig、RouteMode）
- [`@hierarchidb/route-store`](../packages/route-store/) — Route データストア（Dexie）
- [`@hierarchidb/route-engine`](../packages/route-engine/) — ルート生成エンジン（RouteGenerator）
- [`@hierarchidb/location-api`](../packages/location-api/) — Location API 型定義
- [`@hierarchidb/location-store`](../packages/location-store/) — Location データストア
- [`@hierarchidb/build-api`](../packages/build-api/) — ビルド API 型定義・セッションイベント
- [`@hierarchidb/build-runtime-services`](../packages/build-runtime-services/) — ビルドランタイムサービス（BaseBuildSessionManager、AbstractBuildSession）
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker ランタイム（FeatureStore、VectorTileStore）
- [`@hierarchidb/vt-orchestrator`](../packages/vt-orchestrator/) — ベクトルタイルオーケストレーター（runStageTasks、VtTaskQueueDb）
- [`@hierarchidb/tabular-store`](../packages/tabular-store/) — 表形式データストア
- [`@hierarchidb/tabular-source-xlsx`](../packages/tabular-source-xlsx/) — XLSX データソース
- [`@hierarchidb/spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — Tabular Preview 連携
- [`@hierarchidb/download`](../packages/download/) — ダウンロードサービス（FetchNetworkPort、CORS プロキシ）
- [`@hierarchidb/gis-sdk`](../packages/gis-sdk/) — GIS SDK
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode 型定義
- [`@hierarchidb/ui-map`](../packages/ui/map/) — 地図 UI コンポーネント
- [`@hierarchidb/ui-build-progress`](../packages/ui/build-progress/) — ビルド進捗 UI
- [`@hierarchidb/ui-build-sessions`](../packages/ui/build-sessions/) — ビルドセッション管理 UI
- [`@hierarchidb/ui-country-select`](../packages/ui/country-select/) — 国選択 UI
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — プラグイン UI SDK

### 関連プラグイン

- [`shape-plugin`](../plugins/shape-plugin/) — 継承元（ビルドインフラ・ベクトルタイルパイプライン共用）
- [`location-plugin`](../plugins/location-plugin/) — 始点・終点座標の提供元
- [`basemap-plugin`](../plugins/basemap-plugin/) — Map プレビューのベースマップ
- [`styler-plugin`](../plugins/styler-plugin/) — スタイル連携

## ライセンス

MIT
