/**
 * Worker側プラグインブートストラッパー
 * Worker環境でプラグインシステムを起動・初期化する
 */

import { PluginOrchestrator, OrchestrationConfig } from './PluginOrchestrator';
import { IPluginDiscoveryStrategy } from '../1-discovery/PluginDiscoveryStrategy';
import { PluginProviderAPI } from '../6-facade/PluginRegistryFacade';

/**
 * Worker側ブートストラップ設定
 */
export interface WorkerBootstrapConfig {
  /** プラグイン探索戦略 */
  discoveryStrategy: IPluginDiscoveryStrategy;
  
  /** デバッグモード */
  debug?: boolean;
  
  /** 自動初期化 */
  autoInitialize?: boolean;
  
  /** エラーハンドリング */
  onError?: (error: Error) => void;
  
  /** 初期化完了コールバック */
  onReady?: (api: PluginProviderAPI) => void;
}

/**
 * Worker側プラグインブートストラッパー
 * アプリ初期化時にWorker側で実行される
 */
export class WorkerPluginBootstrapper {
  private orchestrator: PluginOrchestrator;
  private config: WorkerBootstrapConfig;
  private initialized: boolean = false;
  private api?: PluginProviderAPI;
  
  constructor(config: WorkerBootstrapConfig) {
    this.config = config;
    
    // オーケストレーターを設定
    const orchestrationConfig: OrchestrationConfig = {
      discoveryStrategy: config.discoveryStrategy,
      debug: config.debug,
      parallelInitialization: true, // Worker側では並列初期化を推奨
      onError: 'continue', // エラーが発生しても続行
    };
    
    this.orchestrator = new PluginOrchestrator(orchestrationConfig);
    
    // 自動初期化が有効な場合
    if (config.autoInitialize) {
      this.bootstrap().catch(error => {
        console.error('[WorkerPluginBootstrapper] Auto-initialization failed:', error);
        config.onError?.(error);
      });
    }
  }
  
  /**
   * プラグインシステムをブートストラップ
   */
  async bootstrap(): Promise<PluginProviderAPI> {
    if (this.initialized) {
      console.warn('[WorkerPluginBootstrapper] Already initialized');
      return this.api!;
    }
    
    try {
      console.log('[WorkerPluginBootstrapper] Starting plugin system bootstrap...');
      
      // プラグインシステムを初期化
      const result = await this.orchestrator.initialize();
      
      if (!result.success) {
        throw new Error(
          `Plugin initialization failed: ${result.errors.map(e => e.message).join(', ')}`
        );
      }
      
      this.api = result.api!;
      this.initialized = true;
      
      console.log(
        `[WorkerPluginBootstrapper] Successfully initialized ${result.initializedCount} plugins`
      );
      
      // 初期化完了を通知
      this.config.onReady?.(this.api);
      
      return this.api;
      
    } catch (error) {
      console.error('[WorkerPluginBootstrapper] Bootstrap failed:', error);
      this.config.onError?.(error as Error);
      throw error;
    }
  }
  
  /**
   * APIを取得（初期化済みでない場合はエラー）
   */
  getAPI(): PluginProviderAPI {
    if (!this.initialized || !this.api) {
      throw new Error('Plugin system not initialized. Call bootstrap() first.');
    }
    return this.api;
  }
  
  /**
   * 初期化済みかどうか
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * プラグインシステムをリセット
   */
  async reset(): Promise<void> {
    this.initialized = false;
    this.api = undefined;
    
    // 新しいオーケストレーターを作成
    this.orchestrator = new PluginOrchestrator({
      discoveryStrategy: this.config.discoveryStrategy,
      debug: this.config.debug,
      parallelInitialization: true,
      onError: 'continue',
    });
  }
  
  /**
   * イベントリスナーを登録
   */
  on(event: string, handler: Function): void {
    this.orchestrator.getEventEmitter().on(event as any, handler);
  }
  
  /**
   * イベントリスナーを削除
   */
  off(event: string, handler: Function): void {
    this.orchestrator.getEventEmitter().off(event as any, handler);
  }
}

/**
 * Worker側で使用するシングルトンインスタンス
 */
let workerBootstrapper: WorkerPluginBootstrapper | null = null;

/**
 * Worker側プラグインシステムを初期化
 * （Worker環境のエントリーポイントで呼ばれる）
 */
export async function initializePluginSystemInWorker(
  config: WorkerBootstrapConfig
): Promise<PluginProviderAPI> {
  if (!workerBootstrapper) {
    workerBootstrapper = new WorkerPluginBootstrapper(config);
  }
  
  return await workerBootstrapper.bootstrap();
}

/**
 * Worker側プラグインAPIを取得
 */
export function getWorkerPluginAPI(): PluginProviderAPI {
  if (!workerBootstrapper) {
    throw new Error('Plugin system not initialized in worker');
  }
  
  return workerBootstrapper.getAPI();
}

/**
 * Worker側プラグインシステムをリセット
 */
export async function resetWorkerPluginSystem(): Promise<void> {
  if (workerBootstrapper) {
    await workerBootstrapper.reset();
  }
}