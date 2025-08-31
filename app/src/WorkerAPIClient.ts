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
    // Handle based on current state
    switch (this.state) {
      case 'initialized':

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

        break;

      case 'uninitialized':

        break;
    }

    // Start new initialization

    this.state = 'initializing';

    this.initializationPromise = this.doInitialize()
      .then(() => {

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


    try {

      const remoteWorker = await getWorkerClient(); // getWorkerClient now has retry logic


      // Test the connection immediately
      try {
        const pingResult = await remoteWorker.ping();
        
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

    if (this.state !== 'initialized' || !this.workerInstance) {
      console.error('[WorkerAPIClient.getSingleton] Not initialized', {
        state: this.state,
        hasInstance: !!this.workerInstance,
        lastError: this.lastError,
      });
      throw new NotInitializedError();
    }


    return this.workerInstance;
  }

  /**
   * Reset the WorkerAPIClient state to allow re-initialization
   * Useful when connection fails and needs to be retried
   */
  static reset(): void {

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
   * Get raw Worker instance for initialization detection
   */
  static getRawWorkerInstance(): Worker | null {
    // Import the function from initWorkerClient
    // @ts-ignore - dynamic import
    const { getRawWorkerInstance } = require('./initWorkerClient');
    return getRawWorkerInstance();
  }


}

// Export for compatibility
export const getWorkerAPIClient = () => WorkerAPIClient.getSingleton();