# Unified Batch Control API v2

プラグインのバッチ処理関係リファクタリングによって、location-plugin、shape-plugin、route-plugin の間でバッチ制御APIが統一されました。

## 機能フラグ

`BATCH_CONTROL_API_V2` 環境変数またはグローバルフラグで新しいAPIを有効化できます：

```bash
# 環境変数での有効化
export BATCH_CONTROL_API_V2=true

# または
export BATCH_CONTROL_API_V2=1
```

```javascript
// グローバルフラグでの有効化
globalThis.FEATURE_FLAGS = {
  BATCH_CONTROL_API_V2: true
};
```

## 統一されたインターフェース

すべてのプラグインで `IBatchSessionManager` インターフェースを実装：

```typescript
interface IBatchSessionManager {
  startBatchSession(nodeId: NodeId, config: any, data?: any): Promise<string>;
  pauseBatchSession(sessionId: string): Promise<void>;
  resumeBatchSession(sessionId: string): Promise<void>;
  cancelBatchSession(sessionId: string): Promise<void>;
  getBatchSessionStatus(sessionId: string): Promise<BatchSessionStatus>;
  onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void;
}
```

## 使用例

### Location Plugin

```typescript
import { createLocationBatchManager } from '@hierarchidb/location-plugin';

const manager = createLocationBatchManager();

// セッション開始
const sessionId = await manager.startBatchSession(nodeId, {
  concurrency: 4
}, {
  points: locationPoints,
  settings: tileSettings
});

// 進捗監視
const unsubscribe = manager.onBatchProgress(sessionId, (event) => {
  console.log(`Progress: ${event.percentage}% (${event.completed}/${event.total})`);
});

// 制御
await manager.pauseBatchSession(sessionId);
await manager.resumeBatchSession(sessionId);
await manager.cancelBatchSession(sessionId);
```

### Shape Plugin

```typescript
import { createShapeBatchManager } from '@hierarchidb/shape-plugin';

const manager = createShapeBatchManager();

const sessionId = await manager.startBatchSession(nodeId, {
  corsProxyBaseURL: 'https://proxy.example.com',
  maxRetries: 3,
  maxConcurrentTasks: 8
}, {
  urlMetadata: shapeUrlList
});
```

### Route Plugin

```typescript
import { createRouteBatchManager } from '@hierarchidb/route-plugin';

const manager = createRouteBatchManager();

const sessionId = await manager.startBatchSession(nodeId, {
  routeGeneration: {
    method: 'osm_route',
    parallel: true,
    maxConcurrent: 4
  }
}, {
  routes: routeDefinitions
});
```

## 統一された進捗イベント

すべてのプラグインが同じ `StandardProgressEvent` 形式を使用：

```typescript
interface StandardProgressEvent {
  sessionId: string;
  stage: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTask?: string;
  estimatedTimeRemaining?: number;
}
```

## 下位互換性

既存のバッチ管理クラスは引き続き動作します：

- `LocationBatchSessionManager`
- `BatchSessionManager` (shape)
- `RouteBatchManager`

フラグがOFFの場合、既存の動作が保持されます。

## ロールバック手順

問題が発生した場合：

1. 環境変数を削除または `false` に設定
2. グローバルフラグを `false` に設定
3. 既存のマネージャークラスを直接使用

```bash
# フラグを無効化
export BATCH_CONTROL_API_V2=false
```

## 実装詳細

### AbstractBatchSession 拡張

- `IBatchControlCommands` インターフェースを実装
- 統一されたコマンドハンドラ（start/pause/resume/cancel）
- 標準化された進捗更新機能

### Progress Infrastructure 昇格

- `ProgressEmitter` と `MemoryProgressStore` をruntime-sharedに移動
- route-pluginで共有進捗基盤を活用
- 統一されたスナップショット形式

### 各プラグインのファサード

各プラグインに `UnifiedXXXBatchManager` クラスを追加し、プラグイン固有の設定を統一インターフェースに変換します。

## テスト

統合テストで全プラグインのインターフェース統一性を検証：

```bash
pnpm --filter @hierarchidb/runtime-shared-batch-processor test
```