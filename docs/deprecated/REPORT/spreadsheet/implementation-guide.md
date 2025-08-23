# Spreadsheet Plugin 実装ガイド

## プロジェクト構造

```
packages/plugins/spreadsheet/
├── src/
│   ├── openstreetmap-type.ts                     # エクスポート定義
│   ├── SpreadsheetPlugin.ts         # メインクラス
│   │
│   ├── entities/                    # エンティティ定義
│   │   ├── SpreadsheetMetadata.ts   # PersistentRelationalEntity
│   │   ├── SpreadsheetRefEntity.ts  # PersistentPeerEntity
│   │   └── types.ts                 # 型定義
│   │
│   ├── storage/                     # ストレージ層
│   │   ├── SpreadsheetDB.ts        # Dexieデータベース
│   │   ├── ChunkManager.ts         # チャンク管理
│   │   └── ReferenceManager.ts     # リファレンスカウント
│   │
│   ├── processing/                  # データ処理層
│   │   ├── FilterEngine.ts         # フィルタリング
│   │   ├── IndexBuilder.ts         # インデックス構築
│   │   └── QueryExecutor.ts        # クエリ実行
│   │
│   ├── io/                         # 入出力層
│   │   ├── FileLoader.ts           # ファイル読み込み
│   │   ├── URLLoader.ts            # URL読み込み
│   │   ├── ExcelParser.ts          # Excel解析
│   │   └── ExportManager.ts        # エクスポート
│   │
│   └── utils/                      # ユーティリティ
│       ├── hash.ts                 # ハッシュ計算
│       ├── compression.ts          # 圧縮/展開
│       └── validation.ts           # バリデーション
│
├── tests/                           # テスト
├── docs/                           # ドキュメント
└── package.json
```

## 実装手順

### Step 1: エンティティ定義

#### SpreadsheetMetadata.ts
```typescript
import { PersistentRelationalEntity } from '@hierarchidb/core';

// ブランド型定義
export type SpreadsheetMetadataId = string & { 
  readonly __brand: 'SpreadsheetMetadataId' 
};

export interface SpreadsheetMetadata extends PersistentRelationalEntity {
  id: SpreadsheetMetadataId;
  contentHash: string;
  columns: string[];
  rowCount: number;
  columnCount: number;
  fileSize: number;
  originalFormat: 'csv' | 'tsv' | 'excel' | 'json';
  delimiter: string;
  hasHeader: boolean;
  encoding: string;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

// ファクトリ関数
export function createSpreadsheetMetadata(
  data: Omit<SpreadsheetMetadata, 'id' | 'createdAt' | 'updatedAt'>
): SpreadsheetMetadata {
  const now = Date.now();
  return {
    ...data,
    id: generateUUID() as SpreadsheetMetadataId,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now
  };
}
```

#### SpreadsheetRefEntity.ts
```typescript
import { PersistentPeerEntity, NodeId } from '@hierarchidb/core';
import type { SpreadsheetMetadataId } from './SpreadsheetMetadata';

export interface SpreadsheetRefEntity extends PersistentPeerEntity {
  nodeId: NodeId;
  metadataId: SpreadsheetMetadataId;
  name: string;
  description?: string;
  tags?: string[];
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
  };
  createdAt: number;
  updatedAt: number;
  version: number;
}

export function createSpreadsheetRef(
  nodeId: NodeId,
  metadataId: SpreadsheetMetadataId,
  name: string
): SpreadsheetRefEntity {
  return {
    nodeId,
    metadataId,
    name,
    permissions: {
      canRead: true,
      canWrite: true,
      canDelete: true
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  };
}
```

### Step 2: データベース設定

#### SpreadsheetDB.ts
```typescript
import Dexie, { Table } from 'dexie';

export class SpreadsheetDB extends Dexie {
  // PersistentRelationalEntity
  spreadsheetMetadata!: Table<SpreadsheetMetadata, SpreadsheetMetadataId>;
  spreadsheetChunks!: Table<SpreadsheetChunk, string>;
  referenceCount!: Table<ReferenceCount, SpreadsheetMetadataId>;
  
  // PersistentPeerEntity
  spreadsheetRefs!: Table<SpreadsheetRefEntity, NodeId>;
  
  // EphemeralRelationalEntity
  filterCache!: Table<FilterCache, string>;
  columnIndexes!: Table<ColumnIndex, string>;

  constructor() {
    super('SpreadsheetDB');
    
    this.version(1).stores({
      // RelationalEntity（共有データ）
      spreadsheetMetadata: '&id, contentHash, createdAt, lastAccessedAt',
      spreadsheetChunks: 'id, metadataId, [metadataId+chunkIndex]',
      referenceCount: '&metadataId, count, lastAccessed',
      
      // PeerEntity（ノード紐付け）
      spreadsheetRefs: '&nodeId, metadataId, updatedAt',
      
      // Cache（一時データ）
      filterCache: 'id, metadataId, [metadataId+filterHash], expiresAt',
      columnIndexes: 'id, [metadataId+column], metadataId'
    });
  }
}
```

