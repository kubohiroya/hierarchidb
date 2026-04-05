# @hierarchidb/styler-plugin

最終更新: 2026-04-05

スプレッドシートデータに基づくデータ駆動スタイリングと地図可視化を提供するプラグイン。CSV/Excel 等のデータを取り込み、フィルタリング・マッピングキー設定・色分類アルゴリズム選択を経て、MapLibre スタイルを生成する。spreadsheet-plugin を継承し、データ取り込み・保存は親プラグインに委譲しつつ、スタイル生成・可視化に特化した機能を実装している。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `styler` |
| extends | `spreadsheet` |
| category | `visualization` |
| priority | `700` |

styler-plugin は spreadsheet-plugin を継承する。spreadsheet-plugin はさらに folder-plugin を継承しているため、継承チェーンは `folder → spreadsheet → styler` となる。データの読み込み・チャンク保存は spreadsheet-plugin の `SpreadsheetTabularApiDriver` / `SpreadsheetStorePort` に委譲し、styler-plugin はスタイル定義・色マッピング・MapLibre スタイル生成に専念する。

## UI 層

### ダイアログ

styler-plugin の UI は `PluginStepRegistry` ベースのステップ登録方式を採用している。`steps-provider.tsx` で `styler` nodeType に対して 6 ステップの作成/編集ウィザードを登録する:

1. **Data Source** — データソースの選択（ファイルアップロードまたは URL 指定）。spreadsheet-plugin の `TabularDataSourceStep` を再利用
2. **Filtering** — 取り込んだデータに対するフィルタリングルールの設定
3. **Mapping Keys** — キー列・値列・Feature ID プロパティの指定
4. **Apply Target** — スタイルタイプ（choropleth/points/lines）、ターゲットプロパティ、値タイプ、マッピングモードの設定
5. **Palette** — 色分類アルゴリズム（linear/quantile/jenks/equal）の選択とパラメータ調整
6. **Preview** — スタイル適用結果のプレビューと最終確認

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `StylerFilterStep` | データフィルタリング UI |
| `StylerMappingKeysStep` | キー列・値列マッピング設定 |
| `StylerTargetStep` | スタイルターゲット設定（styleType、targetProperty） |
| `StylerAlgorithmStep2` | 色分類アルゴリズム選択・パラメータ調整 |
| `StylerPreviewStep` | スタイル適用プレビュー |
| `GradientSwatch` | カラーグラデーションのスウォッチ表示 |
| `StyleMappingTargetPanel` | マッピングターゲットパネル |

### アイコン

```typescript
// Entry point: @hierarchidb/styler-plugin/icon
import { StylerPluginIcon } from '@hierarchidb/styler-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Palette` |
| Emoji | 🎨 |
| カラー | `#dcbc50` |

## Worker 層

### StylerEntityHandler

`StylerEntityHandler` は spreadsheet-plugin の EntityHandler をラップし、スタイル固有のフィールド（`config`、`mapping`、`styleKeyValues`、`generatedStyle`）を付加する。CRUD 操作の流れ:

- **作成**: 親の `SpreadsheetEntityHandler.createEntity()` を呼び出し、返されたエンティティに Styler 固有のデフォルト値（`StylerConfigDefault`、`StylerMappingDefault`）をマージ
- **取得**: 親の `getEntity()` 結果に Styler 固有フィールドをマージして返却
- **更新**: 親の `updateEntity()` 後、マッピング設定が変更された場合は `StylerDataService.generateMapLibreStyle()` を呼び出して MapLibre スタイルを自動再生成
- **削除**: テーブル参照のクリーンアップ後、親の `deleteEntity()` を実行

### StylerDataService

`TabularDataApi` をラップし、以下の機能を提供する:

- `importTabularDataFromFile()` / `importTabularDataFromUrl()` — ファイルまたは URL からの表データ取り込みと初期 Styler 設定の自動生成
- `getStyledPreview()` — フィルタ適用済みデータに色スタイルを付与したプレビュー取得
- `generateMapLibreStyle()` — エンティティ設定に基づく MapLibre スタイル仕様の生成
- `addTableReference()` / `removeTableReference()` — テーブル参照の管理
- `listStylerTables()` — Styler が参照するテーブル一覧の取得

### StylerExtensionHandler

フォルダ拡張データとして Styler 設定を管理するハンドラ。`onCreate` / `onUpdate` / `onDelete` ライフサイクルフックを提供し、設定のバリデーション・保存・クリーンアップを行う。

