# @hierarchidb/spreadsheet-plugin

最終更新: 2026-04-05

共有タブラー取り込みスタック上に構築された次世代スプレッドシートプラグイン。CSV/TSV/Excel ファイルのアップロードおよび URL ダウンロードによる表形式データの取り込み・フィルタリング・管理を提供する。

## ノードタイプと継承関係

| 項目 | 値 |
| --- | --- |
| nodeType | `spreadsheet` |
| extends | `folder` |
| category | `data` / `tabular` |
| priority | `600` |

spreadsheet-plugin は folder-plugin を継承し、フォルダの基本機能（名前・説明・タグ等）に加えて、表形式データソースの管理機能を提供する。スキーマは folder のフィールドを継承しつつ、`spreadsheetMetadataId`、`dataSource`、`filters` を追加する。

## UI 層

### ダイアログステップ

spreadsheet-plugin の UI は `PluginStepRegistry` ベースのステップ登録方式を採用している。`src/ui/components/steps-provider.tsx` で以下の 2 ステップを登録する:

1. **Data Source** — ローカルファイルアップロードまたは URL ダウンロードによるデータ取り込み
2. **Filtering** — 取り込んだ表データに対するフィルタルール設定（任意ステップ）

> 基本情報（name/description/tags）は `@hierarchidb/ui-plugin-basic-info` が提供するため、spreadsheet-plugin 自体には含まれない。

### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| `TabularDataSourceStep` | ファイルアップロード / URL ダウンロード切替 + 処理オプション設定 |
| `TabularDataFilterStep` | フィルタルール設定 + プレビュー表示 |
| `ValueHistogram` | 値分布のヒストグラム表示 |
| `KeyValueSourcePanel` | キー・バリュー列選択パネル |
| `TabularFilterSections` | フィルタセクション UI |
| `TabularKeyValuePanels` | キー・バリューペア統計パネル |

### アイコン

```typescript
// Entry point: @hierarchidb/spreadsheet-plugin/icon
import { SpreadsheetPluginIcon } from '@hierarchidb/spreadsheet-plugin/icon';
```

| 項目 | 値 |
| --- | --- |
| MUI アイコン | `Assessment` |
| Emoji | 📈 |
| カラー | `#dcbc50` |

## Worker 層

spreadsheet-plugin の Worker 層は最小限の設計を採用している。`registerSpreadsheetWorkerStores` が `preload` として登録されるが、現在の実装では実質的な処理は行わない（PeerStore は廃止済み）。

```typescript
// plugin-manifest.ts
worker: {
  preload: ['registerSpreadsheetWorkerStores'],
}
```

表データの取り込み・永続化は Worker 経由ではなく、サービス層（`SpreadsheetTabularApiDriver`）がメインスレッドで直接処理する。

### データ取り込みフロー

1. ファイルアップロードまたは URL ダウンロードでデータを取得
2. `TabularService`（`@hierarchidb/tabular-source`）でパース
3. `SpreadsheetStorePort` 経由で `TabularWriter`（`@hierarchidb/tabular-store`）に書き込み
4. 行データは共有 `RowStoreDB` にチャンク単位で永続化
5. メタデータは `SpreadsheetMetadataManager` で管理

## データベーススキーマ

spreadsheet-plugin は専用の Dexie データベースを持たず、共有タブラーストアを利用する。

### メタデータストア

`SpreadsheetMetadataManager` は `TabularDatabaseManager` を継承し、DB 名 `spreadsheet-metadata` でメタデータを管理する。

```typescript
// SpreadsheetMetadataManager extends TabularDatabaseManager
const manager = new SpreadsheetMetadataManager();
// DB name: 'spreadsheet-metadata' (via getDBName)
```

### 行データストア

行データは `@hierarchidb/tabular-store` の共有 `RowStoreDB` に格納される。複合インデックス `[pluginId+tableId]` でプラグインごとのデータを分離する。

### エンティティ構造

```typescript
// SpreadsheetEntity (re-exported from @hierarchidb/spreadsheet-store)
interface SpreadsheetEntity {
  spreadsheetMetadataId?: string;
  dataSource?: {
    type: 'file' | 'url';
    source?: string;
    filename?: string;
    sizeBytes?: number;
    contentHash?: string;
  };
  tabularTableMetadata?: TabularTableMetadata;
  tabularProcessingConfig?: TabularProcessingConfig;
  file?: {
    name: string;
    sizeBytes: number;
    type?: string;
    lastModifiedAt?: number;
  };
  filters?: TabularFilterRule[];
  lastPreview?: TabularDataResult;
}
```

### データソースタイプ

```typescript
const DATA_SOURCE_TYPES = {
  FILE: 'file',  // local file upload
  URL: 'url',    // remote URL download
} as const;
```

## 依存プラグイン

```typescript
// PluginManifest.dependencies
dependencies: ['folder']
```

