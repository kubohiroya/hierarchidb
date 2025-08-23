# Spreadsheet Plugin API Reference

## SpreadsheetPlugin

メインクラスです。表データの処理に関するすべての機能を提供します。

### コンストラクタ

```typescript
new SpreadsheetPlugin(options?: SpreadsheetOptions)
```

#### SpreadsheetOptions

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `dbName` | `string` | `'SpreadsheetDB'` | IndexedDBのデータベース名 |
| `maxFileSize` | `number` | `524288000` (500MB) | 最大ファイルサイズ（バイト） |
| `chunkSize` | `number` | `100000` | チャンクサイズ（行数） |
| `cacheEnabled` | `boolean` | `true` | フィルタキャッシュの有効/無効 |
| `autoIndex` | `boolean` | `true` | 自動インデックス作成の有効/無効 |

### メソッド

#### import

データをインポートします。

```typescript
async import(
  nodeId: NodeId, 
  options: ImportOptions
): Promise<CSVMetadata>
```

##### ImportOptions

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `source` | `'file' \| 'url' \| 'clipboard'` | ✓ | データソース |
| `file` | `File` | sourceが'file'の場合 | ファイルオブジェクト |
| `url` | `string` | sourceが'url'の場合 | データのURL |
| `clipboardData` | `string` | sourceが'clipboard'の場合 | クリップボードのテキストデータ |
| `delimiter` | `string` | | 区切り文字（デフォルト: '	'） |
| `hasHeaders` | `boolean` | | ヘッダー行の有無（デフォルト: true） |
| `encoding` | `string` | | 文字エンコーディング（デフォルト: 'utf-8'） |
| `sheet` | `number \| string` | | Excelのシート指定 |

##### 戻り値: CSVMetadata

```typescript
interface CSVMetadata {
  nodeId: NodeId;
  columns: string[];
  rowCount: number;
  fileSize: number;
  contentHash: string;
  keyColumn?: string;
  valueColumns?: string[];
  delimiter: string;
  hasHeader: boolean;
  encoding: string;
  createdAt: number;
  updatedAt: number;
}
```

#### export

データをエクスポートします。

```typescript
async export(
  nodeId: NodeId, 
  options: ExportOptions
): Promise<Blob>
```

##### ExportOptions

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `format` | `'csv' \| 'excel' \| 'json'` | ✓ | 出力形式 |
| `delimiter` | `string` | | CSV区切り文字（デフォルト: '	'） |
| `includeHeaders` | `boolean` | | ヘッダー行を含むか（デフォルト: true） |
| `columns` | `string[]` | | エクスポートするカラム（省略時は全カラム） |
| `filters` | `FilterRule[]` | | 適用するフィルタ |

#### filter

データをフィルタリングして行を抽出します。

```typescript
async filter(
  nodeId: NodeId,
  rules: FilterRule[],
  options?: QueryOptions
): Promise<QueryResult>
```

##### FilterRule

```typescript
interface FilterRule {
  column: string;              // カラム名
  operator: FilterOperator;    // 演算子
  value: string | number | boolean; // 比較値
  caseSensitive?: boolean;     // 大文字小文字の区別
}

type FilterOperator = 
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'regex'
  | 'greater_than' | 'less_than'
  | 'greater_than_or_equal' | 'less_than_or_equal'
  | 'is_null' | 'is_not_null';
```

##### QueryOptions

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `limit` | `number` | | 取得する最大行数 |
| `offset` | `number` | `0` | 開始位置 |
| `useCache` | `boolean` | `true` | キャッシュを使用するか |
| `cacheResults` | `boolean` | `true` | 結果をキャッシュするか |
| `progressCallback` | `(progress: number) => void` | | 進捗コールバック |

##### 戻り値: QueryResult

```typescript
interface QueryResult {
  rows: string[][];       // マッチした行データ
  totalMatches: number;   // 総マッチ数
  fromCache: boolean;     // キャッシュから取得したか
  queryTime: number;      // クエリ実行時間（ミリ秒）
}
```

#### extractColumns

