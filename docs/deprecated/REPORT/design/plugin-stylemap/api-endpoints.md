# plugin-stylemap API エンドポイント仕様

## API 概要

🟢 plugin-stylemap は hierarchidb の Worker層で動作し、Comlink RPC を介してUI層と通信します。eria-cartograph の実装パターンに基づいて、型安全な非同期APIを提供します。

### 🟢 通信アーキテクチャ

```
UI Layer (React Components)
    ↕ Comlink RPC (Type-safe)
Worker Layer (StyleMapWorkerAPI)
    ↕ Dexie Transactions
IndexedDB (StyleMapDB)
```

## 🟢 Core StyleMap Management API

### POST /stylemap/create

**説明**: 新しいStyleMapエンティティを作成します

**TypeScript シグネチャ**:
```typescript
createStyleMap(
  parentId: TreeNodeId, 
  formData: StyleMapFormData
): Promise<WorkingCopyResult<StyleMapEntity>>
```

**パラメータ**:
```typescript
interface CreateStyleMapRequest {
  parentId: TreeNodeId;          // 親ノードID
  formData: StyleMapFormData;    // フォームデータ
}

interface StyleMapFormData {
  name: string;                  // StyleMap名（必須）
  description: string;           // 説明
  file?: File;                  // アップロードファイル
  keyColumn?: string;           // キーカラム名
  valueColumn?: string;         // 値カラム名
  filterRules?: FilterRule[];   // フィルタルール
  styleMapConfig?: StyleMapConfig; // カラーマッピング設定
  downloadUrl?: string;         // ダウンロードURL
}
```

**レスポンス**:
```typescript
interface WorkingCopyResult<StyleMapEntity> {
  success: boolean;
  workingCopyId?: UUID;         // 作業コピーID
  data?: StyleMapEntity;        // 作成されたエンティティ
  error?: string;               // エラーメッセージ
}
```

**使用例**:
```typescript
const result = await styleMapAPI.createStyleMap('parent-123', {
  name: 'Population Density Map',
  description: 'World population density visualization',
  file: csvFile,
  keyColumn: 'country_code',
  valueColumn: 'population_density'
});

if (result.success) {
  console.log('Created StyleMap:', result.data);
  console.log('Working Copy ID:', result.workingCopyId);
}
```

### GET /stylemap/:nodeId

**説明**: 指定されたStyleMapエンティティを取得します

**TypeScript シグネチャ**:
```typescript
getStyleMap(nodeId: TreeNodeId): Promise<StyleMapEntity | undefined>
```

**レスポンス**:
```typescript
interface StyleMapEntity extends PrimaryResourceEntity {
  cacheKey?: string;
  downloadUrl?: string;
  filename?: string;
  tableMetadataId?: UUID;
  keyColumn?: string;
  valueColumn?: string;
  filterRules?: FilterRule[];
  styleMapConfig?: StyleMapConfig;
  contentHash?: string;
}
```

**使用例**:
```typescript
const styleMap = await styleMapAPI.getStyleMap('stylemap-plugin-456');
if (styleMap) {
  console.log('StyleMap config:', styleMap.styleMapConfig);
  console.log('Filter rules:', styleMap.filterRules);
}
```

### PUT /stylemap/:nodeId

**説明**: 既存のStyleMapエンティティを更新します

**TypeScript シグネチャ**:
```typescript
updateStyleMap(
  nodeId: TreeNodeId, 
  updates: Partial<StyleMapEntity>
): Promise<void>
```

**パラメータ**:
```typescript
interface UpdateStyleMapRequest {
  nodeId: TreeNodeId;
  updates: Partial<StyleMapEntity>;
}
```

**使用例**:
```typescript
await styleMapAPI.updateStyleMap('stylemap-plugin-456', {
  name: 'Updated Population Map',
  styleMapConfig: {
    algorithm: 'logarithmic',
    colorSpace: 'hsv',
    mapping: { min: 0, max: 1000000, hueStart: 0, hueEnd: 0.8, saturation: 0.7, brightness: 0.9 },
    targetProperty: 'fill-color'
  }
});
```

### DELETE /stylemap/:nodeId

**説明**: 指定されたStyleMapエンティティを削除します

**TypeScript シグネチャ**:
```typescript
deleteStyleMap(nodeId: TreeNodeId): Promise<void>
```

