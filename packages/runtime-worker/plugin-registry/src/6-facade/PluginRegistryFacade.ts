/**
 * プラグインレジストリファサード（Facade Pattern）
 * 外部向けの統一インターフェース
 */

import { NodeType, PluginIntegrated, EntityHandler } from '@hierarchidb/common-type';
import { IPluginRepository, PluginQuery } from '../5-repository/PluginRepository';
import { PluginEventEmitter, PluginEvent } from './PluginEventEmitter';

/**
 * プラグインレジストリAPIインターフェース
 */
export interface IPluginRegistryAPI {
  /**
   * プラグインを取得
   */
  getPlugin(nodeType: NodeType): Promise<PluginIntegrated | null>;
  
  /**
   * すべてのプラグインを取得
   */
  getAllPlugins(): Promise<PluginIntegrated[]>;
  
  /**
   * エンティティハンドラーを取得
   */
  getEntityHandler(nodeType: NodeType): Promise<EntityHandler | null>;
  
  /**
   * プラグインを検索
   */
  searchPlugins(query: PluginQuery): Promise<PluginIntegrated[]>;
  
  /**
   * プラグインが利用可能か確認
   */
  isPluginAvailable(nodeType: NodeType): Promise<boolean>;
  
  /**
   * イベントをリッスン
   */
  on(event: PluginEvent, handler: Function): void;
  
  /**
   * イベントリスナーを削除
   */
  off(event: PluginEvent, handler: Function): void;
}

/**
 * プラグインレジストリファサード実装
 */
export class PluginRegistryFacade implements IPluginRegistryAPI {
  private repository: IPluginRepository;
  private eventEmitter: PluginEventEmitter;
  private cache: Map<NodeType, PluginIntegrated>;
  
  constructor(repository: IPluginRepository) {
    this.repository = repository;
    this.eventEmitter = new PluginEventEmitter();
    this.cache = new Map();
  }
  
  /**
   * プラグインを取得（キャッシュ付き）
   */
  async getPlugin(nodeType: NodeType): Promise<PluginIntegrated | null> {
    // キャッシュチェック
    if (this.cache.has(nodeType)) {
      return this.cache.get(nodeType)!;
    }
    
    // リポジトリから取得
    const plugin = await this.repository.findById(nodeType);
    if (plugin) {
      this.cache.set(nodeType, plugin);
    }
    
    return plugin;
  }
  
  /**
   * すべてのプラグインを取得
   */
  async getAllPlugins(): Promise<PluginIntegrated[]> {
    return await this.repository.findAll();
  }
  
  /**
   * エンティティハンドラーを取得
   */
  async getEntityHandler(nodeType: NodeType): Promise<EntityHandler | null> {
    const plugin = await this.getPlugin(nodeType);
    return plugin?.entityHandler || null;
  }
  
  /**
   * プラグインを検索
   */
  async searchPlugins(query: PluginQuery): Promise<PluginIntegrated[]> {
    return await this.repository.find(query);
  }
  
  /**
   * プラグインが利用可能か確認
   */
  async isPluginAvailable(nodeType: NodeType): Promise<boolean> {
    const plugin = await this.getPlugin(nodeType);
    return plugin !== null;
  }
  
  /**
   * 作成可能なプラグインを取得
   */
  async getCreatablePlugins(): Promise<PluginIntegrated[]> {
    return await this.searchPlugins({
      availableOnly: true,
      capabilities: ['creatable'],
    });
  }
  
  /**
   * カテゴリごとにグループ化されたプラグインを取得
   */
  async getPluginsByCategory(): Promise<Map<string, PluginIntegrated[]>> {
    const plugins = await this.getAllPlugins();
    const grouped = new Map<string, PluginIntegrated[]>();
    
    for (const plugin of plugins) {
      const category = plugin.category?.menuGroup || 'uncategorized';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(plugin);
    }
    
    return grouped;
  }
  