特定のカラムを抽出します。

```typescript
async extractColumns(
  nodeId: NodeId, 
  options: ColumnExtractOptions
): Promise<Array<Record<string, any>>>
```

##### ColumnExtractOptions

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `columns` | `string[]` | ✓ | 抽出するカラム名 |
| `unique` | `boolean` | | ユニークな値のみ取得（デフォルト: false） |
| `sort` | `'asc' \| 'desc'` | | ソート順 |
| `limit` | `number` | | 最大取得数 |

#### getPreview

データのプレビューを取得します。

```typescript
async getPreview(
  nodeId: NodeId,
  options?: {
    rows?: number;
    applyFilters?: FilterRule[];
  }
): Promise<PreviewData>
```

##### 戻り値: PreviewData

```typescript
interface PreviewData {
  nodeId: NodeId;
  sampleRows: string[][];
  filteredSample?: string[][];
  statistics: {
    totalRows: number;
    totalColumns: number;
    uniqueKeyValues?: number;
    columnsInfo: Record<string, ColumnInfo>;
  };
}

interface ColumnInfo {
  type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  nullCount: number;
  uniqueCount: number;
  sampleValues: (string | number | boolean | null)[];
  min?: number | string;
  max?: number | string;
}
```

#### delete

ノードのデータを削除します。リファレンスカウントがゼロになった場合、実データも削除されます。

```typescript
async delete(nodeId: NodeId): Promise<void>
```

#### getStats

ストレージの統計情報を取得します。

```typescript
async getStats(): Promise<{
  totalNodes: number;
  totalChunks: number;
  totalCacheEntries: number;
  totalIndexEntries: number;
  estimatedSize: number;
  orphanedCleaned: number;
}>
```

## 補助クラス

### FileLoader

ファイル読み込みを担当します。

#### 静的メソッド

##### dataToCSV

データをCSV文字列に変換します。

```typescript
static dataToCSV(
  data: string[][], 
  headers?: string[]
): string
```

##### dataToExcel

データをExcelバイナリに変換します。

```typescript
static dataToExcel(
  data: string[][], 
  headers?: string[]
): ArrayBuffer
```

### ReferenceManager

リファレンスカウント管理を担当します。

#### メソッド

##### addReference

コンテンツへの参照を追加します。

```typescript
async addReference(
  contentHash: string, 
  nodeId: NodeId
): Promise<void>
```

##### removeReference

コンテンツへの参照を削除します。

```typescript
async removeReference(
  contentHash: string, 
  nodeId: NodeId
): Promise<boolean> // true: データが削除された
```

##### getReferenceCount

参照カウントを取得します。

```typescript
getReferenceCount(contentHash: string): number
```

##### isShared

コンテンツが共有されているか確認します。

```typescript
isShared(contentHash: string): boolean
```

## エラーハンドリング

### CSVStorageError

すべてのエラーは`CSVStorageError`クラスとしてスローされます。

```typescript
class CSVStorageError extends Error {
  constructor(
    public code: CSVStorageErrorCode,
    message: string,
    public details?: any
  )
}

enum CSVStorageErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  CHUNK_NOT_FOUND = 'CHUNK_NOT_FOUND',
  METADATA_NOT_FOUND = 'METADATA_NOT_FOUND',
  COMPRESSION_ERROR = 'COMPRESSION_ERROR',
  DECOMPRESSION_ERROR = 'DECOMPRESSION_ERROR',
  INDEX_BUILD_ERROR = 'INDEX_BUILD_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
}
```

### エラーハンドリング例

```typescript
try {
  const metadata = await spreadsheet.import(nodeId, {
    source: 'file',
    file: largeFile
  });
} catch (error) {
  if (error instanceof CSVStorageError) {
    switch (error.code) {
      case CSVStorageErrorCode.FILE_TOO_LARGE:
        console.error('ファイルが大きすぎます');
        break;
      case CSVStorageErrorCode.INVALID_FORMAT:
        console.error('無効なファイル形式です');
        break;
      default:
        console.error('エラー:', error.message);
    }
  }
}
```