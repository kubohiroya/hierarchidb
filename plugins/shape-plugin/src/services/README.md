# Shape Plugin Services 実装設計

## 📁 ファイル構成

```
packages/plugins/shape/src/services/
├── README.md                          # このファイル
├── openstreetmap-type.ts                           # エクスポート管理
│
├── api/                               # PluginAPI実装
│   ├── ShapesPluginAPI.ts           # PluginAPI定義
│   ├── ShapesWorkerExtensions.ts    # Worker拡張メソッド
│   └── openstreetmap-type.ts
│
├── core/                              # コアサービス
│   ├── ShapesService.ts             # メインサービス実装
│   ├── ShapesEntityHandler.ts       # エンティティハンドラ
│   ├── ShapesLifecycleManager.ts    # ライフサイクル管理
│   └── openstreetmap-type.ts
│
├── batch/                             # バッチ処理
│   ├── BatchSessionManager.ts       # セッション管理
│   ├── BatchTaskQueue.ts            # タスクキュー管理
│   ├── BatchProgressTracker.ts      # 進捗追跡
│   └── openstreetmap-type.ts
│
├── strategies/                        # データソース戦略
│   ├── DataSourceStrategy.ts          # 基底戦略インターフェース
│   ├── NaturalEarthStrategy.ts        # Natural Earth実装
│   ├── GeoBoundariesStrategy.ts       # GeoBoundaries実装
│   ├── GADMStrategy.ts                # GADM実装
│   ├── OpenStreetMapStrategy.ts       # OSM実装
│   └── openstreetmap-type.ts
│
├── database/                          # データベース層
│   ├── ShapesDB.ts                  # メインDB（Dexie）
│   ├── FeatureIndexDB.ts            # フィーチャーインデックス
│   ├── FeatureBufferDB.ts           # フィーチャーバッファ
│   ├── TileBufferDB.ts              # タイルバッファ
│   ├── VectorTileDB.ts              # ベクタータイル
│   └── openstreetmap-type.ts
│
├── utils/                             # ユーティリティ
│   ├── geospatial/
│   │   ├── morton.ts                # Morton符号計算
│   │   ├── bbox.ts                  # バウンディングボックス
│   │   ├── area.ts                  # 面積計算
│   │   └── simplification.ts        # 簡略化ユーティリティ
│   │
│   ├── compression/
│   │   ├── geobuf.ts                # Geobufエンコード/デコード
│   │   ├── topobuf.ts               # Topobufエンコード/デコード
│   │   └── mvt.ts                   # MVT変換
│   │
│   └── validation/
│       ├── configValidator.ts        # 設定検証
│       ├── dataValidator.ts          # データ検証
│       └── openstreetmap-type.ts
│
└── types/                             # 内部型定義
    ├── internal.ts                   # サービス内部型
    ├── worker-messages.ts            # Worker通信型
    └── database-schema.ts            # DBスキーマ型
```

## 🏗️ PluginAPI 統合設計

### 1. ShapesPluginAPI 実装

```typescript
// api/ShapesPluginAPI.ts
import { PluginAPI, WorkerAPIMethod } from '@hierarchidb/api';
import type { NodeId, TreeNodeType } from '@hierarchidb/core';

export interface ShapesAPIMethods {
  // バッチ処理制御
  startBatchProcess: WorkerAPIMethod<
    [nodeId: NodeId, config: ProcessingConfig, downloadTaskPayloads: DownloadTaskPayload[]],
    { batchId: string; sessionId: string }
  >;
  
  pauseBatchProcessing: WorkerAPIMethod<
    [batchId: string],
    void
  >;
  
  resumeBatchProcessing: WorkerAPIMethod<
    [batchId: string],
    void
  >;
  
  // バッチ状態取得
  getBatchStatus: WorkerAPIMethod<
    [batchId: string],
    BatchSessionStatus
  >;
  
  getBatchTasks: WorkerAPIMethod<
    [batchId: string],
    BatchTask[]
  >;
  
  // キャッシュ管理
  clearCache: WorkerAPIMethod<
    [nodeId: NodeId, cacheType?: 'all' | 'download' | 'tiles'],
    void
  >;
  
  getCacheStatistics: WorkerAPIMethod<
    [nodeId: NodeId],
    CacheStatistics
  >;
  
  // ベクタータイル取得
  getVectorTile: WorkerAPIMethod<
    [nodeId: NodeId, z: number, x: number, y: number],
    Uint8Array | null
  >;
  
  // データエクスポート
  exportProcessedData: WorkerAPIMethod<
    [nodeId: NodeId, format: 'geojson' | 'mvt' | 'pmtiles'],
    Blob
  >;
}

export class ShapesPluginAPI implements PluginAPI<ShapesAPIMethods> {
  readonly nodeType: TreeNodeType = 'shape';
  readonly methods: ShapesAPIMethods;
  
  constructor(private service: ShapesService) {
    this.methods = this.createMethods();
  }
  
  private createMethods(): ShapesAPIMethods {
    return {
      startBatchProcess: async (nodeId, config, downloadTaskPayloads) => {
        return await this.service.startBatchProcess(nodeId, config, downloadTaskPayloads);
      },
      
      pauseBatchProcessing: async (batchId) => {
        await this.service.pauseBatch(batchId);
      },
      
      resumeBatchProcessing: async (batchId) => {
        await this.service.resumeBatch(batchId);
      },
      
      getBatchStatus: async (batchId) => {
        return await this.service.getBatchStatus(batchId);
      },
      
      getBatchTasks: async (batchId) => {
        return await this.service.getBatchTasks(batchId);
      },
      
      clearCache: async (nodeId, cacheType = 'all') => {
        await this.service.clearCache(nodeId, cacheType);
      },
      
      getCacheStatistics: async (nodeId) => {
        return await this.service.getCacheStatistics(nodeId);
      },
      
      getVectorTile: async (nodeId, z, x, y) => {
        return await this.service.getVectorTile(nodeId, z, x, y);
      },
      
      exportProcessedData: async (nodeId, format) => {
        return await this.service.exportData(nodeId, format);
      }
    };
  }
}
```

