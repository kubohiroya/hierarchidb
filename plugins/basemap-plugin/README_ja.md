# @hierarchidb/basemap-plugin

最終更新: 2026-04-05

HierarchiDB のツリー構造において、共有の地図スタイルとビューポートを管理するプラグイン。MapLibre GL JS を利用し、祖先ノードが使用するベースマップの設定（スタイルプリセット・カスタムスタイル URL・初期表示範囲）を永続化する。子孫ノード（shape-plugin、location-plugin 等）はこの設定を継承して地図を描画する。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `basemap` |
| extends | `folder` |
| category | `geographic` |
| priority | `900` |

basemap-plugin は folder-plugin を継承し、フォルダとしてのコンテナ機能に加えて地図スタイル・ビューポートの管理機能を提供する。子ノードを持つことができるが、ルートノードにはなれない。

## UI 層

### ダイアログ（マルチステップ）

basemap-plugin は `PluginStepRegistry` ベースのステップ登録方式を採用し、folder ダイアログに 2 つの拡張ステップを追加する。

ステップ登録は `src/ui/components/steps-provider.tsx` で行われ、`basemap` nodeType に対して以下のステップを提供する:

| ステップ # | ラベル | 内容 | バリデーション |
| --- | --- | --- | --- |
| 1 | Basic Info | 基本情報（`@hierarchidb/ui-plugin-basic-info` が提供） | — |
| 2 | Map Style | プリセットカード（`streets`, `satellite`, `terrain`, `dark`, `light`）+ 「Custom」カード（URL 入力） | スタイル選択必須。`custom` の場合は有効な絶対 URL が必要 |
| 3 | Map Viewport | 経度/緯度/ズーム/方位の入力フィールド + インタラクティブな MapLibre 地図プレビュー | 経度 [-180, 180]、緯度 [-90, 90]、ズーム [0, 24]、方位 [-180, 180] |

ステップゲーティングは順次方式（ステップ 2 のバリデーション通過後にステップ 3 がアンロック）。全ステップのバリデーション通過後に送信が有効になる。

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `BaseMapDisplay` | MapLibre を使用した地図ビューア。永続化されたスタイル + ビューポートを描画する |
| `BaseMapPreview` | 軽量なプレビューカード。ダイアログやサマリー内で使用される |
| `MapStyleStep` | 地図スタイル選択ステップ。プリセット + カスタム URL 入力 |
| `ViewportStep` | ビューポート設定ステップ。数値入力 + インタラクティブ地図 |

### アイコン

```typescript
// Entry point: @hierarchidb/basemap-plugin/icon
import { BasemapPluginIcon } from '@hierarchidb/basemap-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Public` |
| Emoji | 🌍 |
| カラー | `#b0b3d9` |

## Worker 層

