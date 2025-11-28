# plugin-styler API エンドポイント仕様

## API 概要

🟢 plugin-styler は hierarchidb の Worker層で動作し、Comlink RPC を介してUI層と通信します。eria-cartograph の実装パターンに基づいて、型安全な非同期APIを提供します。

### 🟢 通信アーキテクチャ

```
UI Layer (React Components)
    ↕ Comlink RPC (Type-safe)
Worker Layer (StylerWorkerAPI)
    ↕ Dexie Transactions
IndexedDB (StylerDB)
```

## 🟢 Core Styler Management API

### POST /styler/create

**説明**: 新しいStylerエンティティを作成します

**TypeScript シグネチャ**:
```typescript
createStyler(
  parentId: TreeNodeId, 
  formData: StylerFormData
): Promise<WorkingCopyResult<StylerEntity>>
```

**パラメータ**:
```typescript
interface CreateStylerRequest {
  parentId: TreeNodeId;          // 親ノードID
  formData: StylerFormData;    // フォームデータ
}

interface StylerFormData {
  name: string;                  // Styler名（必須）
  description: string;           // 説明
  file?: File;                  // アップロードファイル
  keyColumn?: string;           // キーカラム名
  valueColumn?: string;         // 値カラム名
  filterRules?: FilterRule[];   // フィルタルール
  stylerConfig?: StylerConfig; // カラーマッピング設定
  downloadUrl?: string;         // ダウンロードURL
}
```

**レスポンス**:
```typescript
interface WorkingCopyResult<StylerEntity> {
  success: boolean;
  workingCopyId?: UUID;         // 作業コピーID
  data?: StylerEntity;        // 作成されたエンティティ
  error?: string;               // エラーメッセージ
}
```

**使用例**:
```typescript
const result = await stylerAPI.createStyler('parent-123', {
  name: 'Population Density Map',
  description: 'World population density visualization',
  file: csvFile,
  keyColumn: 'country_code',
  valueColumn: 'population_density'
});

if (result.success) {
  console.log('Created Styler:', result.data);
  console.log('Working Copy ID:', result.workingCopyId);
}
```

### GET /styler/:nodeId

**説明**: 指定されたStylerエンティティを取得します

**TypeScript シグネチャ**:
```typescript
getStyler(nodeId: TreeNodeId): Promise<StylerEntity | undefined>
```

**レスポンス**:
```typescript
interface StylerEntity extends PrimaryResourceEntity {
  cacheKey?: string;
  downloadUrl?: string;
  filename?: string;
  tableMetadataId?: UUID;
  keyColumn?: string;
  valueColumn?: string;
  filterRules?: FilterRule[];
  stylerConfig?: StylerConfig;
  contentHash?: string;
}
```

**使用例**:
```typescript
const styler = await stylerAPI.getStyler('styler-plugin-456');
if (styler) {
  console.log('Styler config:', styler.stylerConfig);
  console.log('Filter rules:', styler.filterRules);
}
```

### PUT /styler/:nodeId

**説明**: 既存のStylerエンティティを更新します

**TypeScript シグネチャ**:
```typescript
updateStyler(
  nodeId: TreeNodeId, 
  updates: Partial<StylerEntity>
): Promise<void>
```

**パラメータ**:
```typescript
interface UpdateStylerRequest {
  nodeId: TreeNodeId;
  updates: Partial<StylerEntity>;
}
```

**使用例**:
```typescript
await stylerAPI.updateStyler('styler-plugin-456', {
  name: 'Updated Population Map',
  stylerConfig: {
    algorithm: 'logarithmic',
    colorSpace: 'hsv',
    mapping: { min: 0, max: 1000000, hueStart: 0, hueEnd: 0.8, saturation: 0.7, brightness: 0.9 },
    targetProperty: 'fill-color'
  }
});
```

### DELETE /styler/:nodeId

**説明**: 指定されたStylerエンティティを削除します

**TypeScript シグネチャ**:
```typescript
deleteStyler(nodeId: TreeNodeId): Promise<void>
```

**使用例**:
```typescript
await stylerAPI.deleteStyler('styler-plugin-456');
console.log('Styler deleted successfully');
```

## 🟢 File Processing API

### POST /styler/parse-file

**説明**: CSV/TSVファイルを解析してテーブル構造を抽出します

**TypeScript シグネチャ**:
```typescript
parseFile(file: File): Promise<ParseFileResult>
```

