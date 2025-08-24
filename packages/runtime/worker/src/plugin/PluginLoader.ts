import type { NodeType } from '@hierarchidb/common-core';
import type { NodeTypeRegistry } from '~/registry';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';
import type { EntityHandler } from '../handlers/types';
import { workerError } from '../utils/workerLogger';

/**
 * プラグイン設定の型定義
 */
export interface PluginConfig {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly nodeTypes: ReadonlyArray<NodeTypeConfig>;
  readonly database: DatabaseConfig;
  readonly dependencies?: DependencyConfig;
  readonly lifecycle?: LifecycleConfig;
  readonly entityHandlers: Record<string, EntityHandler<any, any, any>>;
}

export interface NodeTypeConfig {
  readonly type: string;
  readonly displayName: string;
  readonly icon?: string;
  readonly color?: string;
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
  DEFERRED = 9999,
}

/**
 * プラグインローダー
 * プラグインの登録、依存関係解決、テーブル作成を管理
 */
export class PluginLoader {
  private plugins: Map<string, PluginConfig> = new Map();
  private loadOrder: string[] = [];
  private cleanupTasks: Map<string, NodeJS.Timeout> = new Map();
  private dynamicTables: Map<string, string> = new Map(); // tableName -> pluginId

  constructor(
    private coreDB: CoreDB,
    private ephemeralDB: EphemeralDB,
    private registry: NodeTypeRegistry
  ) {}

  /**
   * プラグインを読み込む
   */
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
    await this.createTables(plugin);

    // 3. エンティティハンドラー登録
    this.registerEntityHandlers(plugin);

    // 4. ライフサイクルフック実行
    const context = this.createContext();
    await plugin.lifecycle?.hooks?.onInstall?.(context);

    if (plugin.lifecycle?.autoStart) {
      await plugin.lifecycle?.hooks?.onEnable?.(context);
    }