basemap-plugin は peer store を通じて `mapStyle` と `viewport` を Worker 側に同期する。Worker の `preload` 設定として `registerBasemapWorkerStores` が登録されている。

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerBasemapWorkerStores'],
}
```

### EntityHandler

`BaseMapEntityHandler` は `BaseEntityHandler` を拡張し、以下の処理を行う:

- エンティティの正規化とバリデーション
- 変更を peer store にミラーリング（Worker コンシューマが同じ `mapStyle`/`viewport` を受信）

### ライフサイクル

ベースマップの CRUD 操作は TreeNode API + Dexie データベースを通じて行われる:

- **作成**: TreeNode 作成 + Dexie に BaseMapEntity を永続化
- **更新**: TreeNodeUpdater を通じた mapStyle/viewport の更新 + peer store 同期
- **削除**: TreeNode 削除に連動
- **参照**: `useBaseMapEntity` フックによるエンティティ取得・キャッシュ

## データベーススキーマ

### Dexie データベース

| 項目 | 値 |
| --- | --- |
| データベース名 | `basemap-db` |
| テーブル | `baseMaps`, `workingCopies` |
| インデックス | `id`, `nodeId`, `createdAt`, `updatedAt` |

### エンティティモデル

```typescript
interface BaseMapEntity extends PeerEntity<BaseMapEntityPayload> {
  id: NodeId;
  mapStyle: MapStyle;
  viewport: MapViewport;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface MapStyle {
  style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  customStyleUrl?: string;
  customStyleConfig?: Record<string, unknown>;
}

interface MapViewport {
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  bearing: number;
  pitch: number;
}
```

ツリーノードのメタデータ（name, description, tags 等）はベースマップドキュメントに複製されない。階層的なコンテキストは親の folder ノードが管理する。

### Peer Store

```typescript
type BasemapPeerData = {
  schemaVersion: 1;
};
```

peer store は `{ schemaVersion: 1, presentation: { style, viewport } }` のみを保持し、Worker ペイロードを小さく決定的に保つ。

## 依存プラグイン

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

basemap-plugin は folder-plugin に依存する。folder-plugin のコンテナ機能（子ノード管理、名前/説明の管理）を継承し、地図スタイル・ビューポートの管理機能を追加する。

## 設定項目

### Capabilities

```typescript
capabilities: {
  canHaveChildren: true,   // child nodes allowed
  canBeRoot: false,        // cannot be a root node
  canBeDeleted: true,
  canBeRenamed: true,
  canBeMoved: true,
  canBeCopied: true,
}
```

### Schema

```typescript
schema: {
  inherits: 'folder',
  fields: [
    { name: 'mapStyle', type: 'object', required: true },
    { name: 'viewport', type: 'object', required: true },
  ],
}
```

### バリデーション定数

| 定数 | 値 | 説明 |
| --- | --- | --- |
| `LONGITUDE_MIN` / `LONGITUDE_MAX` | -180 / 180 | 経度の範囲 |
| `LATITUDE_MIN` / `LATITUDE_MAX` | -90 / 90 | 緯度の範囲 |
| `ZOOM_MIN` / `ZOOM_MAX` | 0 / 24 | ズームレベルの範囲 |
| `BEARING_MIN` / `BEARING_MAX` | 0 / 360 | 方位の範囲 |
| `PITCH_MIN` / `PITCH_MAX` | 0 / 60 | ピッチの範囲 |

### デフォルトビューポート

```typescript
const DEFAULT_VIEWPORT: MapViewport = {
  center: [139.6917, 35.6895], // Tokyo
  zoom: 10,
  bearing: 0,
  pitch: 0,
};
```

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `basemap-plugin` |
| ロケール | `en`, `ja` |

## Map プレビュー

basemap-plugin は MapLibre GL JS を利用した地図プレビュー機能を提供する。

### 組み込みスタイルプリセット

| プリセット | プロバイダ / URL | 備考 |
| --- | --- | --- |
| `streets` | CARTO Voyager (`basemaps.cartocdn.com`) | デフォルト。無料 |
| `satellite` | MapLibre Demo Tiles (`demotiles.maplibre.org`) | デモ用衛星タイル（API キー不要） |
| `terrain` | CARTO Voyager | 地形表示用に Voyager を再利用 |
| `dark` | CARTO Dark Matter | ダークテーマ |
| `light` | CARTO Positron | ライトテーマ |
| `custom` | ユーザー指定 | `customStyleUrl` または `customStyleConfig` が必要 |

プレミアムプロバイダ（Mapbox、MapTiler 等）は参考として定義されているが、現時点では直接接続されていない。利用者は `customStyleUrl` を通じて独自のスタイルを注入できる。

### BaseMapDisplay

`BaseMapDisplay` は MapLibre を使用したフル機能の地図ビューアコンポーネント。永続化されたスタイルとビューポートを描画し、インタラクティブな操作（ドラッグ、ズーム、回転）をサポートする。

```tsx
import { BaseMapDisplay } from '@hierarchidb/basemap-plugin/ui';

<BaseMapDisplay
  nodeId={nodeId}
  width="100%"
  height={420}
  interactive={true}
  onLoad={(map) => console.log('Map loaded', map)}
  onViewStateChange={(vs) => console.log('View changed', vs)}
/>
```

### BaseMapPreview

`BaseMapPreview` は軽量なプレビューカードコンポーネント。ダイアログやサマリー表示で使用され、スタイルアイコン・座標情報・アトリビューションをオーバーレイ表示する。

```tsx
import { BaseMapPreview } from '@hierarchidb/basemap-plugin/ui';

<BaseMapPreview
  mapStyle={{ style: 'streets' }}
  viewport={{ center: [139.6917, 35.6895], zoom: 10, bearing: 0, pitch: 0 }}
  height={240}
  showMetadata={true}
  interactive={false}
/>
```

非インタラクティブモードではクリック時に別タブで地図ビューが開く。

### ViewportStep（ダイアログ内プレビュー）

ダイアログのステップ 3 では、インタラクティブな MapLibre 地図が埋め込まれ、ユーザーはドラッグ・ホイール・ダブルクリックでビューポートを調整できる。数値入力フィールドと地図は双方向に同期する。

## 使用例

### PluginManifest の参照

```typescript
import { BaseMapPluginManifest } from '@hierarchidb/basemap-plugin';

console.log(BaseMapPluginManifest.nodeType); // 'basemap'
console.log(BaseMapPluginManifest.capabilities.canHaveChildren); // true
console.log(BaseMapPluginManifest.extends); // 'folder'
```

### カスタムスタイルの設定

```typescript
// Using a custom style URL
const mapStyle = {
  style: 'custom' as const,
  customStyleUrl: 'https://example.com/styles/city-night.json',
};

// Using an inline MapLibre style config
const inlineStyle = {
  style: 'custom' as const,
  customStyleConfig: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  },
};
```

### useBaseMapEntity フックの使用

```typescript
import { useBaseMapEntity } from '@hierarchidb/basemap-plugin/ui';