### Worker preload

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerStylerWorkerStores'],
}
```

## データベーススキーマ

### StylerDB（Dexie）

`@hierarchidb/styler-store` が提供する `StylerDB` クラスが Dexie データベースを管理する。

```typescript
// Database name: getDBName('style')
// Version: 1
this.version(1).stores({
  styles: '&nodeId, targetProperty, updatedAt',
});
```

| テーブル | プライマリキー | インデックス | 説明 |
| --- | --- | --- | --- |
| `styles` | `nodeId` (unique) | `targetProperty`, `updatedAt` | スタイルレコード（`StyleRecord`） |

### StyleRecord 構造

```typescript
interface StyleRecord {
  nodeId: NodeId;
  keyColumn: string;
  valueColumn: string;
  targetProperty: string;
  styleType: StyleType;           // 'choropleth' | 'points' | 'lines'
  valueType: StyleValueType;      // 'color' | 'number'
  paintExpression: unknown;       // MapLibre paint expression
  colorMapping?: Record<string, string>;
  updatedAt: number;
  keyValues?: StyleKeyValueEntry[];
}
```

### StylerMetadataManager

`TabularDatabaseManager` を継承し、`getDBName('styler')` で表データメタデータを管理する。spreadsheet-plugin と同じチャンクベースの表データ保存基盤を利用する。

## 依存プラグイン

```typescript
// PluginManifest.dependencies
dependencies: ['@hierarchidb/spreadsheet-plugin']
```

styler-plugin は spreadsheet-plugin に依存する。spreadsheet-plugin が提供するデータ取り込み・チャンク保存・表データ管理の機能を継承し、スタイル生成機能を追加する。

## 設定項目

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,  // child nodes not allowed
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
    { name: 'csvData', type: 'string', required: true },
    { name: 'mappingConfig', type: 'object', required: true },
  ],
}
```

### スタイルマップカテゴリ

styler-plugin は以下のスタイルマップカテゴリをサポートする:

| カテゴリ | 説明 |
| --- | --- |
| `choropleth` | データ値に基づく色分け地図 |
| `symbol` | データを表すポイントシンボル |
| `heatmap` | カラーグラデーションによる密度可視化 |
| `cluster` | グループ化されたポイント可視化 |
| `graduated` | データ値でスケーリングされたシンボル |
| `categorized` | カテゴリ別の異なるスタイル |
| `terrain` | 地形・標高データ |
| `network` | 接続された線とノード |
| `flow` | 移動・フロー可視化 |
| `custom` | ユーザー定義スタイル |

### 色分類アルゴリズム

| アルゴリズム | 説明 |
| --- | --- |
| `linear` | 線形補間による連続的な色マッピング |
| `quantile` | 分位数に基づく分類（データの偏りに強い） |
| `jenks` | 自然分類（Jenks Natural Breaks）によるクラスタリング |
| `equal` | 等間隔分類 |

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `styler-plugin` |
| ロケール | `en`, `ja`（glob import による動的登録） |

## Map プレビュー

styler-plugin は MapLibre スタイル仕様を生成し、地図上でのデータ可視化をサポートする。`StylerDataService.generateMapLibreStyle()` が以下の処理を行う:

1. エンティティの `mapping` 設定からレイヤータイプ（`fill` / `line` / `circle`）を決定
2. `valueType` と `mappingMode` に応じて paint expression を構築
3. 数値→色の補間が必要な場合、データから値を取得して `valueToColor()` で色マッピングを生成
4. MapLibre Style Specification 準拠のスタイルオブジェクトを返却

生成されたスタイルは `StylerDB.styles` テーブルに永続化され、basemap-plugin 等の地図レイヤーとして適用できる。

## 使用例

### PluginManifest の参照

```typescript
import { StylerPluginManifest } from '@hierarchidb/styler-plugin';

console.log(StylerPluginManifest.nodeType);  // 'styler'
console.log(StylerPluginManifest.extends);   // 'spreadsheet'
console.log(StylerPluginManifest.capabilities.canHaveChildren); // false
```

### StylerPluginIcon の使用

```tsx
import { StylerPluginIcon } from '@hierarchidb/styler-plugin/icon';

<StylerPluginIcon />
```

### StylerEntityHandler の使用

```typescript
import { StylerEntityHandler, StylerDataService } from '@hierarchidb/styler-plugin';

// Create handler with spreadsheet base handler and data service
const handler = new StylerEntityHandler(spreadsheetHandler, dataService);

// Create a new styler entity
const result = await handler.createEntity(nodeId, {
  keyColumn: 'region_id',
  valueColumn: 'population',
  config: {
    algorithm: 'linear',
    colorSpace: 'hsv',
    min: 0,
    max: 100,
    outputMin: 1,
    outputMax: 8,
    hueStart: 0,
    hueEnd: 120,
    saturation: 0.8,
    brightness: 0.9,
  },
});
```

