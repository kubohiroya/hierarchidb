/**
 * WorkerAPIClient - Synchronous singleton for Worker access
 */

import { getWorkerClient } from './initWorkerClient';
import type { Remote } from 'comlink';
import type WorkerModule from './worker';

// Create a type that matches the expected interface
type WorkerInterface = Remote<typeof WorkerModule>;

export class NotInitializedError extends Error {
  constructor() {
    super('WorkerAPIClient is not initialized. Make sure to call initialize() first.');
    this.name = 'NotInitializedError';
  }
}

export class WorkerAPIClient {
  private static workerInstance: WorkerInterface | null = null;
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
      console.log('[WorkerAPIClient.doInitialize] Calling getWorkerClient()...');
      const remoteWorker = await getWorkerClient(); // getWorkerClient now has retry logic
      console.log('[WorkerAPIClient.doInitialize] Remote worker obtained:', !!remoteWorker);

      // Test the connection immediately
      console.log('[WorkerAPIClient.doInitialize] Testing worker connection...');
      try {
        const pingResult = await remoteWorker.ping();
        console.log('[WorkerAPIClient.doInitialize] Worker connection test successful:', pingResult);
        
        // Check if this was a retry (error state indicates previous failure)
        if (this.lastError) {
          console.log('👍 [WorkerAPIClient.doInitialize] Reconnection successful after previous failure!');
        }
      } catch (pingError) {
        console.error('[WorkerAPIClient.doInitialize] Worker connection test failed:', pingError);
        throw new Error(`Worker connection test failed: ${pingError}`);
      }

      // Store the worker instance only after successful connection test
      this.workerInstance = remoteWorker;

      if (!this.workerInstance) {
        throw new Error('getWorkerClient returned null');
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
   * Get singleton Worker instance directly
   */
  static getSingleton(): WorkerInterface {
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
    return this.workerInstance;
  }

  /**
   * Reset the WorkerAPIClient state to allow re-initialization
   * Useful when connection fails and needs to be retried
   */
  static reset(): void {
    console.log('[WorkerAPIClient.reset] Resetting client state');
    
    // Try to clean up existing worker instance
    if (this.workerInstance) {
      try {
        if ('terminate' in this.workerInstance) {
          (this.workerInstance as any).terminate();
        }
      } catch (error) {
        console.warn('[WorkerAPIClient.reset] Failed to terminate worker:', error);
      }
    }
    
    this.state = 'uninitialized';
    this.workerInstance = null;
    this.lastError = null;
    this.initializationPromise = null;
    
    console.log('[WorkerAPIClient.reset] Reset complete');
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


}

// Export for compatibility
export const getWorkerAPIClient = () => WorkerAPIClient.getSingleton();