**パラメータ**:
```typescript
interface ParseFileRequest {
  file: File;                   // アップロードファイル
}
```

**レスポンス**:
```typescript
interface ParseFileResult {
  success: boolean;
  tableMetadata?: TableMetadataEntity;
  rows?: RowEntity[];
  contentHash?: string;
  error?: string;
  stats?: {
    rowCount: number;
    columnCount: number;
    processingTime: number;
  };
}

interface TableMetadataEntity {
  id: UUID;
  contentHash: string;
  filename: string;
  columns: string[];
  rowCount: number;
  fileSize: number;
  referenceCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface RowEntity {
  id: UUID;
  t: UUID;                      // tableId
  r: number;                    // rowIndex
  v: (string | number | null)[]; // values
}
```

**使用例**:
```typescript
const parseResult = await stylerAPI.parseFile(csvFile);
if (parseResult.success) {
  console.log('Parsed columns:', parseResult.tableMetadata?.columns);
  console.log('Row count:', parseResult.stats?.rowCount);
  console.log('Processing time:', parseResult.stats?.processingTime, 'ms');
}
```

### POST /styler/calculate-hash

**説明**: ファイルのSHA3ハッシュを計算します

**TypeScript シグネチャ**:
```typescript
calculateFileHash(file: File): Promise<string>
```

**レスポンス**: SHA3-256ハッシュ文字列

**使用例**:
```typescript
const hash = await stylerAPI.calculateFileHash(csvFile);
console.log('File hash:', hash);

// キャッシュ確認
const cachedData = await stylerAPI.getCachedData(hash);
if (cachedData) {
  console.log('File already processed, using cache');
}
```

## 🟢 Working Copy Management API

### POST /styler/working-copy/create

**説明**: 編集用の作業コピーを作成します

**TypeScript シグネチャ**:
```typescript
createWorkingCopy(nodeId: TreeNodeId): Promise<WorkingCopyResult<StylerWorkingCopy>>
```

**レスポンス**:
```typescript
interface StylerWorkingCopy extends StylerEntity {
  originalId?: TreeNodeId;
  workingCopyId: UUID;
  isWorkingCopy: true;
  pendingChanges?: Partial<StylerEntity>;
}
```

**使用例**:
```typescript
const workingCopyResult = await stylerAPI.createWorkingCopy('styler-plugin-456');
if (workingCopyResult.success) {
  const workingCopyId = workingCopyResult.workingCopyId;
  // 作業コピーで編集開始
}
```

### PUT /styler/working-copy/:workingCopyId

**説明**: 作業コピーの内容を更新します

**TypeScript シグネチャ**:
```typescript
updateWorkingCopy(
  workingCopyId: UUID, 
  updates: Partial<StylerEntity>
): Promise<WorkingCopyResult>
```

**使用例**:
```typescript
await stylerAPI.updateWorkingCopy(workingCopyId, {
  keyColumn: 'country_iso',
  valueColumn: 'gdp_per_capita',
  filterRules: [
    {
      id: 'filter-1',
      action: 'Exclude',
      keyColumn: 'country_iso',
      matchValue: 'NULL'
    }
  ]
});
```

### POST /styler/working-copy/:workingCopyId/commit

**説明**: 作業コピーの変更をコミットします

**TypeScript シグネチャ**:
```typescript
commitWorkingCopy(workingCopyId: UUID): Promise<WorkingCopyResult>
```

**使用例**:
```typescript
const commitResult = await stylerAPI.commitWorkingCopy(workingCopyId);
if (commitResult.success) {
  console.log('Changes committed successfully');
}
```

### DELETE /styler/working-copy/:workingCopyId

**説明**: 作業コピーを破棄します（変更を保存せずに削除）

**TypeScript シグネチャ**:
```typescript
discardWorkingCopy(workingCopyId: UUID): Promise<WorkingCopyResult>
```

**使用例**:
```typescript
await stylerAPI.discardWorkingCopy(workingCopyId);
console.log('Working copy discarded');
```

## 🟢 Style Calculation API

### POST /styler/calculate-style

**説明**: カラーマッピング設定に基づいてスタイル情報を計算します

**TypeScript シグネチャ**:
```typescript
calculateStylerping(
  config: StylerConfig, 
  data: RowEntity[]
): Promise<StyleCalculationResult>
```

