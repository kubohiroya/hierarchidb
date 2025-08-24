# プラグイン設定仕様（TypeScript版）

## 1. プラグイン設定の基本構造

### プラグイン設定ファイル例
```typescript
// plugins/basemap/basemap.plugin.ts
import type { PluginConfig } from '@hierarchidb/core';
import { TreeNodeType, LoadPriority } from '@hierarchidb/core';

export const basemapPlugin: PluginConfig = {
  id: 'com.example.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  description: 'Provides basemap functionality with map rendering',
  
  nodeTypes: [
    {
      type: TreeNodeType.BaseMap, // 列挙型を使用
      displayName: 'Base Map',
      icon: 'map',
      color: '#4CAF50'
    }
  ],
  
  database: {
    tables: [
      {
        name: 'basemaps',
        storage: 'core',
        schema: '&nodeId, name, mapStyle, updatedAt',
        indexes: ['mapStyle', 'updatedAt']
      },
      {
        name: 'basemap_workingcopies', 
        storage: 'ephemeral',
        schema: '&workingCopyId, workingCopyOf, copiedAt',
        ttl: 86400000 // 24時間
      },
      {
        name: 'basemap_tiles_cache',
        storage: 'ephemeral',
        schema: '&tileId, zoom, x, y, data, cachedAt',
        ttl: 3600000 // 1時間
      }
    ]
  },
  
  dependencies: {
    required: []
  },
  
  lifecycle: {
    hooks: {
      onInstall: async () => {
        // インストール時の処理
      },
      onEnable: async () => {
        // 有効化時の処理
      },
      onDisable: async () => {
        // 無効化時の処理
      },
      onUninstall: async () => {
        // アンインストール時の処理
      }
    },
    autoStart: true,
    loadPriority: LoadPriority.NORMAL
  },
  
  entityHandlers: {
    basemap: new BaseMapEntityHandler()
  }
} as const;
```

## 2. 依存関係のあるプラグイン例（routes → locations）

```typescript
// plugins/routes/routes.plugin.ts
import type { PluginConfig } from '@hierarchidb/core';
import { TreeNodeType, LoadPriority } from '@hierarchidb/core';
import { locationsPlugin } from '../locations/locations.plugin';

export const routesPlugin: PluginConfig = {
  id: 'com.example.routes',
  name: 'Routes Plugin',
  version: '1.0.0',
  
  nodeTypes: [
    {
      type: TreeNodeType.Route,
      displayName: 'Route',
      icon: 'route',
      color: '#2196F3'
    }
  ],
  
  database: {
    tables: [
      {
        name: 'routes',
        storage: 'core',
        schema: '&nodeId, name, startLocationId, endLocationId, waypoints, distance',
        indexes: ['startLocationId', 'endLocationId']
      },
      {
        name: 'route_calculations_cache',
        storage: 'ephemeral',
        schema: '&cacheKey, result, calculatedAt',
        ttl: 600000 // 10分
      }
    ]
  },
  
  dependencies: {
    required: [
      locationsPlugin.id // TypeScriptの参照により型安全
    ]
  },
  
  lifecycle: {
    hooks: {
      onEnable: async (context) => {
        // locationsテーブルの存在確認
        const hasLocations = await context.hasTable('locations');
        if (!hasLocations) {
          throw new Error('Locations table not found');
        }
      }
    },
    autoStart: true,
    loadPriority: LoadPriority.LOW // locationsの後に読み込む
  },
  
  entityHandlers: {
    route: new RouteEntityHandler()
  }
} as const;
```

## 3. 型定義

```typescript
// packages/core/src/types/plugin.ts

export interface PluginConfig {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  readonly license?: string;
  readonly homepage?: string;
  
  readonly nodeTypes: ReadonlyArray<NodeTypeConfig>;
  readonly database: DatabaseConfig;
  readonly dependencies: DependencyConfig;
  readonly lifecycle: LifecycleConfig;
  readonly entityHandlers: Record<string, EntityHandler>;
  readonly configuration?: ConfigurationSchema;
}

export interface NodeTypeConfig {
  readonly type: TreeNodeType;
  readonly displayName: string;
  readonly icon?: string;
  readonly color?: string;
  readonly maxChildren?: number;
  readonly allowedChildTypes?: ReadonlyArray<TreeNodeType>;
}

export interface DatabaseConfig {
  readonly tables: ReadonlyArray<TableConfig>;
}

export interface TableConfig {
  readonly name: string;
  readonly storage: 'core' | 'ephemeral';
  readonly schema: string; // Dexie schema string
  readonly indexes?: ReadonlyArray<string>;
  readonly ttl?: number; // milliseconds (ephemeralのみ)
  readonly autoCleanup?: boolean;
}

export interface DependencyConfig {
  readonly required?: ReadonlyArray<string>; // plugin IDs
}

export interface LifecycleConfig {
  readonly hooks?: {
    readonly onInstall?: (context: PluginContext) => Promise<void>;
    readonly onEnable?: (context: PluginContext) => Promise<void>;
    readonly onDisable?: (context: PluginContext) => Promise<void>;
    readonly onUninstall?: (context: PluginContext) => Promise<void>;
  };
  readonly autoStart?: boolean;
  readonly loadPriority?: LoadPriority;
}

export interface PluginContext {
  readonly coreDB: CoreDB;
  readonly ephemeralDB: EphemeralDB;
  readonly hasTable: (tableName: string) => Promise<boolean>;
  readonly getPlugin: (pluginId: string) => PluginConfig | undefined;
}

export enum LoadPriority {
  CRITICAL = 0,
  HIGH = 100,
  NORMAL = 500,
  LOW = 1000,
  DEFERRED = 9999
}

export interface ConfigurationSchema {
  readonly [key: string]: ConfigurationField;
}

export interface ConfigurationField {
  readonly type: 'string' | 'number' | 'boolean';
  readonly default?: any;
  readonly enum?: ReadonlyArray<any>;
  readonly min?: number;
  readonly max?: number;
  readonly required?: boolean;
  readonly description?: string;
}
```

