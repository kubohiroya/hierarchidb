/**
 * Workerクライアントブートストラッパー
 * UI側でWorkerシステムに接続するメインクラス
 */

import * as Comlink from 'comlink';
import { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerLauncher } from './WorkerLauncher';
import { WorkerConnector } from './WorkerConnector';
import { ComlinkBridge } from './ComlinkBridge';

/**
 * クライアントブートストラップ設定
 */
export interface ClientBootstrapConfig {
  /** Worker URLまたはWorkerインスタンス */
  workerUrl?: string | URL;
  worker?: Worker;
  
  /** デバッグモード */
  debug?: boolean;
  
  /** タイムアウト設定 */
  connectionTimeout?: number;
  workerReadyTimeout?: number;
  
  /** コールバック */
  onWorkerReady?: (api: WorkerAPI) => void;
  onError?: (error: Error) => void;
  onProgress?: (step: string, progress: number) => void;
}

/**
 * クライアントブートストラップ結果
 */
export interface ClientBootstrapResult {
  /** 成功したか */
  success: boolean;
  
  /** WorkerAPI */
  api?: WorkerAPI;
  
  /** Workerインスタンス */
  worker?: Worker;
  
  /** エラー */
  error?: Error;
  
  /** 接続時間 */
  duration: number;
}

/**
 * WorkerクライアントブートストラッパーF
 * UI環境でWorkerに接続する
 */
export class WorkerClientBootstrapper {
  private config: ClientBootstrapConfig;
  private launcher: WorkerLauncher;
  private connector: WorkerConnector;
  private bridge: ComlinkBridge;
  private api?: WorkerAPI;
  private worker?: Worker;
  private connected: boolean = false;
  
  constructor(config: ClientBootstrapConfig = {}) {
    this.config = {
      debug: false,
      connectionTimeout: 10000,
      workerReadyTimeout: 30000,
      ...config,
    };
    
    this.launcher = new WorkerLauncher({
      debug: this.config.debug,
    });
    
    this.connector = new WorkerConnector({
      timeout: this.config.connectionTimeout,
      debug: this.config.debug,
    });
    
    this.bridge = new ComlinkBridge({
      debug: this.config.debug,
    });
  }
  
  /**
   * Workerシステムに接続
   */
  async connect(): Promise<ClientBootstrapResult> {
    const startTime = Date.now();
    
    if (this.connected) {
      return {
        success: true,
        api: this.api,
        worker: this.worker,
        duration: 0,
      };
    }
    
    try {
      this.log('Starting Worker client connection...');
      
      // Step 1: Worker起動
      this.reportProgress('Launching Worker', 0.2);
      this.worker = await this.launchWorker();
      
      // Step 2: 接続確立
      this.reportProgress('Establishing connection', 0.4);
      await this.establishConnection(this.worker);
      
      // Step 3: Workerの準備完了を待機
      this.reportProgress('Waiting for Worker initialization', 0.6);
      await this.waitForWorkerReady(this.worker);
      
      // Step 4: Comlink Bridge構築
      this.reportProgress('Setting up Comlink bridge', 0.8);
      this.api = await this.setupComlinkBridge(this.worker);
      
      // Step 5: 接続テスト
      this.reportProgress('Testing connection', 0.9);
      await this.testConnection(this.api);
      
      // 完了
      this.reportProgress('Connection established', 1.0);
      const duration = Date.now() - startTime;
      
      this.connected = true;
      this.log(`Worker client connected in ${duration}ms`);
      this.config.onWorkerReady?.(this.api);
      
      return {
        success: true,
        api: this.api,
        worker: this.worker,
        duration,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Worker client connection failed: ${error}`, 'error');
      this.config.onError?.(error as Error);
      
      return {
        success: false,
        error: error as Error,
        duration,
      };
    }
  }
  
  /**
   * Step 1: Worker起動
   */
  private async launchWorker(): Promise<Worker> {
    if (this.config.worker) {
      this.log('Using provided Worker instance');
      return this.config.worker;
    }
    
    if (this.config.workerUrl) {
      this.log('Launching Worker from URL');
      return await this.launcher.launch(this.config.workerUrl);
    }
    
    // デフォルトWorkerを起動
    this.log('Launching default Worker');
    return await this.launcher.launchDefault();
  }
  
  /**
   * Step 2: 接続確立
   */
  private async establishConnection(worker: Worker): Promise<void> {
    this.log('Establishing connection to Worker...');
    await this.connector.connect(worker);
  }
  
  /**
   * Step 3: Worker準備完了待機
   */
  private async waitForWorkerReady(worker: Worker): Promise<void> {
    this.log('Waiting for Worker to be ready...');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker ready timeout'));
      }, this.config.workerReadyTimeout);
      
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'worker-ready') {
          clearTimeout(timeout);
          worker.removeEventListener('message', messageHandler);
          this.log(`Worker ready with ${event.data.data.pluginCount} plugins`);
          resolve();
        } else if (event.data.type === 'worker-error') {
          clearTimeout(timeout);
          worker.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error.message));
        }
      };
      
      worker.addEventListener('message', messageHandler);
    });
  }
  
  /**
   * Step 4: Comlink Bridge構築
   */
  private async setupComlinkBridge(worker: Worker): Promise<WorkerAPI> {
    this.log('Setting up Comlink bridge...');
    return await this.bridge.createBridge(worker);
  }
  
  /**
   * Step 5: 接続テスト
   */
  private async testConnection(api: WorkerAPI): Promise<void> {
    this.log('Testing connection...');
    
    try {
      // API呼び出しテスト
      const isReady = await api.isReady();
      if (!isReady) {
        throw new Error('Worker API not ready');
      }
      
      this.log('Connection test successful');
    } catch (error) {
      throw new Error(`Connection test failed: ${error}`);
    }
  }
  
  /**
   * APIを取得
   */
  getAPI(): WorkerAPI {
    if (!this.api) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.api;
  }
  
  /**
   * Workerを取得
   */
  getWorker(): Worker {
    if (!this.worker) {
      throw new Error('Worker not launched. Call connect() first.');
    }
    return this.worker;
  }
  
  /**
   * 接続を切断
   */
  async disconnect(): Promise<void> {
    this.log('Disconnecting from Worker...');
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
    
    this.api = undefined;
    this.connected = false;
  }
  
  /**
   * 接続済みかどうか
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * 進捗報告
   */
  private reportProgress(step: string, progress: number): void {
    this.config.onProgress?.(step, progress);
  }
  
  /**
   * ログ出力
   */
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (this.config.debug) {
      const prefix = '[WorkerClientBootstrapper]';
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }
}

/**
 * シングルトンインスタンス
 */
let clientBootstrapper: WorkerClientBootstrapper | null = null;

/**
 * UI側でWorkerシステムに接続
 */
export async function connectToWorker(
  config?: ClientBootstrapConfig
): Promise<WorkerAPI> {
  if (!clientBootstrapper) {
    clientBootstrapper = new WorkerClientBootstrapper(config);
  }
  
  const result = await clientBootstrapper.connect();
  
  if (!result.success) {
    throw result.error || new Error('Connection failed');
  }
  
  return result.api!;
}

/**
 * Worker APIを取得
 */
export function getWorkerAPI(): WorkerAPI {
  if (!clientBootstrapper) {
    throw new Error('Not connected to Worker');
  }
  
  return clientBootstrapper.getAPI();
}

/**
 * Workerから切断
 */
export async function disconnectFromWorker(): Promise<void> {
  if (clientBootstrapper) {
    await clientBootstrapper.disconnect();
    clientBootstrapper = null;
  }
}