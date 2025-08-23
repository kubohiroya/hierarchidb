# Spreadsheet Plugin Documentation

## 概要

Spreadsheet Pluginは、HierarchiDBにおける汎用的な表データ処理プラグインです。大容量のCSVやExcelファイルを効率的に処理し、他のプラグイン（StyleMap、Shapes等）の基盤として機能します。

## 主要機能

### 1. データソース対応
- **ローカルファイル**: CSV, TSV, Excel (xlsx, xls), JSON
- **リモートURL**: HTTP/HTTPSからの直接読み込み
- **クリップボード**: コピー&ペーストによるデータ取り込み

### 2. データ管理
- **チャンク分割**: 大容量ファイルを100,000行単位でチャンク化
- **圧縮保存**: pako (gzip)による自動圧縮
- **ハッシュ管理**: SHA-256による重複検出
- **リファレンスカウント**: 複数ノードでの共有と自動削除

### 3. データ処理
- **フィルタリング**: 複雑な条件での行抽出
- **カラム抽出**: 特定列のみの取り出し
- **インデックス**: 高速検索のための列インデックス
- **キャッシュ**: フィルタ結果の自動キャッシュ

### 4. エクスポート
- CSV, Excel, JSON形式での出力
- フィルタ適用後のエクスポート
- 特定カラムのみのエクスポート

## アーキテクチャ

```
┌─────────────────────────────────────┐
│         Application Layer           │
├─────────────────────────────────────┤
│    StyleMap Plugin                  │
│    (Spreadsheetを利用)              │
├─────────────────────────────────────┤
│    Spreadsheet Plugin               │
│  ┌─────────────────────────────┐   │
│  │   Import/Export Manager      │   │
│  ├─────────────────────────────┤   │
│  │   Filter Engine              │   │
│  ├─────────────────────────────┤   │
│  │   Reference Manager          │   │
│  ├─────────────────────────────┤   │
│  │   Chunk Manager              │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│         Storage Layer               │
│  ┌─────────────────────────────┐   │
│  │   IndexedDB (Dexie)          │   │
│  │   - Chunks                   │   │
│  │   - Metadata                 │   │
│  │   - Indexes                  │   │
│  │   - Cache                    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## データベース構造

### 1. SpreadsheetMetadata (`spreadsheet_metadata`)
**PersistentRelationalEntity** - 共有可能なデータ本体（nodeIdは含まない）
```typescript
{
  id: SpreadsheetMetadataId,  // UUID（プライマリキー）
  contentHash: string,         // SHA-256ハッシュ（重複検出）
  columns: string[],           // カラム名リスト
  rowCount: number,            // 総行数
  columnCount: number,         // 総カラム数
  fileSize: number,            // 元ファイルサイズ
  originalFormat: string,      // 元のファイル形式
  delimiter: string,           // 区切り文字（デフォルト: '	'）
  hasHeader: boolean,          // ヘッダー行の有無
  encoding: string,            // 文字エンコーディング
  createdAt: number,           // 作成日時
  updatedAt: number,           // 更新日時
  lastAccessedAt: number       // 最終アクセス日時
}
```typescript
{
  nodeId: NodeId,           // プライマリキー
  contentHash: string,      // コンテンツのSHA-256ハッシュ
  columns: string[],        // カラム名のリスト
  rowCount: number,         // 総行数
  fileSize: number,         // 元ファイルサイズ
  delimiter: string,        // 区切り文字
  hasHeader: boolean,       // ヘッダー行の有無
  encoding: string,         // 文字エンコーディング
  createdAt: number,        // 作成日時
  updatedAt: number         // 更新日時
}
```

### 2. SpreadsheetChunks (`spreadsheet_chunks`)
**データ本体** - チャンク分割・圧縮されたデータ
```typescript
{
  id: string,                          // チャンクID
  metadataId: SpreadsheetMetadataId,  // メタデータへの参照
  chunkIndex: number,                  // チャンク番号
  compressedData: Uint8Array,         // 圧縮データ（pako）
  rowStart: number,                    // 開始行番号
  rowEnd: number,                      // 終了行番号
  sizeBytes: number,                   // 圧縮後サイズ
  firstRowPreview?: string             // デバッグ用プレビュー
}
```

### 3. フィルタキャッシュ (`filter_cache`)
```typescript
{
  id: string,               // キャッシュID
  nodeId: NodeId,           // ノードID
  filterHash: string,       // フィルタルールのハッシュ
  rules: FilterRule[],      // フィルタルール
  matchedRows: number[],    // マッチした行番号
  resultCount: number,      // 結果件数
  createdAt: number,        // 作成日時
  lastUsed: number,         // 最終使用日時
  expiresAt: number         // 有効期限
}
```

### 4. カラムインデックス (`value_index`)
```typescript
{
  nodeId: NodeId,           // ノードID
  column: string,           // カラム名
  uniqueValues: string[],   // ユニーク値のリスト
  valueToRows: Record<string, number[]>, // 値→行番号マッピング
  dataType: string,         // データ型
  stats: {                  // 統計情報
    min?: number,
    max?: number,
    mean?: number,
    nullCount: number
  },
  createdAt: number         // 作成日時
}
```