**パラメータ**:
```typescript
interface StyleCalculationRequest {
  config: StylerConfig;
  data: RowEntity[];
}

interface StylerConfig {
  algorithm: 'linear' | 'logarithmic' | 'quantile' | 'categorical';
  colorSpace: 'rgb' | 'hsv';
  mapping: {
    min: number;
    max: number;
    hueStart: number;
    hueEnd: number;
    saturation: number;
    brightness: number;
  };
  targetProperty: MapLibreStyleProperty;
}
```

**レスポンス**:
```typescript
interface StyleCalculationResult {
  success: boolean;
  styleProperties?: Record<string, any>;
  colorMapping?: Array<{
    key: string | number;
    value: number;
    color: string;
    opacity?: number;
  }>;
  error?: string;
}
```

**使用例**:
```typescript
const styleResult = await stylerAPI.calculateStylerping(
  {
    algorithm: 'linear',
    colorSpace: 'hsv',
    mapping: { min: 0, max: 100, hueStart: 0, hueEnd: 0.8, saturation: 0.7, brightness: 0.9 },
    targetProperty: 'fill-color'
  },
  rowData
);

if (styleResult.success) {
  console.log('Generated style properties:', styleResult.styleProperties);
  console.log('Color mapping:', styleResult.colorMapping);
}
```

### POST /styler/generate-maplibre-style

**説明**: MapLibre GL JS用のスタイル仕様を生成します

**TypeScript シグネチャ**:
```typescript
generateMapLibreStyle(stylerId: TreeNodeId): Promise<Record<string, any>>
```

**レスポンス**: MapLibre GL JS スタイル仕様オブジェクト

**使用例**:
```typescript
const mapLibreStyle = await stylerAPI.generateMapLibreStyle('styler-plugin-456');
console.log('MapLibre style spec:', mapLibreStyle);

// MapLibre GL JS に適用
map.getMap().setStyle(mapLibreStyle);
```

## 🟢 Data Filtering API

### POST /styler/apply-filters

**説明**: フィルタルールを適用してデータを絞り込みます

**TypeScript シグネチャ**:
```typescript
applyFilters(
  data: RowEntity[], 
  filters: FilterRule[], 
  columns: string[]
): Promise<RowEntity[]>
```

**パラメータ**:
```typescript
interface ApplyFiltersRequest {
  data: RowEntity[];
  filters: FilterRule[];
  columns: string[];
}

interface FilterRule {
  id: string;
  action: 'Include' | 'Exclude' | 'IncludePattern' | 'ExcludePattern';
  keyColumn: string;
  matchValue: string;
}
```

**使用例**:
```typescript
const filteredData = await stylerAPI.applyFilters(
  rowData,
  [
    {
      id: 'filter-1',
      action: 'Include',
      keyColumn: 'year',
      matchValue: '2023'
    },
    {
      id: 'filter-2', 
      action: 'ExcludePattern',
      keyColumn: 'country_code',
      matchValue: '^(WLD|EUU)$'
    }
  ],
  ['country_code', 'year', 'population']
);

console.log('Filtered row count:', filteredData.length);
```

## 🟡 Cache Management API

### GET /styler/cache/:contentHash

**説明**: キャッシュされたデータを取得します

**TypeScript シグネチャ**:
```typescript
getCachedData(contentHash: string): Promise<ParseFileResult | undefined>
```

**使用例**:
```typescript
const cachedResult = await stylerAPI.getCachedData(fileHash);
if (cachedResult) {
  console.log('Using cached data:', cachedResult.tableMetadata);
} else {
  console.log('Cache miss, need to parse file');
}
```

### DELETE /styler/cache

**説明**: キャッシュをクリアします

**TypeScript シグネチャ**:
```typescript
clearCache(): Promise<void>
```

**使用例**:
```typescript
await stylerAPI.clearCache();
console.log('Cache cleared successfully');
```

## 🟡 Error Handling

### 🟡 Error Response Format

すべてのAPIエラーは統一された形式で返されます：

```typescript
interface StylerError extends Error {
  type: StylerErrorType;
  code: string;
  context?: Record<string, any>;
  recoverable: boolean;
  recoveryActions?: string[];
}

type StylerErrorType =
  | 'FILE_PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'CALCULATION_ERROR'
  | 'CACHE_ERROR'
  | 'NETWORK_ERROR'
  | 'WORKER_ERROR';
```

### 🟡 Error Examples

**ファイル解析エラー**:
```typescript
try {
  const result = await stylerAPI.parseFile(invalidFile);
} catch (error: StylerError) {
  if (error.type === 'FILE_PARSE_ERROR') {
    console.error('File parsing failed:', error.message);
    console.log('Recovery actions:', error.recoveryActions);
  }
}
```

