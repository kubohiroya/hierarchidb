/**
 * プラグインオーケストレーター
 * 全体のプラグイン初期化フローを制御
 */

import { NodeType, PluginDefinition, PluginIntegrated } from '@hierarchidb/common-type';
import { IPluginDiscoveryStrategy } from '../1-discovery/PluginDiscoveryStrategy';
import { PluginDefinitionFactory } from '../2-definition/PluginDefinitionFactory';
import { DependencyResolver } from '../3-resolution/DependencyResolver';
import { StandardPluginInitializer } from '../4-initialization/PluginInitializer';
import { PluginRepository } from '../5-repository/PluginRepository';
import { PluginRegistryFacade, PluginProviderAPI } from '../6-facade/PluginRegistryFacade';
import { PluginEventEmitter } from '../6-facade/PluginEventEmitter';

/**
 * オーケストレーション設定
 */
export interface OrchestrationConfig {
  /** 探索戦略 */
  discoveryStrategy?: IPluginDiscoveryStrategy;
  
  /** デバッグモード */
  debug?: boolean;
  
  /** 並列初期化を有効化 */
  parallelInitialization?: boolean;
  
  /** 初期化タイムアウト（ミリ秒） */
  initializationTimeout?: number;
  
  /** エラー時の挙動 */
  onError?: 'continue' | 'stop';
}

/**
 * オーケストレーション結果
 */
export interface OrchestrationResult {
  /** 成功したか */
  success: boolean;
  
  /** 初期化されたプラグイン数 */
  initializedCount: number;
  
  /** 失敗したプラグイン */
  failedPlugins: NodeType[];
  
  /** エラー詳細 */
  errors: Error[];
  
  /** 処理時間（ミリ秒） */
  duration: number;
  
  /** 外部APIアクセスポイント */
  api?: PluginProviderAPI;
}

/**
 * プラグインオーケストレーター
 * プラグインシステム全体の初期化フローを管理
 */
export class PluginOrchestrator {
  private config: OrchestrationConfig;
  private definitionFactory: PluginDefinitionFactory;
  private dependencyResolver: DependencyResolver;
  private initializer: StandardPluginInitializer;
  private repository: PluginRepository;
  private facade: PluginRegistryFacade;
  private eventEmitter: PluginEventEmitter;
  
  constructor(config: OrchestrationConfig = {}) {
    this.config = {
      debug: false,
      parallelInitialization: false,
      initializationTimeout: 30000,
      onError: 'continue',
      ...config,
    };
    
    this.definitionFactory = new PluginDefinitionFactory();
    this.dependencyResolver = new DependencyResolver();
    this.initializer = new StandardPluginInitializer();
    this.repository = new PluginRepository();
    this.facade = new PluginRegistryFacade(this.repository);
    this.eventEmitter = new PluginEventEmitter();
  }
  
  /**
   * プラグインシステムを初期化
   */
  async initialize(): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const errors: Error[] = [];
    const failedPlugins: NodeType[] = [];
    
    try {
      this.log('Starting plugin system initialization...');
      
      // Step 1: プラグインを探索
      this.log('Step 1: Discovering plugins...');
      const manifests = await this.discoverPlugins();
      this.log(`Found ${manifests.length} plugins`);
      
      // Step 2: プラグイン定義を作成
      this.log('Step 2: Creating plugin definitions...');
      const definitions = await this.createDefinitions(manifests);
      this.log(`Created ${definitions.size} plugin definitions`);
      
      // Step 3: 依存関係を解決
      this.log('Step 3: Resolving dependencies...');
      const resolution = this.dependencyResolver.resolve(definitions);
      
      if (!resolution.success) {
        throw new Error(`Dependency resolution failed: ${resolution.errors.map(e => e.message).join(', ')}`);
      }
      
      this.log(`Resolved initialization order: ${resolution.initializationOrder.join(' -> ')}`);
      
      // Step 4: プラグインを初期化
      this.log('Step 4: Initializing plugins...');
      const initialized = await this.initializePlugins(
        definitions,
        resolution.initializationOrder
      );
      
      // Step 5: リポジトリに保存
      this.log('Step 5: Saving to repository...');
      await this.saveToRepository(initialized);
      
      // Step 6: 成功を通知
      this.eventEmitter.emit('all-plugins-loaded', {
        count: initialized.length,
      });
      
      // API を作成
      const api = new PluginProviderAPI(this.facade);
      
      const duration = Date.now() - startTime;
      this.log(`Plugin system initialized in ${duration}ms`);
      
      return {
        success: true,
        initializedCount: initialized.length,
        failedPlugins,
        errors,
        duration,
        api,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      errors.push(error as Error);
      
      return {
        success: false,
        initializedCount: 0,
        failedPlugins,
        errors,
        duration,
      };
    }
  }
  
  /**
   * プラグインを探索
   */
  private async discoverPlugins() {
    if (!this.config.discoveryStrategy) {
      throw new Error('Discovery strategy is not configured');
    }
    
    return await this.config.discoveryStrategy.discover();
  }
  