**使用例**:
```typescript
await styleMapAPI.deleteStyleMap('stylemap-plugin-456');
console.log('StyleMap deleted successfully');
```

## 🟢 File Processing API

### POST /stylemap/parse-file

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
const parseResult = await styleMapAPI.parseFile(csvFile);
if (parseResult.success) {
  console.log('Parsed columns:', parseResult.tableMetadata?.columns);
  console.log('Row count:', parseResult.stats?.rowCount);
  console.log('Processing time:', parseResult.stats?.processingTime, 'ms');
}
```

### POST /stylemap/calculate-hash

**説明**: ファイルのSHA3ハッシュを計算します

**TypeScript シグネチャ**:
```typescript
calculateFileHash(file: File): Promise<string>
```

**レスポンス**: SHA3-256ハッシュ文字列

**使用例**:
```typescript
const hash = await styleMapAPI.calculateFileHash(csvFile);
console.log('File hash:', hash);

// キャッシュ確認
const cachedData = await styleMapAPI.getCachedData(hash);
if (cachedData) {
  console.log('File already processed, using cache');
}
```

## 🟢 Working Copy Management API

### POST /stylemap/working-copy/create

**説明**: 編集用の作業コピーを作成します

**TypeScript シグネチャ**:
```typescript
createWorkingCopy(nodeId: TreeNodeId): Promise<WorkingCopyResult<StyleMapWorkingCopy>>
```

**レスポンス**:
```typescript
interface StyleMapWorkingCopy extends StyleMapEntity {
  originalId?: TreeNodeId;
  workingCopyId: UUID;
  isWorkingCopy: true;
  pendingChanges?: Partial<StyleMapEntity>;
}
```

**使用例**:
```typescript
const workingCopyResult = await styleMapAPI.createWorkingCopy('stylemap-plugin-456');
if (workingCopyResult.success) {
  const workingCopyId = workingCopyResult.workingCopyId;
  // 作業コピーで編集開始
}
```

### PUT /stylemap/working-copy/:workingCopyId

**説明**: 作業コピーの内容を更新します

**TypeScript シグネチャ**:
```typescript
updateWorkingCopy(
  workingCopyId: UUID, 
  updates: Partial<StyleMapEntity>
): Promise<WorkingCopyResult>
```

**使用例**:
```typescript
await styleMapAPI.updateWorkingCopy(workingCopyId, {
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

### POST /stylemap/working-copy/:workingCopyId/commit

**説明**: 作業コピーの変更をコミットします

**TypeScript シグネチャ**:
```typescript
commitWorkingCopy(workingCopyId: UUID): Promise<WorkingCopyResult>
```

**使用例**:
```typescript
const commitResult = await styleMapAPI.commitWorkingCopy(workingCopyId);
if (commitResult.success) {
  console.log('Changes committed successfully');
}
```

### DELETE /stylemap/working-copy/:workingCopyId

**説明**: 作業コピーを破棄します（変更を保存せずに削除）

**TypeScript シグネチャ**:
```typescript
discardWorkingCopy(workingCopyId: UUID): Promise<WorkingCopyResult>
```

**使用例**:
```typescript
await styleMapAPI.discardWorkingCopy(workingCopyId);
console.log('Working copy discarded');
```

## 🟢 Style Calculation API

### POST /stylemap/calculate-style

**説明**: カラーマッピング設定に基づいてスタイル情報を計算します

**TypeScript シグネチャ**:
```typescript
calculateStyleMapping(
  config: StyleMapConfig, 
  data: RowEntity[]
): Promise<StyleCalculationResult>
```

**パラメータ**:
```typescript
interface StyleCalculationRequest {
  config: StyleMapConfig;
  data: RowEntity[];
}

interface StyleMapConfig {
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
const styleResult = await styleMapAPI.calculateStyleMapping(
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

### POST /stylemap/generate-maplibre-style

**説明**: MapLibre GL JS用のスタイル仕様を生成します

**TypeScript シグネチャ**:
```typescript
generateMapLibreStyle(styleMapId: TreeNodeId): Promise<Record<string, any>>
```

**レスポンス**: MapLibre GL JS スタイル仕様オブジェクト

**使用例**:
```typescript
const mapLibreStyle = await styleMapAPI.generateMapLibreStyle('stylemap-plugin-456');
console.log('MapLibre style spec:', mapLibreStyle);

// MapLibre GL JS に適用
map.getMap().setStyle(mapLibreStyle);
```

## 🟢 Data Filtering API

### POST /stylemap/apply-filters

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
const filteredData = await styleMapAPI.applyFilters(
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

### GET /stylemap/cache/:contentHash

**説明**: キャッシュされたデータを取得します

**TypeScript シグネチャ**:
```typescript
getCachedData(contentHash: string): Promise<ParseFileResult | undefined>
```

**使用例**:
```typescript
const cachedResult = await styleMapAPI.getCachedData(fileHash);
if (cachedResult) {
  console.log('Using cached data:', cachedResult.tableMetadata);
} else {
  console.log('Cache miss, need to parse file');
}
```

### DELETE /stylemap/cache

**説明**: キャッシュをクリアします

**TypeScript シグネチャ**:
```typescript
clearCache(): Promise<void>
```

**使用例**:
```typescript
await styleMapAPI.clearCache();
console.log('Cache cleared successfully');
```

## 🟡 Error Handling

### 🟡 Error Response Format

すべてのAPIエラーは統一された形式で返されます：

```typescript
interface StyleMapError extends Error {
  type: StyleMapErrorType;
  code: string;
  context?: Record<string, any>;
  recoverable: boolean;
  recoveryActions?: string[];
}

type StyleMapErrorType =
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
  const result = await styleMapAPI.parseFile(invalidFile);
} catch (error: StyleMapError) {
  if (error.type === 'FILE_PARSE_ERROR') {
    console.error('File parsing failed:', error.message);
    console.log('Recovery actions:', error.recoveryActions);
  }
}
```

**検証エラー**:
```typescript
try {
  await styleMapAPI.createStyleMap(parentId, invalidFormData);
} catch (error: StyleMapError) {
  if (error.type === 'VALIDATION_ERROR') {
    console.error('Validation failed:', error.context);
  }
}
```

## 🟡 Performance & Rate Limiting

### 🟡 Request Throttling

```typescript
// Debounced preview updates (300ms)
const debouncedPreviewUpdate = debounce(async (config: StyleMapConfig) => {
  const result = await styleMapAPI.calculateStyleMapping(config, data);
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

### 🟢 Complete StyleMap Creation Flow

```typescript
async function createStyleMapComplete(
  parentId: TreeNodeId,
  file: File,
  config: Partial<StyleMapFormData>
): Promise<StyleMapEntity> {
  
  // 1. Parse file
  const parseResult = await styleMapAPI.parseFile(file);
  if (!parseResult.success) {
    throw new Error(`File parsing failed: ${parseResult.error}`);
  }
  
  // 2. Create working copy
  const workingCopyResult = await styleMapAPI.createWorkingCopy(parentId);
  if (!workingCopyResult.success) {
    throw new Error(`Working copy creation failed: ${workingCopyResult.error}`);
  }
  
  // 3. Update working copy with parsed data
  await styleMapAPI.updateWorkingCopy(workingCopyResult.workingCopyId!, {
    filename: file.name,
    tableMetadataId: parseResult.tableMetadata!.id,
    contentHash: parseResult.contentHash,
    ...config
  });
  
  // 4. Apply initial style calculation
  if (config.styleMapConfig && config.keyColumn && config.valueColumn) {
    const styleResult = await styleMapAPI.calculateStyleMapping(
      config.styleMapConfig,
      parseResult.rows!
    );
    
    if (!styleResult.success) {
      throw new Error(`Style calculation failed: ${styleResult.error}`);
    }
  }
  
  // 5. Commit working copy
  const commitResult = await styleMapAPI.commitWorkingCopy(workingCopyResult.workingCopyId!);
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
  configChanges: Partial<StyleMapConfig>,
  data: RowEntity[]
): Promise<StyleCalculationResult> {
  
  // 1. Update working copy with config changes
  await styleMapAPI.updateWorkingCopy(workingCopyId, {
    styleMapConfig: configChanges
  });
  
  // 2. Calculate new style mapping
  const styleResult = await styleMapAPI.calculateStyleMapping(
    configChanges as StyleMapConfig,
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
// and runtime validation functions

function validateStyleMapFormData(data: StyleMapFormData): ValidationResult {
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

この API 設計により、plugin-stylemap は型安全で高性能な操作を提供し、eria-cartograph の実装パターンを継承しながら hierarchidb フレームワークに最適化されたインターフェースを実現します。