## 使用例

### 基本的な使用方法

```typescript
import { SpreadsheetPlugin } from '@hierarchidb/plugin-spreadsheet';

// プラグインの初期化
const spreadsheet = new SpreadsheetPlugin({
  maxFileSize: 500 * 1024 * 1024, // 500MB
  chunkSize: 100000,              // 100K行/チャンク
  cacheEnabled: true,              // キャッシュ有効
  autoIndex: true                  // 自動インデックス
});

// CSVファイルのインポート
const metadata = await spreadsheet.import(nodeId, {
  source: 'file',
  file: csvFile,
  hasHeaders: true,
  delimiter: '\t'
});

// フィルタリング
const result = await spreadsheet.filter(nodeId, [
  { column: 'status', operator: 'equals', value: 'active' },
  { column: 'amount', operator: 'greater_than', value: 1000 }
]);

// カラム抽出
const columns = await spreadsheet.extractColumns(nodeId, {
  columns: ['id', 'name', 'email'],
  unique: true,
  sort: 'asc',
  limit: 100
});

// エクスポート
const blob = await spreadsheet.export(nodeId, {
  format: 'excel',
  includeHeaders: true,
  filters: [
    { column: 'status', operator: 'equals', value: 'active' }
  ]
});
```

### URLからのインポート

```typescript
const metadata = await spreadsheet.import(nodeId, {
  source: 'url',
  url: 'https://example.com/data.csv',
  hasHeaders: true
});
```

### Excelファイルの処理

```typescript
const metadata = await spreadsheet.import(nodeId, {
  source: 'file',
  file: excelFile,
  sheet: 0,  // または 'Sheet1'
  hasHeaders: true
});
```

### プレビューの取得

```typescript
const preview = await spreadsheet.getPreview(nodeId, {
  rows: 100,
  applyFilters: [
    { column: 'category', operator: 'equals', value: 'electronics' }
  ]
});
```

## パフォーマンス特性

| ファイルサイズ | インポート時間 | フィルタ時間（キャッシュなし） | フィルタ時間（キャッシュあり） |
|--------------|-------------|------------------------|------------------------|
| 1 MB         | ~200ms      | ~100ms                | ~10ms                  |
| 10 MB        | ~1s         | ~500ms                | ~20ms                  |
| 100 MB       | ~5s         | ~3s                   | ~50ms                  |
| 500 MB       | ~20s        | ~10s                  | ~100ms                 |

*実際の性能はハードウェアとブラウザに依存します*

## リファレンスカウント管理

### 仕組み
1. 同一コンテンツ（SHA-256ハッシュが同じ）は一度だけ保存
2. 複数のノードが同じデータを参照可能
3. 参照カウントがゼロになると自動削除

### 例
```typescript
// Node A がCSVをインポート
await spreadsheet.import('node-a', { source: 'file', file: csvFile });
// リファレンスカウント: 1

// Node B が同じCSVをインポート（データは共有される）
await spreadsheet.import('node-b', { source: 'file', file: csvFile });
// リファレンスカウント: 2

// Node A を削除
await spreadsheet.delete('node-a');
// リファレンスカウント: 1（データはまだ保持）

// Node B を削除
await spreadsheet.delete('node-b');
// リファレンスカウント: 0（データが自動削除）
```

## フィルタ演算子

| 演算子 | 説明 | 例 |
|--------|------|-----|
| `equals` | 完全一致 | `{ column: 'status', operator: 'equals', value: 'active' }` |
| `not_equals` | 不一致 | `{ column: 'status', operator: 'not_equals', value: 'inactive' }` |
| `contains` | 部分一致 | `{ column: 'name', operator: 'contains', value: 'John' }` |
| `not_contains` | 部分不一致 | `{ column: 'name', operator: 'not_contains', value: 'Test' }` |
| `starts_with` | 前方一致 | `{ column: 'email', operator: 'starts_with', value: 'admin' }` |
| `ends_with` | 後方一致 | `{ column: 'email', operator: 'ends_with', value: '@example.com' }` |
| `regex` | 正規表現 | `{ column: 'phone', operator: 'regex', value: '^\\d{3}-\\d{4}$' }` |
| `greater_than` | より大きい | `{ column: 'age', operator: 'greater_than', value: 18 }` |
| `less_than` | より小さい | `{ column: 'price', operator: 'less_than', value: 100 }` |
| `is_null` | NULL判定 | `{ column: 'deleted_at', operator: 'is_null' }` |
| `is_not_null` | 非NULL判定 | `{ column: 'email', operator: 'is_not_null' }` |

## 制限事項

- 最大ファイルサイズ: 500MB（設定可能）
- 最大行数: 理論上無制限（メモリに依存）
- 最大カラム数: 1000
- キャッシュ有効期限: 1時間
- インデックス最大ユニーク値: 10,000

## ブラウザ互換性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

必要なAPI:
- IndexedDB
- Web Crypto API
- File API
- Fetch API

## ライセンス

MIT