**検証エラー**:
```typescript
try {
  await stylerAPI.createStyler(parentId, invalidFormData);
} catch (error: StylerError) {
  if (error.type === 'VALIDATION_ERROR') {
    console.error('Validation failed:', error.context);
  }
}
```

## 🟡 Performance & Rate Limiting

### 🟡 Request Throttling

```typescript
// Debounced preview updates (300ms)
const debouncedPreviewUpdate = debounce(async (config: StylerConfig) => {
  const result = await stylerAPI.calculateStylerping(config, data);
  updatePreview(result);
}, 300);
```

### 🟡 Batch Operations

```typescript
// Batch row operations for performance
interface BatchRowOperations {
  insertRows: RowEntity[];
  updateRows: Partial<RowEntity>[];
  deleteRowIds: UUID[];
}

async function executeBatchOperations(operations: BatchRowOperations): Promise<void> {
  // Implementation would batch all operations in a single transaction
}
```

## 🟢 API Integration Examples

### 🟢 Complete Styler Creation Flow

```typescript
async function createStylerComplete(
  parentId: TreeNodeId,
  file: File,
  config: Partial<StylerFormData>
): Promise<StylerEntity> {
  
  // 1. Parse file
  const parseResult = await stylerAPI.parseFile(file);
  if (!parseResult.success) {
    throw new Error(`File parsing failed: ${parseResult.error}`);
  }
  
  // 2. Create working copy
  const workingCopyResult = await stylerAPI.createWorkingCopy(parentId);
  if (!workingCopyResult.success) {
    throw new Error(`Working copy creation failed: ${workingCopyResult.error}`);
  }
  
  // 3. Update working copy with parsed data
  await stylerAPI.updateWorkingCopy(workingCopyResult.workingCopyId!, {
    filename: file.name,
    tableMetadataId: parseResult.tableMetadata!.id,
    contentHash: parseResult.contentHash,
    ...config
  });
  
  // 4. Apply initial style calculation
  if (config.stylerConfig && config.keyColumn && config.valueColumn) {
    const styleResult = await stylerAPI.calculateStylerping(
      config.stylerConfig,
      parseResult.rows!
    );
    
    if (!styleResult.success) {
      throw new Error(`Style calculation failed: ${styleResult.error}`);
    }
  }
  
  // 5. Commit working copy
  const commitResult = await stylerAPI.commitWorkingCopy(workingCopyResult.workingCopyId!);
  if (!commitResult.success) {
    throw new Error(`Commit failed: ${commitResult.error}`);
  }
  
  // 6. Return final entity
  return commitResult.data!;
}
```

### 🟢 Real-time Preview Update Flow

```typescript
async function updatePreviewRealtime(
  workingCopyId: UUID,
  configChanges: Partial<StylerConfig>,
  data: RowEntity[]
): Promise<StyleCalculationResult> {
  
  // 1. Update working copy with config changes
  await stylerAPI.updateWorkingCopy(workingCopyId, {
    stylerConfig: configChanges
  });
  
  // 2. Calculate new style mapping
  const styleResult = await stylerAPI.calculateStylerping(
    configChanges as StylerConfig,
    data
  );
  
  // 3. Return for immediate preview update
  return styleResult;
}
```

## API セキュリティ

### 🟢 Input Validation

```typescript
// All API inputs are validated using TypeScript interfaces
// and runtime-worker validation functions

function validateStylerFormData(data: StylerFormData): ValidationResult {
  const errors: Record<string, string[]> = {};
  
  if (!data.name || data.name.trim().length === 0) {
    errors.name = ['Name is required'];
  }
  
  if (data.file && !validateFileFormat(data.file)) {
    errors.file = ['Only CSV and TSV files are supported'];
  }
  
  // Additional validation logic...
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings: {}
  };
}
```

### 🟡 Rate Limiting & Resource Protection

```typescript
// Implement rate limiting for expensive operations
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  checkLimit(operation: string, maxRequests: number, timeWindow: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(operation) || [];
    
    // Remove old requests outside time window
    const validRequests = requests.filter(time => now - time < timeWindow);
    
    if (validRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    validRequests.push(now);
    this.requests.set(operation, validRequests);
    return true;
  }
}
```

この API 設計により、plugin-styler は型安全で高性能な操作を提供し、eria-cartograph の実装パターンを継承しながら hierarchidb フレームワークに最適化されたインターフェースを実現します。