### 色ユーティリティの使用

```typescript
import {
  valueToColor,
  hexToRgb,
  rgbToHex,
  generateColorGradient,
  createColorVariations,
} from '@hierarchidb/styler-plugin';

// Convert a data value to a color based on mapping and config
const colorResult = valueToColor(75, mapping, config);
console.log(colorResult.color); // '#rrggbb'

// Generate a color gradient
const gradient = generateColorGradient(10, config);
```

## ディレクトリ構成

```text
src/
├── index.ts                  # Root entry point (types, manifest, handler, utilities)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── __tests__/            # Unit / integration tests
│   ├── extension/
│   │   └── StylerExtensionHandler.ts  # Folder extension handler
│   ├── handlers/
│   │   └── StylerEntityHandler.ts     # Entity CRUD handler
│   ├── types/
│   │   ├── STYLEMAP_CATEGORY_CONFIGS.ts  # Style map category definitions
│   │   ├── StylerEntity.ts               # Re-export from @hierarchidb/styler-store
│   │   └── StylerMetadata.ts             # Plugin metadata
│   └── utils/
│       ├── colorUtils.ts     # Color conversion, classification algorithms
│       ├── dataAnalysis.ts   # Data statistics and algorithm recommendation
│       └── detectFileType.ts # File type detection
├── icon/
│   └── index.ts              # StylerPluginIcon (re-export of MUI Palette)
├── services/
│   ├── index.ts              # Service exports
│   ├── StylerDataService.ts  # Data import, preview, MapLibre style generation
│   └── StylerMetadataManager.ts  # Tabular metadata manager
└── ui/
    ├── i18n.ts               # i18n resource registration
    ├── index.ts              # UI entry point (step registration)
    ├── components/
    │   ├── steps-provider.tsx          # PluginStepRegistry registration (6 steps)
    │   ├── StylerFilterStep.tsx        # Filtering step
    │   ├── StylerMappingKeysStep.tsx   # Mapping keys step
    │   ├── StylerTargetStep.tsx        # Target property step
    │   ├── StylerAlgorithmStep2.tsx    # Algorithm selection step
    │   ├── StylerPreviewStep.tsx       # Preview step
    │   ├── GradientSwatch.tsx          # Gradient swatch component
    │   ├── StyleMappingTargetPanel.tsx # Mapping target panel
    │   └── hooks/                      # Component-specific hooks
    ├── hooks/
    │   └── useTabularFilterWorker.ts   # Web Worker for tabular filtering
    ├── utils/
    │   └── tabularFilters.ts           # Filter utility functions
    └── workers/
        └── tabularFilter.worker.ts     # Tabular filter Web Worker
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/styler-plugin` | 型定義、PluginManifest、EntityHandler、DataService、色ユーティリティ |
| `@hierarchidb/styler-plugin/ui` | UI コンポーネント（ステップ登録、i18n） |
| `@hierarchidb/styler-plugin/icon` | StylerPluginIcon |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../../packages/core-types/) — NodeId、NodeType 等の共有型定義
- [`@hierarchidb/styler-store`](../../packages/styler-store/) — StylerDB、StylerEntity 型定義
- [`@hierarchidb/style-api`](../../packages/style-api/) — StyleRecord、StyleDescriptor 型定義
- [`@hierarchidb/spreadsheet-store`](../../packages/spreadsheet-store/) — スプレッドシートデータストア
- [`@hierarchidb/tabular-store`](../../packages/tabular-store/) — 表データストア・メタデータ管理
- [`@hierarchidb/plugin-ui-sdk`](../../packages/plugin-ui-sdk/) — プラグイン UI SDK
- [`@hierarchidb/ui-dialog`](../../packages/ui/dialog/) — ダイアログ基盤
- [`@hierarchidb/ui-map`](../../packages/ui/map/) — MapLibreStyle 型定義
- `@hierarchidb/ui-tabular` — TabularDataApi、フィルタリング型
- `@hierarchidb/ui-grid` — データグリッド UI
- [`@hierarchidb/ui-i18n`](../../packages/ui/i18n/) — 国際化基盤
- [`@hierarchidb/util`](../../packages/util/) — ユーティリティ（getDBName、SingletonMixin 等）

### 親プラグイン

- [`spreadsheet-plugin`](../spreadsheet-plugin/) — データ取り込み・チャンク保存・表データ管理（直接の親）
- [`folder-plugin`](../folder-plugin/) — ツリーコンテナ基盤（継承チェーンのルート）

### 関連プラグイン

- [`basemap-plugin`](../basemap-plugin/) — 生成された MapLibre スタイルの地図レイヤーとしての適用先

## ライセンス

MIT
