# BaseMap Plugin Lifecycle Management

BaseMapプラグインのライフサイクル管理、プラグイン統合、およびNodeLifecycleManagerとの連携について説明します。

## プラグインライフサイクル概要

BaseMapプラグインは、HierarchiDBのプラグインシステムに統合され、以下のライフサイクルステージを経ます：

```
Install → Enable → [Active State] → Disable → Uninstall
```

### ライフサイクルステート

1. **Install**: プラグインの初期インストール
2. **Enable**: プラグインの有効化とリソース初期化
3. **Active**: 通常動作状態でのノード操作
4. **Disable**: プラグインの無効化とリソース解放
5. **Uninstall**: プラグインの完全除去

## プラグイン統合設定

### plugin.config.ts でのライフサイクル定義

```typescript
export const basemapPlugin: PluginConfig = {
  id: 'com.example.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  description: 'Provides basemap functionality with map rendering and tile caching',

  nodeTypes: [
    {
      type: 'basemap',
      displayName: 'Base Map',
      icon: 'map',
      color: '#4CAF50',
    },
  ],

  database: {
    tables: [
      {
        name: 'basemaps',
        storage: 'core',
        schema: '&nodeId, name, mapStyle, updatedAt',
        indexes: ['mapStyle', 'updatedAt'],
      },
      {
        name: 'basemap_workingcopies',
        storage: 'ephemeral',
        schema: '&workingCopyId, workingCopyOf, copiedAt',
        ttl: 86400000, // 24時間
      },
      {
        name: 'basemap_tiles_cache',
        storage: 'ephemeral',
        schema: '&tileId, zoom, x, y, cachedAt',
        ttl: 3600000, // 1時間
      },
    ],
  },

  lifecycle: {
    hooks: {
      onInstall: async (context: PluginContext) => {
        console.log('BaseMap plugin installed');
        await initializeDatabase(context);
      },
      onEnable: async (context: PluginContext) => {
        console.log('BaseMap plugin enabled');
        await startBackgroundServices(context);
      },
      onDisable: async (context: PluginContext) => {
        console.log('BaseMap plugin disabled');
        await stopBackgroundServices(context);
      },
      onUninstall: async (context: PluginContext) => {
        console.log('BaseMap plugin uninstalled');
        await cleanupResources(context);
      },
    },
    autoStart: true,
  },

  entityHandlers: {
    basemap: new BaseMapEntityHandler(),
  },
};
```

## NodeLifecycleManager統合

### BaseMapDefinition.ts でのライフサイクルフック