  /**
   * プラグインの依存関係を取得
   */
  async getPluginDependencies(nodeType: NodeType): Promise<NodeType[]> {
    const plugin = await this.getPlugin(nodeType);
    return (plugin?.dependencies || []).map(dep => dep as NodeType);
  }
  
  /**
   * プラグインに依存しているプラグインを取得
   */
  async getPluginDependents(nodeType: NodeType): Promise<NodeType[]> {
    const allPlugins = await this.getAllPlugins();
    const dependents: NodeType[] = [];
    
    for (const plugin of allPlugins) {
      if (plugin.dependencies.includes(nodeType)) {
        dependents.push(plugin.nodeType);
      }
    }
    
    return dependents;
  }
  
  /**
   * イベントをリッスン
   */
  on(event: PluginEvent, handler: Function): void {
    this.eventEmitter.on(event, handler);
  }
  
  /**
   * イベントリスナーを削除
   */
  off(event: PluginEvent, handler: Function): void {
    this.eventEmitter.off(event, handler);
  }
  
  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
    this.eventEmitter.emit('cache-cleared', {});
  }
  
  /**
   * 統計情報を取得
   */
  async getStatistics(): Promise<PluginStatistics> {
    const plugins = await this.getAllPlugins();
    
    return {
      totalPlugins: plugins.length,
      availablePlugins: plugins.length, // すべてのプラグインが利用可能と仮定
      pluginsWithUI: plugins.filter(p => p.ui).length,
      pluginsWithValidation: plugins.filter(p => p.validation).length,
      averageDependencies: this.calculateAverageDependencies(plugins),
    };
  }
  
  private calculateAverageDependencies(plugins: PluginIntegrated[]): number {
    if (plugins.length === 0) return 0;
    
    const total = plugins.reduce((sum, p) => sum + p.dependencies.length, 0);
    return total / plugins.length;
  }
}

/**
 * プラグイン統計情報
 */
export interface PluginStatistics {
  totalPlugins: number;
  availablePlugins: number;
  pluginsWithUI: number;
  pluginsWithValidation: number;
  averageDependencies: number;
}

/**
 * プラグインプロバイダーAPI（シンプルな外部向けAPI）
 */
export class PluginProviderAPI {
  private facade: PluginRegistryFacade;
  
  constructor(facade: PluginRegistryFacade) {
    this.facade = facade;
  }
  
  /**
   * プラグインを取得
   */
  async get(nodeType: NodeType): Promise<PluginIntegrated | null> {
    return await this.facade.getPlugin(nodeType);
  }
  
  /**
   * すべてのプラグインを取得
   */
  async getAll(): Promise<PluginIntegrated[]> {
    return await this.facade.getAllPlugins();
  }
  
  /**
   * エンティティハンドラーを取得
   */
  async getHandler(nodeType: NodeType): Promise<EntityHandler | null> {
    return await this.facade.getEntityHandler(nodeType);
  }
  
  /**
   * 作成メニュー用のプラグインリストを取得
   */
  async getForCreateMenu(): Promise<CreateMenuItem[]> {
    const plugins = await this.facade.getCreatablePlugins();
    
    return plugins.map(plugin => ({
      nodeType: plugin.nodeType,
      displayName: plugin.displayName,
      description: plugin.description,
      icon: plugin.icon,
      category: plugin.category?.menuGroup || 'basic',
      order: plugin.category?.createOrder || 0,
    }));
  }
  
  /**
   * プラグインの存在確認
   */
  async has(nodeType: NodeType): Promise<boolean> {
    const plugin = await this.facade.getPlugin(nodeType);
    return plugin !== null;
  }
  
  /**
   * プラグインの利用可能性確認
   */
  async isAvailable(nodeType: NodeType): Promise<boolean> {
    return await this.facade.isPluginAvailable(nodeType);
  }
}

/**
 * 作成メニュー項目
 */
export interface CreateMenuItem {
  nodeType: NodeType;
  displayName: string;
  description?: string;
  icon?: any;
  category: string;
  order: number;
}