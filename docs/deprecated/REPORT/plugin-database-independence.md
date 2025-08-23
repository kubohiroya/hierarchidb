# プラグイン独立データベース管理

## 基本原則

HierarchiDBのプラグインは、**自身専用のデータベースを独立して管理する責務**を持ちます。CoreDBやEphemeralDBに依存せず、完全に独立したDexieデータベースインスタンスを作成・管理できます。

### なぜ独立データベースが必要か

1. **責任分離**: プラグインのデータはプラグインが管理
2. **スキーマ自由度**: プラグイン固有のテーブル構造を自由に設計
3. **パフォーマンス**: 専用インデックスとクエリ最適化
4. **独立性**: プラグインの追加・削除がコアシステムに影響しない
5. **バージョン管理**: プラグイン独自のスキーマバージョニング

## プラグインデータベース設計パターン

### 1. 独立Dexieデータベースクラス

```typescript
// packages/worker/src/db/MyPluginDB.ts
import Dexie, { type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/core';
import type { MyEntity, MyRelationalEntity } from '@hierarchidb/plugin-myplugin';

export class MyPluginDB extends Dexie {
  // PeerEntity table (ノード紐付け)
  myEntities!: Table<MyEntity, NodeId>;
  
  // RelationalEntity table (共有データ)
  mySharedData!: Table<MyRelationalEntity, string>;

  constructor(name: string = 'hierarchidb-myplugin') {
    super(name);

    this.version(1).stores({
      // PeerEntity: TreeNodeとの1対1関係
      myEntities: '&nodeId, sharedDataId, createdAt, updatedAt',
      
      // RelationalEntity: 複数ノードで共有可能
      mySharedData: '&id, contentHash, createdAt, lastAccessedAt'
    });
  }

  async initialize(): Promise<void> {
    console.log('MyPluginDB initialized');
    // 初期データ作成やマイグレーション処理
  }
}
```

### 2. プラグインでのデータベース管理

```typescript
// packages/worker/src/plugins/MyPlugin.ts
import { MyPluginDB } from '../db/MyPluginDB';
import { MyPluginWorkerHandler } from '../handlers/MyPluginWorkerHandler';

export function createMyPlugin(): PluginDefinition {
  // プラグイン専用データベースを作成
  const pluginDB = new MyPluginDB();
  const handler = new MyPluginWorkerHandler(pluginDB);

  return {
    nodeType: 'myplugin' as TreeNodeType,
    name: 'My Plugin',
    
    // データベース初期化はプラグインの責務
    async initialize() {
      await pluginDB.initialize();
      console.log('My Plugin initialized with independent database');
    },

    entityHandler: {
      async createEntity(nodeId: NodeId, data?: any) {
        return await handler.createEntity(nodeId, data);
      },
      // ... other methods
    },

    // プラグイン独自のAPI
    routing: {
      actions: {
        'custom-action': async (nodeId: NodeId, params: any) => {
          // プラグイン専用データベースを使用
          return await handler.performCustomAction(nodeId, params);
        }
      }
    }
  };
}
```

### 3. WorkerHandlerでの独立データベース使用

```typescript
// packages/worker/src/handlers/MyPluginWorkerHandler.ts
import { BaseReferenceCountingHandler } from './ReferenceCountingHandler';
import { MyPluginDB } from '../db/MyPluginDB';

export class MyPluginWorkerHandler extends BaseReferenceCountingHandler {
  constructor(private pluginDB: MyPluginDB) {
    super(); // CoreDB/EphemeralDBは渡さない
  }

  protected async getPeerEntity(nodeId: NodeId): Promise<any> {
    // 独立データベースを使用
    return await this.pluginDB.myEntities.get(nodeId);
  }

  protected async deletePeerEntity(nodeId: NodeId): Promise<void> {
    await this.pluginDB.myEntities.delete(nodeId);
  }

  protected async countPeerEntitiesByRelRef(relRef: any): Promise<number> {
    return await this.pluginDB.myEntities.where('sharedDataId').equals(relRef).count();
  }

  protected async deleteRelationalEntity(relRef: any): Promise<void> {
    await this.pluginDB.mySharedData.delete(relRef);
  }

  // プラグイン独自メソッド
  async performCustomAction(nodeId: NodeId, params: any): Promise<any> {
    const entity = await this.pluginDB.myEntities.get(nodeId);
    // カスタム処理...
    return { success: true, data: entity };
  }
}
```

## 実装例: SpreadsheetプラグインとStyleMapプラグイン

### SpreadsheetDB (独立データベース)