```typescript
const baseMapLifecycle: NodeLifecycleHooks<BaseMapEntity, BaseMapWorkingCopy> = {
  // ノード作成前の検証
  beforeCreate: async (parentId: NodeId, nodeData: Partial<BaseMapEntity>) => {
    // 座標検証
    if (nodeData.center) {
      const [lng, lat] = nodeData.center;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(
          'Invalid coordinates: longitude must be between -180 and 180, latitude between -90 and 90'
        );
      }
    }

    // ズームレベル検証
    if (nodeData.zoom !== undefined) {
      if (nodeData.zoom < 0 || nodeData.zoom > 22) {
        throw new Error('Invalid zoom level: must be between 0 and 22');
      }
    }

    // 地図スタイル検証
    if (nodeData.mapStyle === 'custom') {
      if (!nodeData.styleUrl && !nodeData.styleConfig) {
        throw new Error('Custom map style requires either styleUrl or styleConfig');
      }
    }

    // 親ノード制約チェック
    await validateParentNodeConstraints(parentId);
  },

  // ノード作成後の初期化
  afterCreate: async (nodeId: NodeId, entity: BaseMapEntity) => {
    // ログ出力
    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap created: ${nodeId} - ${entity.name}`);
    }

    // 外部リソースの事前取得
    await prefetchMapResources(entity);

    // サムネイル生成
    await generateThumbnail(nodeId, entity);

    // 関連エンティティの初期化
    await initializeRelatedEntities(nodeId, entity);
  },

  // ノード更新前の検証
  beforeUpdate: async (nodeId: NodeId, changes: Partial<BaseMapEntity>) => {
    // 変更内容の検証
    if (changes.center) {
      const [lng, lat] = changes.center;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error('Invalid coordinates in update');
      }
    }

    // スタイル変更の検証
    if (changes.mapStyle === 'custom' && changes.styleUrl) {
      await validateStyleUrl(changes.styleUrl);
    }

    // 依存関係チェック
    await checkDependencies(nodeId, changes);
  },

  // ノード更新後の処理
  afterUpdate: async (nodeId: NodeId, entity: BaseMapEntity) => {
    // キャッシュクリア
    await clearRelatedCaches(nodeId);

    // サムネイル更新
    await updateThumbnail(nodeId, entity);

    // 関連ノードへの通知
    await notifyRelatedNodes(nodeId, entity);

    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap updated: ${nodeId}`);
    }
  },

  // ノード削除前の準備
  beforeDelete: async (nodeId: NodeId) => {
    // 削除可能性チェック
    await checkDeletionConstraints(nodeId);

    // 関連データのバックアップ
    await backupRelatedData(nodeId);

    // 依存関係の確認
    await checkDependentNodes(nodeId);

    if (process.env.NODE_ENV === 'development') {
      console.log(`Preparing to delete BaseMap: ${nodeId}`);
    }
  },

  // ノード削除後のクリーンアップ
  afterDelete: async (nodeId: NodeId) => {
    // タイルキャッシュクリア
    await clearTileCache(nodeId);

    // 外部リソースクリーンアップ
    await cleanupExternalResources(nodeId);

    // 関連エンティティ削除
    await deleteRelatedEntities(nodeId);

    // ファイルシステムクリーンアップ
    await cleanupFileSystemResources(nodeId);

    if (process.env.NODE_ENV === 'development') {
      console.log(`BaseMap deleted: ${nodeId}`);
    }
  },

  // 作業コピーコミット前の検証
  beforeCommit: async (nodeId: NodeId, workingCopy: BaseMapWorkingCopy) => {
    // 作業コピーの整合性チェック
    if (!workingCopy.isDirty) {
      console.warn('Committing working copy with no changes');
    }

    // データ整合性検証
    await validateWorkingCopyIntegrity(workingCopy);

    // バージョン競合チェック
    await checkVersionConflicts(nodeId, workingCopy);
  },

  // 作業コピーコミット後の処理
  afterCommit: async (nodeId: NodeId, entity: BaseMapEntity) => {
    // UI更新トリガー
    await triggerUIRefresh(nodeId);

    // 関連システムへの通知
    await notifyExternalSystems(nodeId, entity);

    // 監査ログ記録
    await recordAuditLog(nodeId, 'commit', entity);

    if (process.env.NODE_ENV === 'development') {
      console.log(`Working copy committed for BaseMap: ${nodeId}`);
    }
  },
};
```

## ライフサイクルフック実装詳細

### 1. プラグインレベルのライフサイクル

#### インストール処理

```typescript
async function initializeDatabase(context: PluginContext): Promise<void> {
  try {
    const db = BaseMapDatabase.getInstance();
    await db.open();
    
    // インデックス作成
    await db.transaction('rw', db.basemaps, async () => {
      // 初期データがあれば挿入
      await insertDefaultMapStyles();
    });

    console.log('BaseMap database initialized');
  } catch (error) {
    console.error('Failed to initialize BaseMap database:', error);
    throw error;
  }
}

async function insertDefaultMapStyles(): Promise<void> {
  const defaultStyles = [
    {
      id: 'osm-streets',
      name: 'OpenStreetMap Streets',
      styleConfig: MAP_STYLE_PRESETS.streets,
    },
    {
      id: 'osm-satellite',
      name: 'Satellite Imagery',
      styleConfig: MAP_STYLE_PRESETS.satellite,
    },
  ];

  // プリセットスタイルをシステムに登録
  await registerDefaultStyles(defaultStyles);
}
```

#### 有効化処理

```typescript
async function startBackgroundServices(context: PluginContext): Promise<void> {
  // タイルキャッシュクリーンアップサービス開始
  startTileCacheCleanup();
  
  // 外部地図サービス接続チェック
  await checkExternalMapServices();
  
  // パフォーマンス監視開始
  startPerformanceMonitoring();
  
  console.log('BaseMap background services started');
}

function startTileCacheCleanup(): void {
  const cleanupInterval = setInterval(async () => {
    try {
      const db = BaseMapDatabase.getInstance();
      await db.cleanupExpiredEntries();
      console.log('Tile cache cleanup completed');
    } catch (error) {
      console.error('Tile cache cleanup failed:', error);
    }
  }, 3600000); // 1時間ごと

  // クリーンアップ間隔の参照を保存（無効化時に使用）
  BaseMapPluginState.cleanupInterval = cleanupInterval;
}
```

### 2. ノードレベルのライフサイクル

#### 作成時の検証と初期化

```typescript
async function validateParentNodeConstraints(parentId: NodeId): Promise<void> {
  // 親ノードの種類チェック
  const parentNode = await getTreeNode(parentId);
  if (!parentNode) {
    throw new Error('Parent node not found');
  }

  // BaseMapノードが作成可能な親ノードタイプをチェック
  const allowedParentTypes = ['root', 'folder', 'project'];
  if (!allowedParentTypes.includes(parentNode.nodeType)) {
    throw new Error(`BaseMap cannot be created under ${parentNode.nodeType} node`);
  }

  // 親ノード下のBaseMapノード数制限チェック
  const existingBaseMaps = await countChildBaseMaps(parentId);
  if (existingBaseMaps >= MAX_BASEMAPS_PER_PARENT) {
    throw new Error(`Maximum ${MAX_BASEMAPS_PER_PARENT} base maps allowed per parent`);
  }
}

async function prefetchMapResources(entity: BaseMapEntity): Promise<void> {
  // APIキーの有効性確認
  if (entity.apiKey) {
    await validateApiKey(entity.apiKey);
  }

  // カスタムスタイルの事前検証
  if (entity.mapStyle === 'custom' && entity.styleUrl) {
    await validateAndCacheStyle(entity.styleUrl);
  }

  // 中心座標周辺のタイルプリフェッチ
  await prefetchSurroundingTiles(entity.center, entity.zoom);
}

async function generateThumbnail(nodeId: NodeId, entity: BaseMapEntity): Promise<void> {
  try {
    // 地図のスクリーンショット生成
    const thumbnailBlob = await captureMapThumbnail(entity);
    
    // サムネイルをストレージに保存
    const thumbnailUrl = await saveMapThumbnail(nodeId, thumbnailBlob);
    
    // エンティティにサムネイルURL設定
    await updateEntityThumbnail(nodeId, thumbnailUrl);
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    // サムネイル生成失敗は致命的ではないので続行
  }
}
```

#### 更新時の処理

```typescript
async function clearRelatedCaches(nodeId: NodeId): Promise<void> {
  const db = BaseMapDatabase.getInstance();
  
  // ノードに関連するタイルキャッシュをクリア
  await db.basemap_tiles_cache
    .where('nodeId')
    .equals(nodeId)
    .delete();

  // 関連する作業コピーも更新
  await db.basemap_workingcopies
    .where('workingCopyOf')
    .equals(nodeId)
    .modify({ isDirty: true });
}

async function notifyRelatedNodes(nodeId: NodeId, entity: BaseMapEntity): Promise<void> {
  // 地図を参照している他のノードに変更を通知
  const referencingNodes = await findNodesReferencingMap(nodeId);
  
  for (const refNode of referencingNodes) {
    await notifyNodeOfMapChange(refNode.id, nodeId, entity);
  }

  // 購読者への通知
  await notifySubscribers(nodeId, 'map-updated', entity);
}
```

#### 削除時のクリーンアップ

```typescript
async function checkDeletionConstraints(nodeId: NodeId): Promise<void> {
  // 他のノードからの参照チェック
  const references = await findNodesReferencingMap(nodeId);
  if (references.length > 0) {
    throw new Error(
      `Cannot delete map: referenced by ${references.length} other nodes`
    );
  }

  // 作業コピーの存在チェック
  const activeWorkingCopies = await findActiveWorkingCopies(nodeId);
  if (activeWorkingCopies.length > 0) {
    throw new Error(
      'Cannot delete map: active working copies exist. Please commit or discard them first.'
    );
  }
}

async function cleanupExternalResources(nodeId: NodeId): Promise<void> {
  // サムネイル画像削除
  await deleteMapThumbnail(nodeId);
  
  // 外部APIリソース解放
  await releaseApiResources(nodeId);
  
  // ファイルシステムクリーンアップ
  await cleanupMapFiles(nodeId);
  
  // 統計データクリーンアップ
  await cleanupMapStatistics(nodeId);
}
```

### 3. 作業コピーライフサイクル

#### 作業コピー作成

```typescript
async function createWorkingCopyWithLifecycle(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
  // ライフサイクルフック: beforeWorkingCopyCreate
  await executeHook('beforeWorkingCopyCreate', nodeId);

  // 作業コピー作成
  const handler = new BaseMapEntityHandler();
  const workingCopy = await handler.createWorkingCopy(nodeId);

  // ライフサイクルフック: afterWorkingCopyCreate
  await executeHook('afterWorkingCopyCreate', nodeId, workingCopy);

  return workingCopy;
}
```

#### 作業コピーコミット

```typescript
async function validateWorkingCopyIntegrity(workingCopy: BaseMapWorkingCopy): Promise<void> {
  // データ整合性チェック
  if (!workingCopy.nodeId || !workingCopy.workingCopyOf) {
    throw new Error('Working copy missing required references');
  }

  // 地図設定の検証
  await validateMapConfiguration(workingCopy);

  // スタイル設定の検証
  if (workingCopy.styleConfig) {
    await validateMapLibreStyle(workingCopy.styleConfig);
  }
}

async function checkVersionConflicts(nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
  const currentEntity = await getBaseMapEntity(nodeId);
  if (!currentEntity) {
    throw new Error('Entity not found for working copy commit');
  }

  if (currentEntity.version > workingCopy.originalVersion) {
    throw new Error(
      'Version conflict: entity has been modified by another process. Please refresh and try again.'
    );
  }
}
```

## エラーハンドリングとロールバック

### エラーリカバリ戦略

```typescript
class BaseMapLifecycleManager {
  async executeWithRollback<T>(
    operation: () => Promise<T>,
    rollbackOperations: (() => Promise<void>)[]
  ): Promise<T> {
    const completedOperations: (() => Promise<void>)[] = [];

    try {
      const result = await operation();
      return result;
    } catch (error) {
      // エラー発生時のロールバック
      console.error('Operation failed, executing rollback:', error);
      
      for (const rollback of completedOperations.reverse()) {
        try {
          await rollback();
        } catch (rollbackError) {
          console.error('Rollback operation failed:', rollbackError);
        }
      }

      throw error;
    }
  }

  async safeCreateMap(nodeId: NodeId, data: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    const rollbackOperations: (() => Promise<void>)[] = [];

    return this.executeWithRollback(
      async () => {
        // ノード作成
        const node = await createTreeNode(nodeId, data);
        rollbackOperations.push(() => deleteTreeNode(nodeId));

        // エンティティ作成
        const entity = await createBaseMapEntity(nodeId, data);
        rollbackOperations.push(() => deleteBaseMapEntity(nodeId));

        // 外部リソース初期化
        await initializeExternalResources(nodeId, entity);
        rollbackOperations.push(() => cleanupExternalResources(nodeId));

        return entity;
      },
      rollbackOperations
    );
  }
}
```

### 監査ログ

```typescript
interface AuditLogEntry {
  timestamp: number;
  nodeId: NodeId;
  operation: 'create' | 'update' | 'delete' | 'commit' | 'rollback';
  userId?: string;
  changes?: Partial<BaseMapEntity>;
  metadata?: Record<string, unknown>;
}

async function recordAuditLog(
  nodeId: NodeId,
  operation: AuditLogEntry['operation'],
  entity?: BaseMapEntity,
  changes?: Partial<BaseMapEntity>
): Promise<void> {
  const logEntry: AuditLogEntry = {
    timestamp: Date.now(),
    nodeId,
    operation,
    changes,
    metadata: {
      version: entity?.version,
      mapStyle: entity?.mapStyle,
      userAgent: navigator?.userAgent,
    },
  };

  // 監査ログをデータベースに記録
  await recordSystemAuditLog('basemap', logEntry);
}
```

## パフォーマンス監視

### メトリクス収集

```typescript
class BaseMapPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordOperation(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  async measureOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordOperation(operation, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordOperation(`${operation}_error`, duration);
      throw error;
    }
  }

  getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};
    
    for (const [operation, durations] of this.metrics) {
      result[operation] = {
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        count: durations.length,
      };
    }

    return result;
  }
}

// グローバルインスタンス
export const baseMapPerformanceMonitor = new BaseMapPerformanceMonitor();
```

## トラブルシューティング

### 一般的な問題と解決方法

#### 1. ライフサイクルフックのエラー

```typescript
// エラーの詳細ログ
async function executeHookSafely(
  hookName: string,
  nodeId: NodeId,
  ...args: unknown[]
): Promise<void> {
  try {
    await executeHook(hookName, nodeId, ...args);
  } catch (error) {
    console.error(`Lifecycle hook ${hookName} failed for node ${nodeId}:`, error);
    
    // 非致命的なエラーの場合は警告のみ
    if (isNonCriticalHookError(error)) {
      console.warn(`Non-critical hook error ignored: ${error.message}`);
      return;
    }

    // 致命的なエラーの場合は再スロー
    throw error;
  }
}
```

#### 2. データベース接続問題

```typescript
async function ensureDatabaseConnection(): Promise<void> {
  const db = BaseMapDatabase.getInstance();
  
  if (!db.isOpen()) {
    try {
      await db.open();
    } catch (error) {
      console.error('Failed to open BaseMap database:', error);
      throw new Error('Database connection failed');
    }
  }
}
```

#### 3. メモリリーク対策

```typescript
class ResourceManager {
  private resources: Set<() => void> = new Set();

  addCleanupResource(cleanup: () => void): void {
    this.resources.add(cleanup);
  }

  cleanup(): void {
    for (const cleanup of this.resources) {
      try {
        cleanup();
      } catch (error) {
        console.error('Resource cleanup failed:', error);
      }
    }
    this.resources.clear();
  }
}

// プラグイン無効化時のリソース管理
export const baseMapResourceManager = new ResourceManager();
```

このライフサイクル管理システムにより、BaseMapプラグインはHierarchiDBシステムと密接に統合され、安全で効率的な動作を実現します。