function BasemapEditor({ nodeId }: { nodeId: NodeId }) {
  const { entity, loading, error, refetch, updateEntity } = useBaseMapEntity(nodeId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!entity) return <div>No basemap configured</div>;

  return (
    <div>
      <p>Style: {entity.mapStyle.style}</p>
      <p>Center: {entity.viewport.center.join(', ')}</p>
      <p>Zoom: {entity.viewport.zoom}</p>
    </div>
  );
}
```

### ビューポートバリデーション

```typescript
import { validateViewport, formatCoordinates } from '@hierarchidb/basemap-plugin';

const viewport = { center: [139.6917, 35.6895], zoom: 10, bearing: 0, pitch: 0 };
const isValid = validateViewport(viewport); // true

const formatted = formatCoordinates(139.6917, 35.6895); // '139.6917, 35.6895'
```

## ディレクトリ構成

```text
src/
├── index.ts                          # Root entry point (types + manifest + constants)
├── plugin-manifest.ts                # PluginManifest definition
├── common/
│   ├── constants/
│   │   ├── builtInStyles.ts          # Built-in MapLibre style definitions and URLs
│   │   └── constants.ts              # Validation limits, default viewport, style presets
│   ├── shared/
│   │   ├── BaseMapPluginManifest.ts  # Re-export of plugin manifest
│   │   ├── viewportValidation.ts     # Viewport validation utilities
│   │   └── index.ts                  # Shared exports
│   └── types/
│       ├── BASEMAP_CATEGORIES.ts     # Basemap category type definitions
│       ├── BaseMapEntity.ts          # Entity, draft, search criteria, peer data types
│       ├── types.ts                  # MapViewport, BaseMapStylePreset, BaseMapConfig
│       └── index.ts                  # Type exports
├── icon/
│   └── index.ts                      # BasemapPluginIcon (re-export of MUI Public)
└── ui/
    ├── i18n.ts                       # i18n resource registration (en, ja)
    ├── index.ts                      # UI entry point
    ├── components/
    │   ├── BaseMapDisplay.tsx         # Full MapLibre map viewer component
    │   ├── BaseMapPreview.tsx         # Lightweight preview card component
    │   ├── getBasemapStepConfigs.tsx  # Step configuration factory
    │   ├── steps-provider.tsx         # PluginStepRegistry registration
    │   ├── useBaseMapDisplay.ts       # Hook for BaseMapDisplay
    │   ├── useBaseMapPreview.ts       # Hook for BaseMapPreview
    │   ├── index.ts                   # Component exports
    │   └── steps/
    │       ├── MapStyleStep.tsx       # Map style selection step
    │       ├── ViewportStep.tsx       # Viewport configuration step with map
    │       ├── useViewportStep.ts     # Hook for ViewportStep
    │       └── index.ts              # Step exports
    ├── hooks/
    │   ├── useBaseMapEntity.ts        # Entity fetch/update/validation hooks
    │   ├── useMapStyleStep.ts         # Map style step logic hook
    │   └── index.ts                   # Hook exports
    ├── locales/
    │   ├── en.json                    # English locale
    │   └── ja.json                    # Japanese locale
    └── utils/
        └── mapStyle.ts               # Style URL resolution utilities
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/basemap-plugin` | 型定義、PluginManifest、定数、バリデーションユーティリティ |
| `@hierarchidb/basemap-plugin/ui` | UI コンポーネント（BaseMapDisplay、BaseMapPreview、ステップ登録、フック） |
| `@hierarchidb/basemap-plugin/icon` | BasemapPluginIcon |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../packages/core-types/) — NodeId、NodeType 等の共有型定義
- [`@hierarchidb/tree-api`](../packages/tree-api/) — TreeNode、TreeNodeUpdater 型定義
- [`@hierarchidb/folder-plugin`](../plugins/folder-plugin/) — 親プラグイン（コンテナ機能）
- [`@hierarchidb/plugin-ui-sdk`](../packages/plugin-ui-sdk/) — プラグイン UI SDK（useTreeNodeUpdater 等）
- [`@hierarchidb/plugin-service-api`](../packages/plugin-service-api/) — プラグインサービス API
- [`@hierarchidb/ui-plugin-basic-info`](../packages/ui/plugin-basic-info/) — プラグイン基本情報ステップ
- [`@hierarchidb/ui-map`](../packages/ui/map/) — MapLibre 地図コンポーネント基盤
- [`@hierarchidb/ui-i18n`](../packages/ui/i18n/) — 国際化基盤
- [`@hierarchidb/ui-worker-provider`](../packages/ui/worker-provider/) — Worker クライアントプロバイダ
- [`@hierarchidb/runtime-worker`](../packages/runtime-worker/) — Worker ランタイム
- [`@hierarchidb/util`](../packages/util/) — ユーティリティ

### basemap-plugin を利用するプラグイン

basemap-plugin が設定するベースマップスタイル・ビューポートは、以下のプラグインが地図描画時に参照する:

- [`shape-plugin`](../plugins/shape-plugin/) — 形状データの地図表示
- [`location-plugin`](../plugins/location-plugin/) — 位置エンティティの地図表示
- [`route-plugin`](../plugins/route-plugin/) — 経路の地図表示

## ライセンス

MIT