  /**
   * プラグイン定義を作成
   */
  private async createDefinitions(manifests: any[]): Promise<Map<NodeType, PluginDefinition>> {
    return await this.definitionFactory.createBatch(manifests);
  }
  
  /**
   * プラグインを初期化
   */
  private async initializePlugins(
    definitions: Map<NodeType, PluginDefinition>,
    order: NodeType[]
  ): Promise<PluginIntegrated[]> {
    const initialized: PluginIntegrated[] = [];
    const initializedMap = new Map<NodeType, PluginIntegrated>();
    
    if (this.config.parallelInitialization) {
      // 並列初期化（依存関係のレベルごとに並列処理）
      const levels = this.groupByDependencyLevel(definitions, order);
      
      for (const level of levels) {
        const promises = level.map(nodeType => 
          this.initializeSinglePlugin(
            definitions.get(nodeType)!,
            order,
            initializedMap
          )
        );
        
        const results = await Promise.allSettled(promises);
        
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const nodeType = level[i];
          
          if (!nodeType) continue; // Skip if nodeType is undefined
          
          if (result?.status === 'fulfilled' && result.value.success) {
            initialized.push(result.value.integrated!);
            initializedMap.set(nodeType, result.value.integrated!);
            this.eventEmitter.emit('plugin-initialized', { nodeType });
          } else {
            const error = result?.status === 'rejected' 
              ? (result as PromiseRejectedResult).reason 
              : (result as PromiseFulfilledResult<any>).value?.error;
            this.handleInitializationError(nodeType, error);
          }
        }
      }
    } else {
      // 直列初期化
      for (const nodeType of order) {
        const definition = definitions.get(nodeType);
        if (!definition) continue;
        
        const result = await this.initializeSinglePlugin(definition, order, initializedMap);
        
        if (result.success) {
          initialized.push(result.integrated!);
          initializedMap.set(nodeType, result.integrated!);
          this.eventEmitter.emit('plugin-initialized', { nodeType });
        } else {
          this.handleInitializationError(nodeType, result.error);
        }
      }
    }
    
    return initialized;
  }
  
  /**
   * 単一プラグインを初期化
   */
  private async initializeSinglePlugin(
    definition: PluginDefinition,
    order: NodeType[],
    initializedMap: Map<NodeType, PluginIntegrated>
  ) {
    const context = {
      definition,
      initializationOrder: order,
      initializedPlugins: initializedMap,
    };
    
    // タイムアウト付きで初期化
    return await this.withTimeout(
      this.initializer.initialize(context),
      this.config.initializationTimeout!
    );
  }
  
  /**
   * 依存関係レベルでグループ化（並列処理用）
   */
  private groupByDependencyLevel(
    definitions: Map<NodeType, PluginDefinition>,
    order: NodeType[]
  ): NodeType[][] {
    const levels: NodeType[][] = [];
    const processed = new Set<NodeType>();
    
    for (const nodeType of order) {
      if (processed.has(nodeType)) continue;
      
      const definition = definitions.get(nodeType);
      if (!definition) continue;
      
      // このノードが依存するものがすべて処理済みか確認
      const canProcess = definition.dependencies.every(dep => 
        processed.has(dep as NodeType)
      );
      
      if (canProcess) {
        // 同じレベルで処理できるものを探す
        const level: NodeType[] = [nodeType];
        processed.add(nodeType);
        
        // 残りのノードから同じレベルで処理できるものを追加
        for (const otherNodeType of order) {
          if (processed.has(otherNodeType)) continue;
          
          const otherDef = definitions.get(otherNodeType);
          if (!otherDef) continue;
          
          const canProcessOther = otherDef.dependencies.every(dep =>
            processed.has(dep as NodeType)
          );
          
          if (canProcessOther) {
            level.push(otherNodeType);
            processed.add(otherNodeType);
          }
        }
        
        levels.push(level);
      }
    }
    
    return levels;
  }
  
  /**
   * リポジトリに保存
   */
  private async saveToRepository(plugins: PluginIntegrated[]): Promise<void> {
    await this.repository.saveAll(plugins);
  }
  
  /**
   * 初期化エラーを処理
   */
  private handleInitializationError(nodeType: NodeType, error?: Error): void {
    this.eventEmitter.emit('plugin-error', {
      nodeType,
      error,
      message: `Failed to initialize plugin: ${nodeType}`,
    });
    
    if (this.config.onError === 'stop') {
      throw error || new Error(`Failed to initialize plugin: ${nodeType}`);
    }
  }
  
  /**
   * タイムアウト付きで実行
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout')), timeout)
      ),
    ]);
  }
  
  /**
   * デバッグログ
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[PluginOrchestrator] ${message}`);
    }
  }
  
  /**
   * 外部APIを取得
   */
  getAPI(): PluginProviderAPI {
    return new PluginProviderAPI(this.facade);
  }
  
  /**
   * イベントエミッターを取得
   */
  getEventEmitter(): PluginEventEmitter {
    return this.eventEmitter;
  }
}