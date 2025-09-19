/**
  * Worker
 * UIWorker
  */

import { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerLauncher } from './WorkerLauncher.js';
import { WorkerConnector } from './WorkerConnector.js';
import { ComlinkBridge } from './ComlinkBridge.js';

/**
    */
export interface ClientBootstrapConfig {
  /**
   * Worker URLWorker
   */
  workerUrl?: string | URL;
  worker?: Worker;

  /**
      */
  debug?: boolean;

  /**
      */
  connectionTimeout?: number;
  workerReadyTimeout?: number;

  /**
      */
  onWorkerReady?: (api: WorkerAPI) => void;
  onError?: (error: Error) => void;
  onProgress?: (step: string, progress: number) => void;
}

/**
    */
export interface ClientBootstrapResult {
  /**
      */
  success: boolean;

  /** WorkerAPI */
  api?: WorkerAPI;

  /**
   * Worker
   */
  worker?: Worker;

  /**
      */
  error?: Error;

  /**
      */
  duration: number;
}

/**
  * WorkerF
 * UIWorker
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
      * Worker
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

      //  Step 1: Worker
      this.reportProgress('Launching Worker', 0.2);
      this.worker = await this.launchWorker();

      //  Step 2:
      this.reportProgress('Establishing connection', 0.4);
      await this.establishConnection(this.worker);

      //  Step 3: Worker
      this.reportProgress('Waiting for Worker initialization', 0.6);
      await this.waitForWorkerReady(this.worker);

      //  Step 4: Comlink Bridge
      this.reportProgress('Setting up Comlink bridge', 0.8);
      this.api = await this.setupComlinkBridge(this.worker);

      //  Step 5:
      this.reportProgress('Testing connection', 0.9);
      await this.testConnection(this.api);

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
      * Step 1: Worker
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

    //  Worker
    this.log('Launching default Worker');
    return await this.launcher.launchDefault();
  }

  /**
      * Step 2:
      */
  private async establishConnection(worker: Worker): Promise<void> {
    this.log('Establishing connection to Worker...');
    await this.connector.connect(worker);
  }

  /**
      * Step 3: Worker
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
      * Step 4: Comlink Bridge
      */
  private async setupComlinkBridge(worker: Worker): Promise<WorkerAPI> {
    this.log('Setting up Comlink bridge...');
    return await this.bridge.createBridge(worker);
  }

  /**
      * Step 5:
      */
  private async testConnection(api: WorkerAPI): Promise<void> {
    this.log('Testing connection...');

    try {
      //  API
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
      * API
      */
  getAPI(): WorkerAPI {
    if (!this.api) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.api;
  }

  /**
      * Worker
      */
  getWorker(): Worker {
    if (!this.worker) {
      throw new Error('Worker not launched. Call connect() first.');
    }
    return this.worker;
  }

  /**
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
            */
  isConnected(): boolean {
    return this.connected;
  }

  /**
            */
  private reportProgress(step: string, progress: number): void {
    this.config.onProgress?.(step, progress);
  }

  /**
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
    */
let clientBootstrapper: WorkerClientBootstrapper | null = null;

/**
  * UIWorker
  */
export async function connectToWorker(
  config?: ClientBootstrapConfig,
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
  * Worker API
  */
export function getWorkerAPI(): WorkerAPI {
  if (!clientBootstrapper) {
    throw new Error('Not connected to Worker');
  }

  return clientBootstrapper.getAPI();
}

/**
  * Worker
  */
export async function disconnectFromWorker(): Promise<void> {
  if (clientBootstrapper) {
    await clientBootstrapper.disconnect();
    clientBootstrapper = null;
  }
}