    this.plugins.set(plugin.id, plugin);
    this.updateLoadOrder();
  }

  /**
   * プラグインをアンロード
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // ライフサイクルフック実行
    const context = this.createContext();
    await plugin.lifecycle?.hooks?.onDisable?.(context);
    await plugin.lifecycle?.hooks?.onUninstall?.(context);

    // クリーンアップタスクの停止
    for (const table of plugin.database.tables) {
      this.stopCleanupTask(table.name);
    }

    // プラグイン削除
    this.plugins.delete(pluginId);
    this.updateLoadOrder();
  }

  /**
   * テーブルを作成
   */
  private async createTables(plugin: PluginConfig): Promise<void> {
    for (const table of plugin.database.tables) {
      this.dynamicTables.set(table.name, plugin.id);

      if (table.storage === 'core') {
        await this.createCoreTable(table);
      } else {
        await this.createEphemeralTable(table);
      }
    }
  }

  /**
   * CoreDBにテーブルを作成
   */
  private async createCoreTable(table: TableConfig): Promise<void> {
    // Dexieの動的テーブル作成
    // 注意: Dexieはバージョン管理が必要なため、実際の実装では
    // version().stores()を使用する必要がある

    const currentVersion = this.coreDB.verno;

    await this.coreDB.close();

    this.coreDB.version(currentVersion + 1).stores({
      [table.name]: table.schema,
    });

    await this.coreDB.open();
  }

  /**
   * EphemeralDBにテーブルを作成
   */
  private async createEphemeralTable(table: TableConfig): Promise<void> {
    const currentVersion = this.ephemeralDB.verno;

    await this.ephemeralDB.close();

    this.ephemeralDB.version(currentVersion + 1).stores({
      [table.name]: table.schema,
    });

    await this.ephemeralDB.open();

    // TTL管理の設定
    if (table.ttl) {
      this.scheduleCleanup(table);
    }
  }

  /**
   * TTLクリーンアップをスケジュール
   */
  private scheduleCleanup(table: TableConfig): void {
    if (!table.ttl || table.storage !== 'ephemeral') return;

    const cleanup = async () => {
      const cutoff = Date.now() - table.ttl!;

      try {
        await this.ephemeralDB.transaction('rw', this.ephemeralDB.table(table.name), async () => {
          // createdAtまたはcopiedAtフィールドに基づいて削除
          const tableDexie = this.ephemeralDB.table(table.name);

          // 両方のフィールドをチェック
          await tableDexie.where('createdAt').below(cutoff).delete();

          await tableDexie.where('copiedAt').below(cutoff).delete();
        });
      } catch (error) {
        workerError(`Cleanup failed for table ${table.name}:`, error as Record<string, any>);
      }
    };

    // 定期実行（最大1時間ごと）
    const interval = Math.min(table.ttl, 3600000);
    const taskId = setInterval(cleanup, interval);
    this.cleanupTasks.set(table.name, taskId);

    // 初回実行
    cleanup();
  }

  /**
   * クリーンアップタスクを停止
   */
  private stopCleanupTask(tableName: string): void {
    const taskId = this.cleanupTasks.get(tableName);
    if (taskId) {
      clearInterval(taskId);
      this.cleanupTasks.delete(tableName);
    }
  }

  /**
   * エンティティハンドラーを登録
   */
  private registerEntityHandlers(plugin: PluginConfig): void {
    for (const [nodeType, _handler] of Object.entries(plugin.entityHandlers)) {
      // NodeTypeRegistryに登録 (without entityHandler which is stored separately)
      this.registry.register(nodeType as NodeType, {
        displayName: nodeType,
        canBeDeleted: true,
        canBeRenamed: true,
        canBeMoved: true,
      });
    }
  }

  /**
   * プラグインコンテキストを作成
   */
  private createContext(): PluginContext {
    return {
      coreDB: this.coreDB,
      ephemeralDB: this.ephemeralDB,
      hasTable: (tableName: string) => {
        // CoreDBとEphemeralDBの両方をチェック
        const coreHasTable = this.coreDB.tables.some((t) => t.name === tableName);
        const ephemeralHasTable = this.ephemeralDB.tables.some((t) => t.name === tableName);
        return Promise.resolve(coreHasTable || ephemeralHasTable);
      },
      getPlugin: (pluginId: string) => {
        return this.plugins.get(pluginId);
      },
    };
  }

  /**
   * ロード順序を更新
   */
  private updateLoadOrder(): void {
    this.loadOrder = Array.from(this.plugins.keys()).sort((a, b) => {
      const priorityA = this.plugins.get(a)?.lifecycle?.loadPriority ?? LoadPriority.NORMAL;
      const priorityB = this.plugins.get(b)?.lifecycle?.loadPriority ?? LoadPriority.NORMAL;
      return priorityA - priorityB;
    });
  }

  /**
   * プラグイン固有のAPIメソッドを取得
   */
  getPluginAPI(pluginId: string): Record<string, Function> | undefined {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return undefined;

    // エンティティハンドラーのメソッドを公開
    const api: Record<string, Function> = {};

    for (const [nodeType, handler] of Object.entries(plugin.entityHandlers)) {
      // CRUD以外の特殊なメソッドを探す
      const handlerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(handler)).filter(
        (name) => {
          // 基本的なCRUDメソッドを除外
          const excludedMethods = [
            'constructor',
            'createEntity',
            'getEntity',
            'updateEntity',
            'deleteEntity',
            'createWorkingCopy',
            'commitWorkingCopy',
            'discardWorkingCopy',
          ];
          return typeof (handler as any)[name] === 'function' && !excludedMethods.includes(name);
        }
      );

      // 特殊メソッドをAPIとして公開
      for (const methodName of handlerMethods) {
        api[`${nodeType}.${methodName}`] = (handler as any)[methodName].bind(handler);
      }
    }

    return api;
  }

  /**
   * すべてのプラグインを取得
   */
  getAllPlugins(): PluginConfig[] {
    return this.loadOrder.map((id) => this.plugins.get(id)!);
  }

  /**
   * プラグインが読み込まれているか確認
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * テーブルを所有するプラグインを取得
   */
  getTableOwner(tableName: string): string | undefined {
    return this.dynamicTables.get(tableName);
  }
}