```typescript
export class SpreadsheetDB extends Dexie {
  // RelationalEntity: 共有データ
  spreadsheetMetadata!: Table<SpreadsheetMetadata, SpreadsheetMetadataId>;
  spreadsheetChunks!: Table<SpreadsheetChunk, string>;

  // PeerEntity: ノード紐付け
  spreadsheetRefs!: Table<SpreadsheetRefEntity, NodeId>;

  constructor(name: string = 'hierarchidb-spreadsheet') {
    super(name);
    this.version(1).stores({
      spreadsheetMetadata: '&id, contentHash, createdAt, lastAccessedAt',
      spreadsheetChunks: '&id, metadataId, [metadataId+chunkIndex]',
      spreadsheetRefs: '&nodeId, metadataId, createdAt, updatedAt'
    });
  }

  // 自然な参照カウント管理
  async countRefsForMetadata(metadataId: SpreadsheetMetadataId): Promise<number> {
    return await this.spreadsheetRefs.where('metadataId').equals(metadataId).count();
  }

  // 孤立データクリーンアップ
  async cleanup(): Promise<{ deletedMetadata: number; deletedChunks: number }> {
    const allMetadata = await this.spreadsheetMetadata.toArray();
    let deletedMetadata = 0;
    let deletedChunks = 0;

    for (const metadata of allMetadata) {
      const refCount = await this.countRefsForMetadata(metadata.id);
      if (refCount === 0) {
        await this.spreadsheetMetadata.delete(metadata.id);
        await this.spreadsheetChunks.where('metadataId').equals(metadata.id).delete();
        deletedMetadata++;
      }
    }

    return { deletedMetadata, deletedChunks };
  }
}
```

### StyleMapDB (別の独立データベース)

```typescript
export class StyleMapDB extends Dexie {
  // PeerEntityのみ - RelationalEntityは持たない
  styleMapEntities!: Table<StyleMapEntity, NodeId>;

  constructor(name: string = 'hierarchidb-stylemap') {
    super(name);
    this.version(1).stores({
      styleMapEntities: '&nodeId, spreadsheetMetadataId, keyColumn, updatedAt'
    });
  }

  // SpreadsheetMetadata参照カウント (外部データベース参照)
  async countEntitiesBySpreadsheetMetadata(metadataId: SpreadsheetMetadataId): Promise<number> {
    return await this.styleMapEntities.where('spreadsheetMetadataId').equals(metadataId).count();
  }
}
```

## データベース初期化の流れ

### 1. プラグインマネージャーでの初期化

```typescript
// packages/worker/src/plugins/PluginManager.ts
export class PluginManager {
  private async registerCorePlugins(): Promise<void> {
    // 各プラグインが独立してデータベースを初期化
    const spreadsheetPlugin = createSpreadsheetPlugin();
    await spreadsheetPlugin.initialize(); // プラグイン独自のDB初期化
    
    const styleMapPlugin = createStyleMapPlugin();
    await styleMapPlugin.initialize(); // プラグイン独自のDB初期化
    
    this.registry.registerPlugin(spreadsheetPlugin);
    this.registry.registerPlugin(styleMapPlugin);
  }
}
```

### 2. プラグイン固有の初期化処理

```typescript
export function createSpreadsheetPlugin(): PluginDefinition {
  const pluginDB = new SpreadsheetDB();
  const handler = new SpreadsheetWorkerHandler(pluginDB);

  return {
    nodeType: 'spreadsheet',
    name: 'Spreadsheet',
    
    async initialize() {
      await pluginDB.initialize();
      // プラグイン固有の初期化処理
      console.log('Spreadsheet plugin database initialized');
    },

    entityHandler: handler,
    // ...
  };
}
```

## 利点と注意点

### 利点

1. **完全な独立性**: プラグインの追加・削除・更新がコアシステムに影響しない
2. **自由なスキーマ設計**: プラグイン固有の要求に最適化されたテーブル構造
3. **独立したバージョニング**: プラグインごとに異なるスキーマバージョン管理
4. **パフォーマンス最適化**: 専用インデックスとクエリ設計
5. **デバッグ容易性**: プラグイン固有のデータが明確に分離

### 注意点

1. **メモリ使用量**: 複数のDexieインスタンスによるメモリ使用
2. **トランザクション分離**: プラグイン間でのトランザクション連携不可
3. **データ一貫性**: プラグイン間の参照関係は論理的管理が必要
4. **バックアップ複雑性**: 複数データベースの一貫したバックアップ

## ベストプラクティス

### 1. データベース命名規則
```typescript
constructor(name: string = `hierarchidb-${pluginName}`) {
  super(name);
}
```

### 2. スキーマバージョニング
```typescript
this.version(1).stores({ /* schema v1 */ });
this.version(2).stores({ /* schema v2 */ }).upgrade(tx => {
  // マイグレーション処理
});
```

### 3. リソース管理
```typescript
// プラグイン無効化時のクリーンアップ
async cleanup(): Promise<void> {
  await this.pluginDB.close();
  console.log('Plugin database closed');
}
```

### 4. エラーハンドリング
```typescript
async createEntity(nodeId: NodeId, data: any): Promise<any> {
  try {
    return await this.pluginDB.myEntities.add(data);
  } catch (error) {
    console.error(`Plugin database error for ${nodeId}:`, error);
    throw new Error(`Failed to create entity: ${error.message}`);
  }
}
```

## まとめ

プラグインは完全に独立したデータベースを管理する責務を持ち、CoreDB/EphemeralDBに依存しない設計を採用します。これにより、プラグインシステムの柔軟性、保守性、パフォーマンスが向上し、真の意味でのプラグイン独立性が実現されます。