### Step 3: チャンク管理実装

#### ChunkManager.ts
```typescript
import pako from 'pako';
import { SpreadsheetDB } from './SpreadsheetDB';

const CHUNK_SIZE = 100000; // 100K行
const COMPRESSION_LEVEL = 6;

export class ChunkManager {
  constructor(private db: SpreadsheetDB) {}

  async saveChunks(
    metadataId: SpreadsheetMetadataId,
    data: string[][],
    delimiter: string = '\t'
  ): Promise<void> {
    const chunks: SpreadsheetChunk[] = [];
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunkData = data.slice(i, i + CHUNK_SIZE);
      const csvString = chunkData
        .map(row => row.join(delimiter))
        .join('\n');
      
      const compressed = pako.deflate(csvString, {
        level: COMPRESSION_LEVEL
      });
      
      chunks.push({
        id: `${metadataId}_${Math.floor(i / CHUNK_SIZE)}`,
        metadataId,
        chunkIndex: Math.floor(i / CHUNK_SIZE),
        compressedData: compressed,
        rowStart: i,
        rowEnd: Math.min(i + CHUNK_SIZE - 1, data.length - 1),
        sizeBytes: compressed.byteLength,
        firstRowPreview: chunkData[0]?.join(delimiter).substring(0, 100)
      });
    }
    
    await this.db.spreadsheetChunks.bulkAdd(chunks);
  }

  async loadChunk(
    metadataId: SpreadsheetMetadataId,
    chunkIndex: number,
    delimiter: string = '\t'
  ): Promise<string[][]> {
    const chunk = await this.db.spreadsheetChunks
      .where('[metadataId+chunkIndex]')
      .equals([metadataId, chunkIndex])
      .first();
    
    if (!chunk) {
      throw new Error(`Chunk not found: ${metadataId}#${chunkIndex}`);
    }
    
    const decompressed = pako.inflate(chunk.compressedData, {
      to: 'string'
    });
    
    return decompressed
      .split('\n')
      .map(line => line.split(delimiter));
  }

  async* streamChunks(
    metadataId: SpreadsheetMetadataId,
    delimiter: string = '\t'
  ): AsyncGenerator<ChunkData> {
    const chunks = await this.db.spreadsheetChunks
      .where('metadataId')
      .equals(metadataId)
      .sortBy('chunkIndex');
    
    for (const chunk of chunks) {
      const data = await this.loadChunk(
        metadataId, 
        chunk.chunkIndex, 
        delimiter
      );
      
      yield {
        rows: data,
        startIndex: chunk.rowStart,
        endIndex: chunk.rowEnd,
        progress: ((chunk.chunkIndex + 1) / chunks.length) * 100
      };
    }
  }
}
```

### Step 4: Worker APIとの連携

#### SpreadsheetWorkerAPI.ts
```typescript
/**
 * Worker側のAPIを呼び出す
 * リファレンスカウント管理はWorker側で自動的に行われる
 */
export class SpreadsheetWorkerAPI {
  constructor(private workerAPI: WorkerAPI) {}

