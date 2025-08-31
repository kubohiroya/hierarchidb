# Spreadsheet Plugin

HierarchiDB用のスプレッドシートプラグインです。CSV/TSV/Excel/ZIPファイルの読み込み、大容量データの効率的な処理、フィルタリング機能を提供します。

## 概要

このプラグインは、フォルダプラグインを継承し、以下の機能を追加します：

- **多形式ファイル対応**: CSV、TSV、Excel (.xlsx/.xls)、ZIP圧縮ファイル
- **大容量データ処理**: チャンク分割による効率的なメモリ管理
- **高度なフィルタリング**: 行・列の動的フィルタリング機能
- **バイナリ最適化**: パース済みデータのバイナリ化による高速アクセス
- **フォルダ機能継承**: ブックマーク、テンプレート、検索機能

## アーキテクチャ

### データフロー

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ファイル読み込み  │ -> │  RawFileMetadata │ -> │   RowChunk      │
│ (CSV/Excel/ZIP)  │    │  (ファイル情報)     │    │ (バイナリ化データ) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                              ↓                         ↓
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ SpreadsheetEntity│ <- │  フィルタリング処理   │ <- │  チャンクイテレート │
│ (TreeNode紐づけ) │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                      │
         ↓                      ↓
┌─────────────────┐    ┌──────────────────┐
│ SpreadsheetRow  │    │   UI表示         │
│ (フィルタ済み行)  │ -> │                  │
└─────────────────┘    └──────────────────┘
```

### データベーススキーマ

#### PersistentRelationalEntity Tables

##### RawFileMetadata
```typescript
{
  id: EntityId;
  fileName: string;
  originalUrl?: string;        // ダウンロード元URL
  fileSize: number;
  contentHash: string;         // 重複排除用
  totalRows: number;
  totalColumns: number;
  chunkCount: number;
  parsingConfig: CSVProcessingConfig;
  uploadedAt: number;
  parsedAt: number;
}
```

##### RowChunk
```typescript
{
  id: EntityId;
  rawFileMetadataId: EntityId; // RawFileMetadataへの参照
  chunkIndex: number;          // 0から開始
  binaryData: ArrayBuffer;     // バイナリ化された行データ
  rowCount: number;
  startRowIndex: number;       // 全体での開始行
  endRowIndex: number;         // 全体での終了行
  compressedSize: number;
}
```

##### SpreadsheetRow
```typescript
{
  id: EntityId;
  spreadsheetEntityId: EntityId;  // SpreadsheetEntityへの参照
  originalRowIndex: number;       // 元データでの行位置
  cellValues: (string|number|null)[]; // 現在選択されているカラムの値
  columnMapping: number[];        // 元データのカラムインデックスマッピング
  matchedFilters: string[];       // マッチしたフィルタID
  filterScore: number;            // ソート用スコア
}
```

#### PersistentPeerEntity Tables

##### SpreadsheetEntity
```typescript
{
  id: EntityId;
  nodeId: NodeId;              // TreeNodeとの紐づけ
  rawFileMetadataId?: EntityId; // RawFileMetadataへの参照
  
  // フォルダ継承
  name: string;
  description?: string;
  settings: SpreadsheetSettings; // フォルダ設定 + CSV設定
  metadata: Record<string, any>;
  
  // フィルタ状態
  currentFilterState: {
    rowFilters: SpreadsheetRowFilter[];
    columnFilters: SpreadsheetColumnFilter[];
    isFiltered: boolean;
    filteredRowCount: number;
    filteredColumnCount: number;
  };
  
  // 統計情報
  statistics: {
    originalRowCount: number;
    originalColumnCount: number;
    currentRowCount: number;
    currentColumnCount: number;
    totalDataSize: number;
    lastFilteredAt?: number;
  };
}
```

## 主要クラス

### SpreadsheetCSVApiDriver

CSVデータ処理のメインAPIドライバー。StyleMapCSVApiDriverから改良。

**主要機能**:
- ✅ **チャンク対応**: 大容量ファイル（100K行+）の効率的処理
- ✅ **多形式対応**: CSV/TSV/Excel/ZIP自動判別・変換
- ✅ **セキュリティ**: SSRF攻撃対策、CSVインジェクション対策
- ✅ **重複排除**: ハッシュベースの既存ファイル検出

```typescript
class SpreadsheetCSVApiDriver implements ICSVDataApi {
  // チャンク設定
  private readonly chunkConfig = {
    maxRowsPerChunk: 10000,     // 10K行/チャンク
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB制限
    enableVirtualization: true,
  };

  async uploadCSVFile(file: File, config?: CSVProcessingConfig): Promise<CSVTableMetadata>
  async downloadCSVFromUrl(url: string, config?: CSVProcessingConfig): Promise<CSVTableMetadata>
  async getFilteredPreview(tableId: string, filters: CSVFilterRule[], rowCount: number, startRow?: number): Promise<CSVDataResult>
}
```

### SpreadsheetDatabase

全テーブルの統合管理。

```typescript
class SpreadsheetDatabase extends Dexie {
  // テーブル定義
  rawFileMetadata!: Table<RawFileMetadata>;
  rowChunks!: Table<RowChunk>;
  spreadsheetRows!: Table<SpreadsheetRow>;
  spreadsheetEntities!: Table<SpreadsheetEntity>;
  workingCopies!: Table<SpreadsheetEntityWorkingCopy>;

