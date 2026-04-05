# @hierarchidb/location-plugin

最終更新: 2026-04-05

HierarchiDB の地理的位置データ管理プラグイン。OpenStreetMap、GeoNames、OurAirports、OpenFlights、World Port Index 等のオープンデータソースから空港・鉄道駅・港湾・行政センター等の地点情報（POI）をバッチダウンロードし、IndexedDB に永続化して地図上で可視化・分析する。BuildSession によるバッチ処理、マルチソース並列ダウンロード、MapLibre ベースの Map プレビュー（クラスタリング・ヒートマップ）をサポートする。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `location` |
| extends | `folder` |
| category | `geographic`（menuGroup: `geo`、createOrder: `40`） |
| priority | `40` |

location-plugin は folder-plugin を継承し、地点情報の収集・管理・可視化を提供する。Shape 連携機能により、shape-plugin のフィーチャに対する重心座標の紐付けが可能。

## UI 層

### ダイアログステップ

location-plugin は `PluginStepRegistry` ベースの 3 ステップウィザードを提供する（ステップ 1 は共通プラグインが提供）:

| ステップ | ID | コンポーネント | 説明 |
| --- | --- | --- | --- |
| 1 | `basicInfo` | *(ui-plugin-basic-info)* | 基本情報（name / description）— `@hierarchidb/ui-plugin-basic-info` が提供 |
| 2 | `data-source` | `LocationDataSourceStep` | データソースの選択（OSM / GeoNames / OurAirports 等）、IDE-GSM CSV インポート |
| 3 | `selection` | `LocationSelectionStep` | 国×地点タイプの選択マトリックス |
| 4 | `map-preview` | `LocationMapPreviewStep` | 地点データの Map プレビュー（オプション） |

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `LocationDataSourceStep` | データソース選択 UI（ライセンス確認を含む） |
| `LocationSelectionStep` | 国×地点タイプのチェックボックスマトリックス |
| `LocationMapPreviewStep` | MapLibre ベースの地点プレビュー（マーカー・クラスタ・ヒートマップ） |
| `LocationBuildParametersStep` | ビルドパラメータ設定 |
| `LocationLicenseStep` | ライセンス同意ステップ |
| `LocationStyleConfigPanel` | 地点表示スタイル設定パネル |
| `BuildProgressDialog` | ビルド進捗ダイアログ |
| `LocationMapPreview` | Map プレビューコンポーネント |
| `LocationPanel` | ノード詳細パネル |

### アイコン

```typescript
// Entry point: @hierarchidb/location-plugin/icon
import { LocationPluginIcon } from '@hierarchidb/location-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `LocationOn` |
| Emoji | 📍 |
| カラー | `#a3b030` |