spreadsheet-plugin は folder-plugin に依存する。folder のノードタイプを継承し、ツリー構造内のコンテナ機能を基盤として利用する。

## 設定項目

### Capabilities

```typescript
capabilities: {
  canHaveChildren: false,  // no child nodes
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
    { name: 'spreadsheetMetadataId', type: 'string', required: false },
    { name: 'dataSource', type: 'object', required: false },
    { name: 'filters', type: 'array', required: false },
  ],
}
```

### i18n

| 項目 | 値 |
| --- | --- |
| namespace | `spreadsheet-plugin` |
| ロケール | `en`, `ja` |

## サービス層

spreadsheet-plugin は `TabularDataApi` インターフェースを実装するサービス層を提供する。

### SpreadsheetTabularApiDriver

`TabularDataApi` の主要実装。ファイルアップロード、URL ダウンロード、フィルタリング、テーブル管理を提供する。

| メソッド | 説明 |
| --- | --- |
| `uploadTabularFile` | ファイルをパースして共有ストアに取り込む |
| `downloadTabularFromUrl` | URL からデータをダウンロードして取り込む |
| `getFilteredPreview` | フィルタ適用済みプレビューデータを取得 |
| `getFilteredData` | フィルタ適用済み全データを取得 |
| `listTables` | 登録済みテーブル一覧を取得 |
| `deleteTable` | テーブルとその行データを削除 |
| `addTableReference` | テーブルへのプラグイン参照を追加 |
| `removeTableReference` | テーブルへのプラグイン参照を削除 |

### SpreadsheetStorePort

`TabularStorePort` の実装。取り込みセッションの管理（開始・チャンク書き込み・コミット・中断）を担当する。列の型推論（number/boolean/date/string）も行う。

### ファクトリ関数

```typescript
// Create a standard spreadsheet API driver
const api = createSpreadsheetTabularApi('my-plugin-id');

// Create a plugin-specific driver with CORS proxy support
const api = createPluginTabularApi({
  pluginId: 'my-plugin',
  metadataManager: myManager,
  enableCorsProxy: true,
});
```

## 使用例

### PluginManifest の参照

```typescript
import { SpreadsheetPluginManifest } from '@hierarchidb/spreadsheet-plugin';

console.log(SpreadsheetPluginManifest.nodeType); // 'spreadsheet'
console.log(SpreadsheetPluginManifest.extends);   // 'folder'
console.log(SpreadsheetPluginManifest.dependencies); // ['folder']
```

### CSV ファイルのアップロード

```typescript
import { createSpreadsheetTabularApi } from '@hierarchidb/spreadsheet-plugin';

const api = createSpreadsheetTabularApi();
const file = new File(['name,age\nAlice,30\nBob,25'], 'data.csv', {
  type: 'text/csv',
});

const metadata = await api.uploadTabularFile(file, {
  delimiter: ',',
  hasHeader: true,
});
console.log('Table ID:', metadata.id);
console.log('Total rows:', metadata.totalRows);
```

### URL からのデータダウンロード

```typescript
import { createSpreadsheetTabularApi } from '@hierarchidb/spreadsheet-plugin';

const api = createSpreadsheetTabularApi();
const metadata = await api.downloadTabularFromUrl(
  'https://example.com/data.csv',
  { delimiter: ',', hasHeader: true },
);
console.log('Downloaded table:', metadata.filename);
```

### フィルタ付きデータ取得

```typescript
import { createSpreadsheetTabularApi } from '@hierarchidb/spreadsheet-plugin';

const api = createSpreadsheetTabularApi();
const result = await api.getFilteredPreview(tableId, [
  { column: 'age', operator: 'greater_than', value: 20, enabled: true },
], 100);
console.log('Filtered rows:', result.rows.length);
console.log('Total matches:', result.totalRows);
```

### UI ステップコンポーネントの利用

```tsx
import { TabularDataSourceStep, TabularDataFilterStep } from '@hierarchidb/spreadsheet-plugin/ui';

// Embed the data source step in a custom dialog
<TabularDataSourceStep
  data={draftData}
  onDataChange={handleDataChange}
/>

// Embed the filter step
<TabularDataFilterStep
  data={draftData}
  onDataChange={handleDataChange}
  translationNamespace="spreadsheet-plugin"
/>
```

## ディレクトリ構成