  // 主要メソッド
  async createRawFileMetadata(): Promise<RawFileMetadata>
  async createRowChunks(chunks: RowChunk[]): Promise<RowChunk[]>
  async getRowChunksInRange(metadataId: string, startRow: number, endRow: number): Promise<RowChunk[]>
  async createFilteredRows(rows: SpreadsheetRow[]): Promise<SpreadsheetRow[]>
  async updateRowsColumnSelection(entityId: string, columnMapping: number[]): Promise<void>
}
```

### SpreadsheetEntityHandler

フォルダEntityHandlerを継承し、CSV処理機能を追加。

```typescript
class SpreadsheetEntityHandler extends FolderEntityHandler {
  // フォルダ機能継承 + CSV機能追加
  async createEntity(nodeId: NodeId, data?: Partial<SpreadsheetEntity>): Promise<SpreadsheetEntity>
  async loadCSVFile(nodeId: NodeId, file: File): Promise<void>
  async applyRowFilters(nodeId: NodeId, filters: SpreadsheetRowFilter[]): Promise<void>
  async applyColumnFilters(nodeId: NodeId, filters: SpreadsheetColumnFilter[]): Promise<void>
  async getFilteredRows(nodeId: NodeId, offset?: number, limit?: number): Promise<SpreadsheetRow[]>
}
```

## データ処理フロー

### 1. ファイル読み込み処理

```typescript
// 1. RawFileMetadata作成・保存
const metadata = await db.createRawFileMetadata({
  fileName: file.name,
  fileSize: file.size,
  contentHash: await calculateHash(file),
  totalRows: parsedData.length,
  totalColumns: columns.length,
  // ...
});

// 2. データをチャンク分割してRowChunk作成
const chunks = await createChunkedData(parsedData, chunkSize);
await db.createRowChunks(chunks.map(chunk => ({
  rawFileMetadataId: metadata.id,
  chunkIndex: chunk.index,
  binaryData: serializeToBinary(chunk.rows),
  rowCount: chunk.rows.length,
  // ...
})));

// 3. SpreadsheetEntity作成・TreeNode紐づけ
const entity = await db.createSpreadsheetEntity({
  nodeId: nodeId,
  rawFileMetadataId: metadata.id,
  currentFilterState: { /* 初期状態 */ },
  statistics: { /* 統計情報 */ }
});
```

### 2. フィルタリング処理

```typescript
// 1. 行フィルタ適用
async applyRowFilters(nodeId: NodeId, filters: SpreadsheetRowFilter[]): Promise<void> {
  const entity = await db.getSpreadsheetEntityByNodeId(nodeId);
  const chunks = await db.getRowChunksByMetadataId(entity.rawFileMetadataId);
  
  // チャンクをイテレートしてフィルタ適用
  const filteredRows: SpreadsheetRow[] = [];
  for (const chunk of chunks) {
    const rows = deserializeFromBinary(chunk.binaryData);
    const matchedRows = rows.filter(row => matchesFilters(row, filters));
    
    filteredRows.push(...matchedRows.map(row => ({
      spreadsheetEntityId: entity.id,
      originalRowIndex: chunk.startRowIndex + row.index,
      cellValues: row.values,
      columnMapping: getOriginalColumnMapping(),
      matchedFilters: getMatchedFilterIds(row, filters),
      filterScore: calculateFilterScore(row, filters)
    })));
  }
  
  // SpreadsheetRowテーブルに保存
  await db.clearFilteredRows(entity.id);
  await db.createFilteredRows(filteredRows);
}