## Worker 層

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerLocationWorkerStores', 'loadLocationEntitiesDbModule'],
}
```

`registerLocationWorkerStores` は Worker 環境でのストア登録を行い、`loadLocationEntitiesDbModule` は LocationDB モジュールを遅延ロードする。

### FeatureStore

`createLocationFeatureStoreDexie` が `LocationDB` を基に `FeatureStore<LocationGroupItemData>` を生成する。`list` / `bulkUpsert` / `bulkDelete` 操作を提供し、Morton キーによる空間インデックスを付与する。

### データ正規化

`normalizers.ts` が Worker 層のデータ正規化を担当する:

- `normalizePeerData` — `LocationPeerData`（schemaVersion: 1）の正規化
- `normalizeGroupData` — `LocationGroupItemData`（schemaVersion: 1→2 マイグレーション含む）の正規化
- `toGroupRow` / `fromGroupRow` — `FeatureItemBase` ↔ `LocationFeature` の変換

### ライフサイクル

位置データの CRUD 操作は CoreDB TreeNode API と LocationDB を通じて行われる:

- **作成**: TreeNode 作成 + payload/draft への設定格納
- **ビルド**: `LocationBuildSession` による並列ダウンロード・フィルタ・永続化
- **更新**: TreeNode metadata の更新 + LocationDB のポイントデータ更新
- **削除**: TreeNode 削除 + LocationDB のポイントデータクリーンアップ

## データベーススキーマ

location-plugin は `@hierarchidb/location-store` が提供する Dexie ベースの `LocationDB` を使用する。

### メインテーブル（features）

```typescript
// plugin-manifest.ts — database definition
database: {
  dbName: 'location',
  tableName: 'features',
  version: 12,
  schema: {
    fields: [
      { name: 'nodeId', indexed: true },
      { name: 'id', indexed: true },
      { name: 'type', indexed: true },
      { name: 'mortonKey', indexed: true },
      { name: 'updatedAt', indexed: true },
    ],
  },
}
```

### LocationFeature レコード

```typescript
interface LocationFeature {
  nodeId: NodeId;
  id: string;
  type: string;                    // location type (airport, port, etc.)
  mortonKey?: number;              // spatial index via Morton curve
  data?: LocationGroupItemData;    // point properties
  centroidForShapeId?: number;     // linked Shape feature ID
  centroidForShapeContainerNodeId?: NodeId;  // linked Shape node
  updatedAt: number;
}
```

### LocationGroupItemData（schemaVersion: 2）

```typescript
interface LocationGroupItemData {
  schemaVersion: 2;
  pointId: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  admin0Code: string;              // ISO 3166-1 alpha-2
  admin0?: string;                 // country name
  admin1?: string;                 // first-level admin division
  admin2?: string;                 // second-level admin division
  centroidForShapeId?: number;
  centroidForShapeContainerNodeId?: NodeId;
  metadata?: Record<string, string | number | null>;
}
```

## 依存プラグイン

```typescript
// PluginManifest
dependencies: ['folder'],
```

| プラグイン | 関係 |
| --- | --- |
| `folder` | 必須依存 — 基盤ノードタイプを継承 |

`spreadsheet-plugin` は peerDependency として宣言されており、Tabular Preview 機能で連携する。`shape-plugin` とは `centroidForShapeId` / `centroidForShapeContainerNodeId` フィールドを通じて連携する。

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

location-plugin は 8 種類のデータソースをサポートする:

| データソース | 表示名 | ライセンス | 対応地点タイプ | 更新頻度 |
| --- | --- | --- | --- | --- |
| `openstreetmap-overpass` | OpenStreetMap (Overpass API) | ODbL 1.0 | 全タイプ | リアルタイム |
| `openstreetmap-nominatim` | OpenStreetMap (Nominatim) | ODbL 1.0 | 全タイプ | リアルタイム |
| `geonames` | GeoNames | CC BY 4.0 | 全タイプ | 日次 |
| `natural-earth` | Natural Earth | Public Domain | 行政・空港・港 | 不定期 |
| `ourairports` | OurAirports | Public Domain | 空港 | 週次 |
| `openflights` | OpenFlights | ODbL 1.0 | 空港・駅 | 不定期 |
| `world-port-index` | World Port Index | Public Domain | 港湾 | 年次 |
| `ide-gsm` | IDE-GSM | IDE-GSM License | 全タイプ | 不定期 |

### 地点タイプ（LocationType）

| タイプ | 説明 | OSM タグ |
| --- | --- | --- |
| `airport` | 空港 | `aeroway=aerodrome` |
| `railway_station` | 鉄道駅 | `railway=station` |
| `port` | 港湾 | `harbour=yes` |
| `interchange` | 高速道路 IC | `highway=motorway_junction` |
| `area_centroid` | エリア重心（フォールバック） | — |

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `location-plugin` |
| ロケール | `en`, `ja` |

## バッチ処理

location-plugin は `batch: true` を宣言し、`LocationBuildSession`（`AbstractBuildSession` を継承）によるバッチ処理を実行する。

### ビルドフロー

```text
searchConfigs → [並列バッチ] → searchLocations → validateAndFilter → persistLocationPoints
```

1. `LocationBuildManager.startLocationBuildSession(nodeId, config)` でセッションを開始
2. `LocationBuildSession.processBatch()` が `searchConfigs` を並列バッチに分割して実行
3. 各バッチで `searchLocations()` → `validateAndFilterLocations()` → `persistLocationPoints()` を実行
4. 進捗は `updateProgress()` で UI に通知

### 並列ダウンロード

`LocationBuildConfig.processingOptions.concurrent` で並列数を制御（デフォルト: 1）。`FetchNetworkPort` がホスト単位の同時接続数（4）を管理し、CORS プロキシ経由でのリクエストをサポートする。

### データソース別検索

`LocationBuildSession` は `strategyRegistry` に登録された戦略を優先的に使用し、フォールバックとして組み込みの検索メソッドを実行する:

| メソッド | データソース | 処理内容 |
| --- | --- | --- |
| `searchOSM` | Nominatim | ジオコーディング検索 |
| `searchOverpass` | Overpass API | OSM タグベースの空間検索 |
| `searchGeoNames` | GeoNames API | 地名辞書検索 |
| `searchOurAirports` | OurAirports CSV | 空港 CSV パース |
| `searchOpenFlights` | OpenFlights CSV | 空港 CSV パース |
| `searchWorldPortIndex` | WPI CSV | 港湾 CSV パース |
| `searchCustom` | カスタムエンドポイント | ユーザー指定 API |

### 国コード正規化

`normalizeCountryCodes()` が `@hierarchidb/gen-iso3166-2` の ISO 3166 データを使用して、alpha-3 / 国名 → alpha-2 への正規化を行う。

### フィルタリング

`validateAndFilterLocations()` が以下の条件でフィルタリングを実行:

- `allowedTypes` — 許可する地点タイプ
- `countryCodes` / `countryNames` — 国コード / 国名によるフィルタ
- `excludeIds` — 除外する地点 ID

### ポイント永続化

`pointRepository.ts` が LocationDB への CRUD 操作を提供する:

| 関数 | 説明 |
| --- | --- |
| `appendLocationPoints` | 既存データに追加 |
| `replaceLocationPoints` | 全データを置換 |
| `replaceLocationPointsChunked` | チャンク単位で置換（進捗コールバック付き） |
| `listLocationPoints` | ノードの全ポイントを取得 |
| `deleteLocationPoints` | 指定 ID のポイントを削除 |
| `clearLocationPoints` | ノードの全ポイントをクリア |

## Map プレビュー

location-plugin は MapLibre GL JS を使用して地点データの Map プレビューを提供する。

### プレビュー機能

- ビルド完了後に地点データをマーカーとして地図上に表示
- 表示モード切り替え: ポイント / クラスタリング / ヒートマップ
- 地点タイプ別のフィルタリング（空港・鉄道駅・港湾・行政センター・IC）
- マーカークリックで詳細情報のポップアップ表示
- ベースマップレイヤとの重ね合わせ

### プレビューコンポーネント構成

```text
LocationMapPreviewStep
├── LocationMapPreview           # Main map component
├── LocationMapPreviewMarkers    # Marker rendering
├── useLocationMapPreview        # Map state management
├── useLocationMapPreviewMap     # MapLibre instance management
├── useLocationMapPreviewMetadata # Metadata loading
└── useLocationPreviewConfig     # Preview configuration
```

### Tabular Preview

ビルド実行後に BuildProgressDialog の「データテーブル」タブで表データを閲覧できる。複数条件フィルタ（AND）、表示列の切替、`eq` 条件の索引（初回遅延作成）をサポートする。`LocationTabularMetadataManager` が表形式メタデータの管理を担当する。

## Shape 連携

location-plugin は shape-plugin と以下のフィールドを通じて連携する:

- `centroidForShapeId` — Shape フィーチャの ID（重心座標の紐付け先）
- `centroidForShapeContainerNodeId` — Shape コンテナノードの NodeId

この連携により、Shape の行政区域フィーチャに対して位置データの重心を紐付け、地理的分析を行うことができる。

## 使用例

### PluginManifest の参照

```typescript
import { LocationPluginManifest } from '@hierarchidb/location-plugin/common';