```text
src/
├── index.ts                  # Root entry point (types + manifest + services)
├── plugin-manifest.ts        # PluginManifest definition
├── common/
│   ├── constants.ts          # DATA_SOURCE_TYPES, STEP_LABELS
│   └── types/
│       └── SpreadsheetEntity.ts  # Entity type re-exports from spreadsheet-store
├── icon/
│   └── index.ts              # SpreadsheetPluginIcon (MUI Assessment)
├── services/
│   ├── index.ts              # Service exports
│   ├── SpreadsheetTabularApiDriver.ts  # TabularDataApi implementation
│   ├── SpreadsheetMetadataManager.ts   # Metadata DB manager
│   ├── SpreadsheetStorePort.ts         # TabularStorePort implementation
│   ├── spreadsheetTabularApiFactory.ts # Factory functions
│   └── utils/
│       ├── filtering.ts      # Filter matching logic
│       └── hash.ts           # File content hashing
├── ui/
│   ├── index.ts              # UI entry point
│   ├── i18n.ts               # i18n resource loading
│   ├── locales/              # i18n resources (en, ja)
│   ├── components/
│   │   ├── steps-provider.tsx          # PluginStepRegistry registration
│   │   ├── steps/
│   │   │   ├── TabularDataSourceStep.tsx   # Data source step
│   │   │   ├── TabularDataFilterStep.tsx   # Filter step
│   │   │   └── useTabularDataFilterStepView.ts
│   │   ├── KeyValueSourcePanel.tsx
│   │   ├── TabularFilterSections.tsx
│   │   ├── TabularKeyValuePanels.tsx
│   │   ├── ValueHistogram.tsx
│   │   └── useValueHistogram.ts
│   ├── hooks/
│   │   ├── useTabularDataFilter.ts
│   │   ├── useTabularDataFilterStep.ts
│   │   ├── useTabularDataSource.ts
│   │   └── useTabularKeyValueState.ts
│   └── state/
│       ├── tabularKeyValueAtoms.ts     # Jotai atoms for key-value state
│       └── tabularStatisticsUtils.ts   # Statistics calculation utilities
└── worker/
    ├── index.ts              # Worker entry point
    └── factory/
        └── registerSpreadsheetWorkerStores.ts  # Worker store registration (no-op)
```

## エクスポートエントリポイント

| パス | 内容 |
| --- | --- |
| `@hierarchidb/spreadsheet-plugin` | 型定義、PluginManifest、サービス層、定数 |
| `@hierarchidb/spreadsheet-plugin/ui` | UI コンポーネント（ステップ登録、データソース、フィルタ） |
| `@hierarchidb/spreadsheet-plugin/icon` | SpreadsheetPluginIcon |
| `@hierarchidb/spreadsheet-plugin/worker` | Worker ストア登録 |

## 関連プラグイン・パッケージ

### 依存パッケージ

- [`@hierarchidb/plugin-base`](../../packages/plugin-base/) — プラグイン基盤（PluginManifest、PluginStepRegistry）
- [`@hierarchidb/core-types`](../../packages/core-types/) — NodeId、NodeType 等の共有型定義
- [`@hierarchidb/tabular-source`](../../packages/tabular-source/) — 表形式データのパース・取り込みサービス
- [`@hierarchidb/tabular-store`](../../packages/tabular-store/) — 表形式データの永続化（TabularWriter、RowStoreDB）
- [`@hierarchidb/spreadsheet-store`](../../packages/spreadsheet-store/) — SpreadsheetEntity 型定義
- [`@hierarchidb/chunk-store`](../../packages/chunk-store/) — チャンクベースのデータストア
- [`@hierarchidb/download`](../../packages/download/) — ネットワークダウンロード（FetchNetworkPort）
- [`@hierarchidb/auth-api`](../../packages/auth-api/) — 認証スコープ定義
- [`@hierarchidb/util`](../../packages/util/) — ユーティリティ（getDBName 等）
- [`@hierarchidb/plugin-ui-sdk`](../../packages/plugin-ui-sdk/) — プラグイン UI SDK
- [`@hierarchidb/plugin-service-api`](../../packages/plugin-service-api/) — プラグインサービス API
- [`@hierarchidb/runtime-worker`](../../packages/runtime-worker/) — Worker ランタイム
- [`@hierarchidb/ui-tabular`](../../packages/ui/tabular-extract/) — 表形式データ UI（TabularDataApi 型定義）
- [`@hierarchidb/ui-dialog`](../../packages/ui/dialog/) — ダイアログ基盤
- [`@hierarchidb/ui-modal-select`](../../packages/ui/modal-select/) — モーダル選択 UI
- [`@hierarchidb/ui-plugin-basic-info`](../../packages/ui/plugin-basic-info/) — プラグイン基本情報ステップ
- [`@hierarchidb/ui-worker-provider`](../../packages/ui/worker-provider/) — Worker プロバイダ
- [`@hierarchidb/ui-i18n`](../../packages/ui/i18n/) — 国際化

### 親プラグイン

- [`folder-plugin`](../folder-plugin/) — 基盤コンテナノード（spreadsheet が継承）

### spreadsheet-plugin を継承するプラグイン

- [`styler-plugin`](../styler-plugin/) — スタイル定義・Map スタイル適用（spreadsheet のデータソース機能を再利用）

## ライセンス

MIT