// 2. カラムフィルタ適用（既存行データ更新）
async applyColumnFilters(nodeId: NodeId, filters: SpreadsheetColumnFilter[]): Promise<void> {
  const entity = await db.getSpreadsheetEntityByNodeId(nodeId);
  const newColumnMapping = extractColumnMapping(filters);
  
  // SpreadsheetRowの cellValues と columnMapping を更新
  await db.updateRowsColumnSelection(entity.id, newColumnMapping);
}
```

## 設定・カスタマイズ

### チャンク設定

```typescript
const chunkConfig = {
  maxRowsPerChunk: 10000,           // チャンクあたり最大行数
  maxMemoryUsage: 50 * 1024 * 1024, // 最大メモリ使用量
  enableVirtualization: true,       // 仮想スクロール有効化
};
```

### フィルタ設定

```typescript
const filterSettings = {
  maxConcurrentFilters: 10,     // 同時適用フィルタ数
  enableRegexFilters: true,     // 正規表現フィルタ
  enableDateRangeFilters: true, // 日付範囲フィルタ
};
```

### 表示設定

```typescript
const displaySettings = {
  maxPreviewRows: 1000,         // プレビュー最大行数
  enableVirtualScrolling: true, // 仮想スクロール
  defaultColumnWidth: 150,      // デフォルト列幅
};
```

## セキュリティ機能

### SSRF攻撃対策
- プライベートIPアドレスへのアクセス禁止
- ローカルホスト・内部ネットワークアドレス遮断
- プロトコル制限（HTTP/HTTPS のみ）

### CSVインジェクション対策
- 危険な開始文字（=, +, -, @）のサニタイズ
- 数式実行防止のためのクォート挿入

### ファイル検証
- サポート形式の厳格なチェック
- ファイルサイズ制限（デフォルト100MB）
- マルウェアパターンの基本検証

## パフォーマンス最適化

### メモリ効率化
- **チャンク分割**: 10K行単位での処理
- **バイナリ化**: パース済みデータの効率的保存
- **遅延読み込み**: 必要チャンクのみメモリ展開

### 処理速度向上
- **インデックス活用**: Dexieによる高速検索
- **バッチ処理**: 大量データの一括操作
- **キャッシュ戦略**: メモリ・ディスク・ハイブリッド

### スケーラビリティ
- **仮想スクロール**: 大量行の効率的表示
- **範囲検索**: 必要範囲のチャンクのみ処理
- **並列処理**: 複数チャンクの同時処理

## テスト戦略

### 正常系テスト（8ケース）
- 基本的なCSV/TSVファイル読み込み
- Excel形式の変換処理
- ZIP圧縮ファイル展開
- 大容量ファイル（100K行）のチャンク処理

### 異常系テスト（8ケース）
- 不正ファイル形式の拒否
- ファイルサイズ上限超過
- 破損ファイル処理
- セキュリティ攻撃パターン

### 境界値テスト（6ケース）
- チャンクサイズ境界での処理
- メモリ制限境界での動作
- フィルタ数上限での処理

## 使用例

### 基本的な使用方法

```typescript
// 1. SpreadsheetEntityHandlerの初期化
const handler = new SpreadsheetEntityHandler();

// 2. CSVファイルの読み込み
const nodeId = 'spreadsheet-plugin-node-123' as NodeId;
await handler.loadCSVFile(nodeId, csvFile);

// 3. 行フィルタの適用
const rowFilters: SpreadsheetRowFilter[] = [{
  id: 'filter1',
  name: 'Age Filter',
  enabled: true,
  conditions: [{
    columnIndex: 2,
    operator: 'greater_than',
    value: 18
  }],
  logicalOperator: 'AND'
}];
await handler.applyRowFilters(nodeId, rowFilters);

// 4. カラムフィルタの適用
const columnFilters: SpreadsheetColumnFilter[] = [{
  id: 'cols1',
  name: 'Basic Columns',
  enabled: true,
  selectedColumns: [
    { originalIndex: 0, displayName: 'Name', dataType: 'string', visible: true },
    { originalIndex: 1, displayName: 'Email', dataType: 'string', visible: true },
    { originalIndex: 2, displayName: 'Age', dataType: 'number', visible: true }
  ],
  columnOrder: [0, 1, 2]
}];
await handler.applyColumnFilters(nodeId, columnFilters);

// 5. フィルタ済みデータの取得
const filteredRows = await handler.getFilteredRows(nodeId, 0, 100);
```

### UI統合例

```typescript
// CSV-Extract UIコンポーネントとの統合
import { 
  CSVFileUploadStep,
  CSVColumnSelectionStep,
  CSVFilterStep 
} from '@hierarchidb/ui-csv-extract';

const SpreadsheetImportWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [csvApiDriver] = useState(() => new SpreadsheetCSVApiDriver('spreadsheet-plugin'));

  return (
    <Stepper activeStep={currentStep}>
      <Step>
        <CSVFileUploadStep 
          pluginId="spreadsheet-plugin"
          onFileUploaded={handleFileUploaded}
        />
      </Step>
      <Step>
        <CSVColumnSelectionStep
          tableMetadata={tableMetadata}
          onSelectionChanged={handleColumnSelection}
        />
      </Step>
      <Step>
        <CSVFilterStep
          tableMetadata={tableMetadata}
          pluginId="spreadsheet-plugin"
          onFiltersChanged={handleFilterChange}
        />
      </Step>
    </Stepper>
  );
};
```

## 今後の拡張予定

### 機能拡張
- [ ] SQLライクなクエリ機能
- [ ] データの可視化・グラフ生成
- [ ] リアルタイムデータ更新
- [ ] データエクスポート機能

### パフォーマンス改善
- [ ] Web Workersによる並列処理
- [ ] IndexedDBの分散ストレージ
- [ ] ストリーミング処理対応

### UI改善
- [ ] 高度なフィルタエディタ
- [ ] カラム型推定UI
- [ ] データプレビューの改善

## 依存関係

### 内部依存
- `@hierarchidb/core` - 基本型定義
- `@hierarchidb/ui-csv-extract` - CSV処理UI
- `@hierarchidb/plugin-folder` - フォルダ機能継承

### 外部依存
- `dexie` - IndexedDBラッパー
- `xlsx` - Excel形式処理（予定）
- `jszip` - ZIP展開処理（予定）

## ライセンス

MIT License - HierarchiDBプロジェクトに従う