  /**
   * SpreadsheetRefEntityを作成
   * Worker側でリファレンスカウントが自動的に管理される
   */
  async createReference(
    nodeId: NodeId,
    metadataId: SpreadsheetMetadataId
  ): Promise<void> {
    const refEntity: SpreadsheetRefEntity = {
      nodeId,
      metadataId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    // Worker側のRelationalEntityHandlerが自動的にカウント管理
    await this.workerAPI.createPeerEntity('spreadsheetRef', refEntity);
  }

  /**
   * SpreadsheetRefEntityを削除
   * Worker側でリファレンスカウントが自動的に管理される
   */
  async deleteReference(nodeId: NodeId): Promise<void> {
    // Worker側のRelationalEntityHandlerが自動的に：
    // 1. RefEntityを削除
    // 2. カウントを減らす
    // 3. カウント0ならMetadataとChunksも削除
    await this.workerAPI.deletePeerEntity('spreadsheetRef', nodeId);
  }

  /**
   * SpreadsheetMetadataを作成または取得
   */
  async createOrGetMetadata(
    contentHash: string,
    data: Omit<SpreadsheetMetadata, 'id'>
  ): Promise<SpreadsheetMetadata> {
    // 既存チェック
    const existing = await this.workerAPI.findRelationalEntity(
      'spreadsheetMetadata',
      { contentHash }
    );
    
    if (existing) {
      return existing;
    }
    
    // 新規作成
    const metadata: SpreadsheetMetadata = {
      ...data,
      id: generateUUID() as SpreadsheetMetadataId
    };
    
    await this.workerAPI.createRelationalEntity('spreadsheetMetadata', metadata);
    return metadata;
  }

  /**
   * チャンクを保存
   */
  async saveChunks(chunks: SpreadsheetChunk[]): Promise<void> {
    await this.workerAPI.bulkCreateRelationalEntity('spreadsheetChunks', chunks);
  }
}
```typescript
export class ReferenceManager {
  constructor(private db: SpreadsheetDB) {}

  async addReference(
    nodeId: NodeId,
    metadataId: SpreadsheetMetadataId,
    name: string
  ): Promise<void> {
    // トランザクションで整合性を保証
    await this.db.transaction('rw', 
      this.db.spreadsheetRefs,
      this.db.referenceCount,
      async () => {
        // 1. RefEntityを作成
        const refEntity = createSpreadsheetRef(nodeId, metadataId, name);
        await this.db.spreadsheetRefs.add(refEntity);
        
        // 2. リファレンスカウントを更新
        const count = await this.db.referenceCount.get(metadataId);
        if (count) {
          await this.db.referenceCount.update(metadataId, {
            count: count.count + 1,
            nodeIds: [...count.nodeIds, nodeId],
            lastAccessed: Date.now()
          });
        } else {
          await this.db.referenceCount.add({
            metadataId,
            count: 1,
            nodeIds: [nodeId],
            firstCreated: Date.now(),
            lastAccessed: Date.now()
          });
        }
      }
    );
  }

  async removeReference(nodeId: NodeId): Promise<boolean> {
    let shouldDelete = false;
    
    await this.db.transaction('rw',
      this.db.spreadsheetRefs,
      this.db.referenceCount,
      this.db.spreadsheetMetadata,
      this.db.spreadsheetChunks,
      async () => {
        // 1. RefEntityを取得
        const refEntity = await this.db.spreadsheetRefs.get(nodeId);
        if (!refEntity) return;
        
        // 2. RefEntityを削除
        await this.db.spreadsheetRefs.delete(nodeId);
        
        // 3. リファレンスカウントを更新
        const count = await this.db.referenceCount.get(refEntity.metadataId);
        if (count) {
          const newCount = count.count - 1;
          const newNodeIds = count.nodeIds.filter(id => id !== nodeId);
          
          if (newCount === 0) {
            // 4. カウントが0なら全データ削除
            await this.db.referenceCount.delete(refEntity.metadataId);
            await this.db.spreadsheetMetadata.delete(refEntity.metadataId);
            await this.db.spreadsheetChunks
              .where('metadataId')
              .equals(refEntity.metadataId)
              .delete();
            shouldDelete = true;
          } else {
            // 5. カウントを減らすだけ
            await this.db.referenceCount.update(refEntity.metadataId, {
              count: newCount,
              nodeIds: newNodeIds,
              lastAccessed: Date.now()
            });
          }
        }
      }
    );
    
    return shouldDelete;
  }

  async getReferenceCount(metadataId: SpreadsheetMetadataId): Promise<number> {
    const count = await this.db.referenceCount.get(metadataId);
    return count?.count || 0;
  }

  async isShared(metadataId: SpreadsheetMetadataId): Promise<boolean> {
    const count = await this.getReferenceCount(metadataId);
    return count > 1;
  }
}
```

### Step 5: メインプラグインクラス

#### SpreadsheetPlugin.ts
```typescript
export class SpreadsheetPlugin {
  private db: SpreadsheetDB;
  private chunkManager: ChunkManager;
  private referenceManager: ReferenceManager;
  private filterEngine: FilterEngine;
  private fileLoader: FileLoader;

  constructor() {
    this.db = new SpreadsheetDB();
    this.chunkManager = new ChunkManager(this.db);
    this.referenceManager = new ReferenceManager(this.db);
    this.filterEngine = new FilterEngine(this.db);
    this.fileLoader = new FileLoader();
  }

  async import(
    nodeId: NodeId,
    source: ImportSource
  ): Promise<SpreadsheetRefEntity> {
    // 1. データをロード
    const { data, headers, format } = await this.fileLoader.load(source);
    
    // 2. ハッシュ計算
    const contentHash = await this.calculateHash(data);
    
    // 3. 既存データをチェック
    let metadata = await this.db.spreadsheetMetadata
      .where('contentHash')
      .equals(contentHash)
      .first();
    
    if (!metadata) {
      // 4. 新規作成
      metadata = createSpreadsheetMetadata({
        contentHash,
        columns: headers,
        rowCount: data.length,
        columnCount: headers.length,
        fileSize: source.size || 0,
        originalFormat: format,
        delimiter: '\t',
        hasHeader: true,
        encoding: 'utf-8'
      });
      
      await this.db.spreadsheetMetadata.add(metadata);
      await this.chunkManager.saveChunks(metadata.id, data);
    }
    
    // 5. 参照を作成
    await this.referenceManager.addReference(
      nodeId,
      metadata.id,
      source.name || 'Imported Data'
    );
    
    // 6. RefEntityを返す
    return this.db.spreadsheetRefs.get(nodeId)!;
  }

  async filter(
    nodeId: NodeId,
    rules: FilterRule[]
  ): Promise<QueryResult> {
    const refEntity = await this.db.spreadsheetRefs.get(nodeId);
    if (!refEntity) throw new Error('Reference not found');
    
    return this.filterEngine.execute(refEntity.metadataId, rules);
  }

  async delete(nodeId: NodeId): Promise<void> {
    const wasDeleted = await this.referenceManager.removeReference(nodeId);
    
    if (wasDeleted) {
      console.log('Spreadsheet data was completely removed');
    } else {
      console.log('Reference removed, data still shared');
    }
  }
}
```

## テスト戦略

### ユニットテスト例

```typescript
describe('SpreadsheetPlugin', () => {
  let plugin: SpreadsheetPlugin;
  
  beforeEach(async () => {
    // fake-indexeddbを使用
    plugin = new SpreadsheetPlugin();
  });
  
  it('should share data between nodes', async () => {
    // Node1でインポート
    const node1 = 'node-1' as NodeId;
    const ref1 = await plugin.import(node1, {
      type: 'text',
      content: 'a,b,c\n1,2,3'
    });
    
    // Node2で同じデータをインポート
    const node2 = 'node-2' as NodeId;
    const ref2 = await plugin.import(node2, {
      type: 'text',
      content: 'a,b,c\n1,2,3'
    });
    
    // 同じメタデータを参照
    expect(ref1.metadataId).toBe(ref2.metadataId);
    
    // リファレンスカウントは2
    const count = await plugin.getReferenceCount(ref1.metadataId);
    expect(count).toBe(2);
  });
  
  it('should delete data when last reference removed', async () => {
    const node1 = 'node-1' as NodeId;
    const node2 = 'node-2' as NodeId;
    
    // 2つのノードで共有
    await plugin.import(node1, testData);
    await plugin.import(node2, testData);
    
    // Node1を削除（データは残る）
    await plugin.delete(node1);
    const metadata1 = await plugin.getMetadata(node2);
    expect(metadata1).toBeDefined();
    
    // Node2も削除（データも削除）
    await plugin.delete(node2);
    const metadata2 = await plugin.getMetadata(node2);
    expect(metadata2).toBeUndefined();
  });
});
```

## パフォーマンス考慮事項

### メモリ管理
- チャンクストリーミングで大容量ファイル対応
- 不要なキャッシュの定期削除
- WeakMapでの参照管理

### 最適化テクニック
```typescript
// バッチ処理
await db.transaction('rw', db.chunks, async () => {
  await db.chunks.bulkAdd(chunks);
});

// インデックス活用
db.chunks.where('[metadataId+chunkIndex]').equals([id, 0]);

// 遅延ロード
async function* lazyLoad() {
  for await (const chunk of chunks) {
    yield processChunk(chunk);
  }
}
```

## トラブルシューティング

### よくある問題と解決策

1. **大容量ファイルでメモリ不足**
   - チャンクサイズを小さくする
   - ストリーミング処理を使用

2. **リファレンスカウント不整合**
   - トランザクションで整合性保証
   - 定期的な整合性チェック

3. **圧縮/展開エラー**
   - pakoのエラーハンドリング
   - フォールバック処理