/**
 * プラグインリポジトリ（Repository Pattern）
 */

import { NodeType, PluginIntegrated } from '@hierarchidb/common-type';

/**
 * クエリ条件
 */
export interface PluginQuery {
  /** ノードタイプ */
  nodeType?: NodeType;
  
  /** 機能でフィルタ */
  capabilities?: string[];
  
  /** 利用可能なもののみ */
  availableOnly?: boolean;
  
  /** カテゴリ */
  category?: string;
  
  /** メニューグループ */
  menuGroup?: string;
}

/**
 * プラグインリポジトリインターフェース
 */
export interface IPluginRepository {
  /**
   * プラグインを保存
   */
  save(plugin: PluginIntegrated): Promise<void>;
  
  /**
   * バッチ保存
   */
  saveAll(plugins: PluginIntegrated[]): Promise<void>;
  
  /**
   * IDで取得
   */
  findById(nodeType: NodeType): Promise<PluginIntegrated | null>;
  
  /**
   * すべて取得
   */
  findAll(): Promise<PluginIntegrated[]>;
  
  /**
   * クエリで検索
   */
  find(query: PluginQuery): Promise<PluginIntegrated[]>;
  
  /**
   * 削除
   */
  delete(nodeType: NodeType): Promise<void>;
  
  /**
   * すべて削除
   */
  clear(): Promise<void>;
}

/**
 * プラグインリポジトリ実装
 */
export class PluginRepository implements IPluginRepository {
  private store: PluginStore;
  
  constructor() {
    this.store = new PluginStore();
  }
  
  // Legacy compatibility methods for PluginManagementService
  async registerPlugin(_nodeType: NodeType): Promise<void> {
    // This is a no-op for compatibility
    // Actual registration happens via save()
  }
  
  async unregister(nodeType: NodeType): Promise<void> {
    await this.store.delete(nodeType);
  }
  
  async has(nodeType: NodeType): Promise<boolean> {
    const plugin = await this.store.get(nodeType);
    return plugin !== null;
  }
  
  async get(nodeType: NodeType): Promise<PluginIntegrated | null> {
    return await this.store.get(nodeType);
  }
  
  async getAll(): Promise<PluginIntegrated[]> {
    return await this.store.getAll();
  }
  
  async save(plugin: PluginIntegrated): Promise<void> {
    await this.store.set(plugin.nodeType, plugin);
  }
  
  async saveAll(plugins: PluginIntegrated[]): Promise<void> {
    for (const plugin of plugins) {
      await this.save(plugin);
    }
  }
  
  async findById(nodeType: NodeType): Promise<PluginIntegrated | null> {
    return this.store.get(nodeType);
  }
  
  async findAll(): Promise<PluginIntegrated[]> {
    return this.store.getAll();
  }
  
  async find(query: PluginQuery): Promise<PluginIntegrated[]> {
    const all = await this.findAll();
    return this.filter(all, query);
  }
  
  async delete(nodeType: NodeType): Promise<void> {
    await this.store.delete(nodeType);
  }
  
  async clear(): Promise<void> {
    await this.store.clear();
  }
  
  /**
   * 統計情報を取得
   */
  async getStatistics(): Promise<RepositoryStatistics> {
    const all = await this.findAll();
    
    return {
      totalPlugins: all.length,
      availablePlugins: all.length,  // metadataプロパティは存在しないため
      pluginsByCapability: this.groupByCapability(all),
      pluginsByCategory: this.groupByCategory(all),
    };
  }
  
  private groupByCapability(plugins: PluginIntegrated[]): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const _plugin of plugins) {
      // metadataプロパティは存在しないため、スキップ
      const capabilities: string[] = [];
      if (capabilities.length > 0) {
        for (const cap of capabilities) {
          result[cap] = (result[cap] || 0) + 1;
        }
      }
    }
    
    return result;
  }
  
  private groupByCategory(plugins: PluginIntegrated[]): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const plugin of plugins) {
      const category = plugin.category?.menuGroup || 'uncategorized';
      result[category] = (result[category] || 0) + 1;
    }
    
    return result;
  }

  /**
   * プラグインをフィルタリング
   */
  private filter(plugins: PluginIntegrated[], query: PluginQuery): PluginIntegrated[] {
    let result = [...plugins];
    
    // NodeTypeでフィルタ
    if (query.nodeType) {
      result = result.filter(p => p.nodeType === query.nodeType);
    }
    
    // 機能でフィルタ
    if (query.capabilities && query.capabilities.length > 0) {
      result = result.filter(_p => {
        // metadataプロパティは存在しないため、常にfalse
        return false;
      });
    }
    
    // 利用可能性でフィルタ
    if (query.availableOnly) {
      // metadataプロパティは存在しないため、すべてを利用可能とみなす
      // result = result.filter(p => true);
    }
    
    // カテゴリでフィルタ
    if (query.category) {
      result = result.filter(p => p.category?.treeId === query.category);
    }
    
    // メニューグループでフィルタ
    if (query.menuGroup) {
      result = result.filter(p => p.category?.menuGroup === query.menuGroup);
    }
    
    return result;
  }
}

/**
 * 内部ストレージ
 */
export class PluginStore {
  private plugins: Map<NodeType, PluginIntegrated> = new Map();
  
  async set(nodeType: NodeType, plugin: PluginIntegrated): Promise<void> {
    this.plugins.set(nodeType, plugin);
  }
  
  async get(nodeType: NodeType): Promise<PluginIntegrated | null> {
    return this.plugins.get(nodeType) || null;
  }
  
  async getAll(): Promise<PluginIntegrated[]> {
    return Array.from(this.plugins.values());
  }
  
  async delete(nodeType: NodeType): Promise<void> {
    this.plugins.delete(nodeType);
  }
  
  async clear(): Promise<void> {
    this.plugins.clear();
  }
  
  size(): number {
    return this.plugins.size;
  }
}



/**
 * リポジトリ統計
 */
export interface RepositoryStatistics {
  totalPlugins: number;
  availablePlugins: number;
  pluginsByCapability: Record<string, number>;
  pluginsByCategory: Record<string, number>;
}