## 4. プラグインローダー

```typescript
// packages/worker/src/plugin/PluginLoader.ts

export class PluginLoader {
  private plugins: Map<string, PluginConfig> = new Map();
  private loadOrder: string[] = [];
  
  async loadPlugin(plugin: PluginConfig): Promise<void> {
    // 1. 依存関係チェック
    if (plugin.dependencies?.required) {
      for (const depId of plugin.dependencies.required) {
        if (!this.plugins.has(depId)) {
          throw new Error(`Missing dependency: ${depId}`);
        }
      }
    }
    
    // 2. データベーステーブル作成
    await this.createTables(plugin.database);
    
    // 3. エンティティハンドラー登録
    this.registerEntityHandlers(plugin.entityHandlers);
    
    // 4. ライフサイクルフック実行
    const context = this.createContext();
    await plugin.lifecycle?.hooks?.onInstall?.(context);
    
    if (plugin.lifecycle?.autoStart) {
      await plugin.lifecycle?.hooks?.onEnable?.(context);
    }
    
    this.plugins.set(plugin.id, plugin);
    this.updateLoadOrder();
  }
  
  private async createTables(config: DatabaseConfig): Promise<void> {
    for (const table of config.tables) {
      if (table.storage === 'core') {
        await this.createCoreTable(table);
      } else {
        await this.createEphemeralTable(table);
      }
    }
  }
  
  private async createCoreTable(table: TableConfig): Promise<void> {
    // CoreDBにテーブル作成
    // 実装省略
  }
  
  private async createEphemeralTable(table: TableConfig): Promise<void> {
    // EphemeralDBにテーブル作成
    if (table.ttl) {
      // TTL付きテーブルの設定
      this.scheduleCleanup(table);
    }
  }
  
  private scheduleCleanup(table: TableConfig): void {
    if (!table.ttl) return;
    
    setInterval(async () => {
      const cutoff = Date.now() - table.ttl!;
      // 期限切れデータの削除
      // 実装省略
    }, Math.min(table.ttl, 3600000)); // 最大1時間ごと
  }
  
  private updateLoadOrder(): void {
    // loadPriorityに基づいてソート
    this.loadOrder = Array.from(this.plugins.keys()).sort((a, b) => {
      const priorityA = this.plugins.get(a)!.lifecycle?.loadPriority ?? LoadPriority.NORMAL;
      const priorityB = this.plugins.get(b)!.lifecycle?.loadPriority ?? LoadPriority.NORMAL;
      return priorityA - priorityB;
    });
  }
}
```

## 5. 使用例：プラグインの登録

```typescript
// packages/worker/src/plugins/index.ts
import { basemapPlugin } from './basemap/basemap.plugin';
import { shapesPlugin } from './shapes/shapes.plugin';
import { locationsPlugin } from './locations/locations.plugin';
import { routesPlugin } from './routes/routes.plugin';

export const defaultPlugins = [
  // 依存関係の順序で登録
  basemapPlugin,
  shapesPlugin,
  locationsPlugin, // routesの前に必要
  routesPlugin,
] as const;

// Worker初期化時
export async function initializePlugins(loader: PluginLoader): Promise<void> {
  for (const plugin of defaultPlugins) {
    await loader.loadPlugin(plugin);
  }
}
```

## 6. TTL管理の実装例

```typescript
// packages/worker/src/plugin/TTLManager.ts

export class TTLManager {
  private cleanupTasks: Map<string, NodeJS.Timeout> = new Map();
  
  registerTable(tableName: string, table: TableConfig, db: Dexie): void {
    if (table.storage !== 'ephemeral' || !table.ttl) return;
    
    const cleanup = async () => {
      const cutoff = Date.now() - table.ttl!;
      
      await db.transaction('rw', db.table(tableName), async () => {
        // TTLフィールドに基づいて削除
        await db.table(tableName)
          .where('createdAt').below(cutoff)
          .or('copiedAt').below(cutoff)
          .delete();
      });
    };
    
    // 定期実行
    const interval = Math.min(table.ttl, 3600000); // 最大1時間ごと
    const taskId = setInterval(cleanup, interval);
    this.cleanupTasks.set(tableName, taskId);
    
    // 初回実行
    cleanup();
  }
  
  unregisterTable(tableName: string): void {
    const taskId = this.cleanupTasks.get(tableName);
    if (taskId) {
      clearInterval(taskId);
      this.cleanupTasks.delete(tableName);
    }
  }
}
```

## まとめ

この TypeScript ベースの設定により：

1. **型安全性**: 既存の型定義や列挙型を活用
2. **シンプルな依存管理**: requiredのみでデータベース経由の連携
3. **自動TTL管理**: ephemeralテーブルの自動クリーンアップ
4. **読み込み優先度**: 依存関係に基づく適切な初期化順序
5. **実装の統合**: 設定と実装コードを同じファイルに記述可能

この仕様でよろしいでしょうか？追加や修正が必要な点があれば教えてください。