### 2. Worker層の統合（runtime-worker）

```typescript
// api/ShapesWorkerExtensions.ts
import { WorkerAPIExtension } from '@hierarchidb/worker';
import { ShapesPluginAPI } from './ShapesPluginAPI';
import { ShapesService } from '../core/ShapesService';

export class ShapesWorkerExtensions implements WorkerAPIExtension {
  private shapesAPI: ShapesPluginAPI;
  private service: ShapesService;
  
  constructor() {
    this.service = new ShapesService();
    this.shapesAPI = new ShapesPluginAPI(this.service);
  }
  
  async initialize(): Promise<void> {
    // データベース初期化
    await this.service.initialize();
    
    // runtime-worker-worker を用いた統合。従来の WorkerPool 初期化は廃止済み。
  }
  
  getPluginAPI(): ShapesPluginAPI {
    return this.shapesAPI;
  }
  
  async terminate(): Promise<void> {
    await this.service.terminate();
  }
}
```

## 🔄 サービス統合フロー

### 1. 初期化フロー

```typescript
// Worker側（packages/worker/src/plugin/PluginLoader.ts）で登録
import { ShapesWorkerExtensions } from '@hierarchidb/plugin-shape-plugin';

class PluginLoader {
  async loadPlugin(nodeType: 'shape') {
    const extension = new ShapesWorkerExtensions();
    await extension.initialize();
    
    // PluginAPI登録
    this.registry.register(extension.getPluginAPI());
  }
}
```

### 2. UI側からの呼び出し

```typescript
// UI側のフック（packages/plugin-loader/shape-plugin/src/hooks/useShapesAPI.ts）
import { useWorkerAPI } from '@hierarchidb/ui-client';
import type { ShapesAPIMethods } from '../services/api/ShapesPluginAPI';

export function useShapesAPI() {
  const workerAPI = useWorkerAPI();
  
  const startBatchProcess = useCallback(
    async (nodeId: NodeId, config: ProcessingConfig, downloadTaskPayloads: DownloadTaskPayload[]) => {
      // PluginAPI経由でWorker側のメソッドを呼び出し
      return await workerAPI.invokePluginMethod<ShapesAPIMethods>(
        'shape',
        'startBatchProcess',
        nodeId,
        config,
        downloadTaskPayloads
      );
    },
    [workerAPI]
  );
  
  const getBatchStatus = useCallback(
    async (batchId: string) => {
      return await workerAPI.invokePluginMethod<ShapesAPIMethods>(
        'shape',
        'getBatchStatus',
        batchId
      );
    },
    [workerAPI]
  );
  
  return {
    startBatchProcess,
    getBatchStatus,
    // ... 他のメソッド
  };
}
```

## 🚀 実装優先順位

### Phase 1: 基盤構築
1. **データベース層** (`database/`)
   - ShapesDB, FeatureIndexDB, FeatureBufferDB実装
   - Dexieスキーマ定義

2. **PluginAPI基盤** (`api/`)
   - ShapesPluginAPI実装
   - WorkerExtensions統合

3. **コアサービス** (`core/`)
   - ShapesService基本実装
   - EntityHandler実装

### Phase 2〜4: runtime-worker への移行
- 旧 WorkerPool/ローカルWorker 実装は削除済み。Download/Simplify/VectorTile は `@hierarchidb/runtime-worker` に委譲します。

### Phase 5: バッチ処理統合
1. **BatchSessionManager** (`batch/`)
   - セッション管理
   - 進捗追跡

## 📝 実装上の注意点

1. **Worker通信**
   - Comlinkを使用した型安全な通信
   - Transferableオブジェクトの活用

2. **メモリ管理**
   - 大規模データのストリーミング処理
   - 適切なガベージコレクション

3. **エラーハンドリング**
   - Worker障害時の自動復旧
   - 部分的な処理失敗の継続

4. **パフォーマンス**
   - 並列処理の最適化
   - キャッシュ戦略の実装

5. **テスタビリティ**
   - モックサービスの提供
   - 単体テストの容易性