console.log(LocationPluginManifest.nodeType); // 'location'
console.log(LocationPluginManifest.capabilities.batch); // true
```

### LocationPluginIcon の使用

```tsx
import { LocationPluginIcon } from '@hierarchidb/location-plugin/icon';

<LocationPluginIcon sx={{ color: '#a3b030' }} />
```

### データソース定義の参照

```typescript
import { getLocationDataSource, getLocationDataSourcesByType } from '@hierarchidb/location-plugin/common';

// Look up a specific data source
const ourAirports = getLocationDataSource('ourairports');
console.log(ourAirports?.name); // 'OurAirports'

// Find data sources supporting airport type
const airportSources = getLocationDataSourcesByType('airport');
console.log(airportSources.length); // multiple sources
```

## ディレクトリ構成

```text
src/
├── plugin-manifest.ts                # PluginManifest definition
├── locationEntitiesDB.ts             # Re-export of LocationDB from location-store
├── common/
│   ├── index.ts                      # Common public API entry point
│   ├── components/
│   │   ├── LocationDialog.tsx        # Location dialog component
│   │   └── LocationPanel.tsx         # Location panel component
│   ├── datasources/
│   │   ├── LOCATION_DATA_SOURCES.ts  # Data source config array
│   │   ├── LocationDataSourceDefinitions.ts  # Data source definitions (8 sources)
│   │   └── resolveLocationAttribution.ts     # Attribution resolution
│   ├── entities/
│   │   ├── LocationEntity.ts         # LocationEntity, LocationBuildConfig types
│   │   └── LocationPoint.ts          # LocationPointProperties type
│   ├── hooks/
│   │   └── useLocationProgress.ts    # Location progress hook
│   ├── i18n/
│   │   ├── formatters.ts            # i18n formatters
│   │   └── index.ts                 # i18n entry
│   ├── tabular/
│   │   ├── createLocationTabularApi.ts          # Tabular API factory
│   │   └── LocationTabularMetadataManager.ts    # Tabular metadata manager
│   ├── types/
│   │   ├── entities.ts              # Re-exports from location-api
│   │   ├── index.ts                 # Type definitions (LocationDraft, UpdateLocationData, etc.)
│   │   └── payloads.ts             # Payload types
│   └── utils/
│       └── isDevEnvironment.ts      # Dev environment detection
├── icon/
│   └── index.ts                     # LocationPluginIcon (re-export of MUI LocationOn)
├── services/
│   ├── index.ts                     # Service exports (BuildManager, BuildSession, pointRepository)
│   ├── LocationBuildManager.ts      # Build session manager (extends BaseBuildSessionManager)
│   ├── LocationBuildSession.ts      # Build session (extends AbstractBuildSession)
│   ├── pointFactories.ts           # OSM/Overpass point property builders
│   ├── pointRepository.ts          # Point CRUD operations (append, replace, list, delete, clear)
│   ├── download/
│   │   ├── csvSources.ts           # CSV parsers (OurAirports, OpenFlights, WorldPortIndex)
│   │   ├── csvUtils.ts             # CSV utility functions
│   │   ├── mappers.ts              # Type/number mappers
│   │   ├── rawTypes.ts             # Raw API response types
│   │   ├── strategyRegistry.ts     # Data source strategy registry
│   │   └── types.ts                # Download types
│   └── ide-gsm/
│       └── ideGsmCsv.ts            # IDE-GSM CSV import
├── ui/
│   ├── index.ts                     # UI entry point (step registration)
│   ├── i18n.ts                      # i18n setup
│   ├── components/
│   │   ├── steps-provider.tsx       # PluginStepRegistry registration (3 steps)
│   │   ├── batch/
│   │   │   ├── BuildProgressDialog.tsx         # Build progress dialog
│   │   │   ├── LocationMapPreview.tsx          # Map preview component
│   │   │   ├── LocationMapPreviewMarkers.tsx   # Marker rendering
│   │   │   ├── locationMapPreviewTypes.ts      # Preview type definitions
│   │   │   └── useLocationMapPreview.ts        # Map preview hook
│   │   └── steps/
│   │       ├── LocationBuildParametersStep.tsx  # Build parameters
│   │       ├── LocationDataSourceStep.tsx       # Data source selection
│   │       ├── LocationLicenseStep.tsx          # License agreement
│   │       ├── LocationMapPreviewStep.tsx       # Map preview step
│   │       ├── LocationSelectionStep.tsx        # Country × type selection
│   │       ├── LocationStyleConfigPanel.tsx     # Style configuration
│   │       └── ... (hooks and utilities)
│   ├── hooks/
│   │   └── useIdeGsmImportOnEntry.ts  # IDE-GSM auto-import hook
│   ├── locales/
│   │   ├── en.json                  # English translations
│   │   └── ja.json                  # Japanese translations
│   ├── state/
│   │   └── ideGsmProgress.ts        # IDE-GSM progress state
│   └── utils/
│       ├── clearLocationDataSourceCache.ts  # Cache clearing
│       └── ideGsmSelection.ts       # IDE-GSM selection utilities
└── worker/
    ├── index.ts                     # Worker entry point
    ├── locationEntitiesDB.ts        # LocationDB re-export
    ├── createLocationFeatureStoreDexie.ts  # Dexie FeatureStore factory
    ├── normalizers.ts               # Data normalization (PeerData, GroupData, Morton key)
    ├── factory/
    │   ├── index.ts                 # Factory entry
    │   └── registerLocationWorkerStores.ts  # Worker store registration
    └── tabular/
        ├── extractTabularRows.ts              # Tabular row extraction
        ├── materializeLocationPointsFromTabular.ts  # Tabular → LocationPoint conversion
        └── runLocationTabularBuild.ts         # Tabular build runner
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/location-plugin/common` | 型定義、PluginManifest、データソース定義、アトリビューション |
| `@hierarchidb/location-plugin/ui` | UI コンポーネント（ステップ登録、パネル） |
| `@hierarchidb/location-plugin/icon` | LocationPluginIcon |
| `@hierarchidb/location-plugin/worker` | Worker ストア登録、LocationDB モジュールローダ |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../packages/core-types/) — NodeId、NodeType、ISO2 等の共有型定義
- [`@hierarchidb/folder-plugin`](../plugins/folder-plugin/) — 基盤ノードタイプ（継承元）
- [`@hierarchidb/location-store`](../packages/location-store/) — Location データストア（Dexie）
- [`@hierarchidb/location-api`](../packages/location-api/) — Location API 型定義
- [`@hierarchidb/build-api`](../packages/build-api/) — ビルド API 型定義・セッションイベント
- [`@hierarchidb/build-runtime-services`](../packages/build-runtime-services/) — ビルドランタイムサービス（BaseBuildSessionManager、AbstractBuildSession）
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker ランタイム（FeatureStore）
- [`@hierarchidb/worker-api`](../packages/worker-api/) — Worker API
- [`@hierarchidb/tabular-store`](../packages/tabular-store/) — 表形式データストア
- [`@hierarchidb/tabular-source`](../packages/tabular-source/) — 表形式データソース
- [`@hierarchidb/tabular-source-xlsx`](../packages/tabular-source-xlsx/) — XLSX データソース
- [`@hierarchidb/gen-iso3166-2`](../packages/tools/gen-iso3166-2/) — ISO 3166-2 コード生成・国コード正規化
- [`@hierarchidb/download`](../packages/download/) — ダウンロードサービス（FetchNetworkPort、CORS プロキシ）
- [`@hierarchidb/gis-sdk`](../packages/gis-sdk/) — GIS SDK
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode 型定義
- [`@hierarchidb/ui-map`](../packages/ui/map/) — 地図 UI コンポーネント
- [`@hierarchidb/ui-build-progress`](../packages/ui/build-progress/) — ビルド進捗 UI
- [`@hierarchidb/ui-build-sessions`](../packages/ui/build-sessions/) — ビルドセッション管理 UI
- [`@hierarchidb/ui-country-select`](../packages/ui/country-select/) — 国選択 UI
- [`@hierarchidb/ui-tabular`](../packages/ui/tabular-extract/) — 表形式データ抽出 UI
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — プラグイン UI SDK

### 関連プラグイン

- [`shape-plugin`](../plugins/shape-plugin/) — Shape データ連携（centroidForShapeId による紐付け）
- [`basemap-plugin`](../plugins/basemap-plugin/) — Map プレビューのベースマップ
- [`spreadsheet-plugin`](../plugins/spreadsheet-plugin/) — Tabular Preview 連携
- [`route-plugin`](../plugins/route-plugin/) — 経路生成（位置データ連携）

## ライセンス

MIT
