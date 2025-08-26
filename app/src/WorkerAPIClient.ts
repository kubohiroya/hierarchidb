/**
 * WorkerAPIClient - Synchronous singleton for Worker access
 */

import { getWorkerClient } from './initWorkerClient';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { Remote } from 'comlink';

export class NotInitializedError extends Error {
  constructor() {
    super('WorkerAPIClient is not initialized. Make sure to call initialize() first.');
    this.name = 'NotInitializedError';
  }
}

export class WorkerAPIClient {
  private static workerInstance: Remote<WorkerAPI> | null = null;
  private static state: 'uninitialized' | 'initializing' | 'initialized' | 'error' =
    'uninitialized';
  private static initializationPromise: Promise<void> | null = null;
  private static lastError: Error | null = null;

  /**
   * Initialize the Worker (must be called once at app startup)
   */
  static async initialize(): Promise<void> {
    console.log(`[WorkerAPIClient.initialize] Current state: ${this.state}`);

    // Handle based on current state
    switch (this.state) {
      case 'initialized':
        console.log('[WorkerAPIClient.initialize] Already initialized, returning immediately');
        return;

      case 'initializing':
        console.log(
          '[WorkerAPIClient.initialize] Already initializing, returning existing promise'
        );
        if (this.initializationPromise) {
          return this.initializationPromise;
        }
        // If promise is somehow null, fall through to reinitialize
        console.warn(
          '[WorkerAPIClient.initialize] State is initializing but no promise found, reinitializing'
        );
        break;

      case 'error':
        console.log('[WorkerAPIClient.initialize] Previous initialization failed, retrying');
        console.log('[WorkerAPIClient.initialize] Last error was:', this.lastError);
        break;

      case 'uninitialized':
        console.log('[WorkerAPIClient.initialize] First initialization attempt');
        break;
    }

    // Start new initialization
    console.log('[WorkerAPIClient.initialize] Starting new initialization');
    this.state = 'initializing';

    this.initializationPromise = this.doInitialize()
      .then(() => {
        console.log('[WorkerAPIClient.initialize] Initialization successful');
        this.state = 'initialized';
        this.lastError = null;
        this.initializationPromise = null;
      })
      .catch((error) => {
        console.error('[WorkerAPIClient.initialize] Initialization failed:', error);
        this.state = 'error';
        this.lastError = error instanceof Error ? error : new Error(String(error));
        this.initializationPromise = null;
        throw error;
      });

    return this.initializationPromise;
  }

  private static async doInitialize(): Promise<void> {
    console.log('[WorkerAPIClient.doInitialize] Starting at', new Date().toISOString());

    try {
      console.log('[WorkerAPIClient.doInitialize] Calling getRemoteWorkerSingleton()...');
      const remoteWorker = await getWorkerClient();
      console.log('[WorkerAPIClient.doInitialize] Remote worker obtained:', !!remoteWorker);

      // Store the Remote<WorkerAPI> directly
      this.workerInstance = remoteWorker;

      if (!this.workerInstance) {
        throw new Error('getRemoteWorkerSingleton returned null');
      }

      console.log('[WorkerAPIClient.doInitialize] Initialization completed successfully');
    } catch (error) {
      console.error('[WorkerAPIClient.doInitialize] Failed:', error);
      console.error('[WorkerAPIClient.doInitialize] Error stack:', (error as Error)?.stack);

      // Clean up on failure
      this.workerInstance = null;
      throw error;
    }
  }

  /**
   * Get singleton Worker API instance directly
   */
  static getSingleton(): WorkerAPI {
    console.log(`[WorkerAPIClient.getSingleton] Current state: ${this.state}`);

    if (this.state !== 'initialized' || !this.workerInstance) {
      console.error('[WorkerAPIClient.getSingleton] Not initialized', {
        state: this.state,
        hasInstance: !!this.workerInstance,
        lastError: this.lastError,
      });
      throw new NotInitializedError();
    }

    console.log('[WorkerAPIClient.getSingleton] Returning worker instance');
    // Cast Remote<WorkerAPI> to WorkerAPI - they have the same interface
    return this.workerInstance as unknown as WorkerAPI;
  }

  /**
   * Get the raw worker API (direct access to worker methods)
   */
  getAPI() {
    if (!WorkerAPIClient.isReady() || !WorkerAPIClient.workerInstance) {
      throw new NotInitializedError();
    }

    console.log('[WorkerAPIClient] Returning worker API:', WorkerAPIClient.workerInstance);
    console.log(
      '[WorkerAPIClient] API methods:',
      Object.getOwnPropertyNames(WorkerAPIClient.workerInstance)
    );
    console.log(
      '[WorkerAPIClient] getNode method type:',
      typeof WorkerAPIClient.workerInstance.getNode
    );
    console.log(
      '[WorkerAPIClient] getTree method type:',
      typeof WorkerAPIClient.workerInstance.getTree
    );

    return WorkerAPIClient.workerInstance;
  }

  /**
   * Direct access to worker methods for convenience
   */
  async getTrees() {
    const api = this.getAPI();
    return await api.getTrees();
  }

  async getSystemHealth() {
    const api = this.getAPI();
    return await api.getSystemHealth();
  }

  async getTree(treeId: string) {
    const api = this.getAPI();
    return await api.getTree({ treeId: treeId as any });
  }

  /**
   * Check if initialized
   */
  static isReady(): boolean {
    const ready = this.state === 'initialized' && this.workerInstance !== null;
    console.log(
      `[WorkerAPIClient.isReady] state: ${this.state}, hasInstance: ${!!this.workerInstance}, returning: ${ready}`
    );
    return ready;
  }

  /**
   * Reset (mainly for testing)
   */
  static reset(): void {
    console.log('[WorkerAPIClient.reset] Resetting state');
    this.workerInstance = null;
    this.state = 'uninitialized';
    this.initializationPromise = null;
    this.lastError = null;
  }
}

// Export for compatibility
export const getWorkerAPIClient = (): WorkerAPI => WorkerAPIClient.getSingleton() as unknown as WorkerAPI;
