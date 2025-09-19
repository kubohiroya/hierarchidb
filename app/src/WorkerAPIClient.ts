/**
 * WorkerAPIClient - Synchronous singleton for Worker access
 */

import { getWorkerClient, getRawWorkerInstance, isWorkerInitCompleted } from './client.js';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

// Create a type that matches the shared contract
type WorkerInterface = Remote<WorkerAPI>;

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
  private static verified: boolean = false;

  /**
   * Initialize the Worker (must be called once at app startup)
   */
  static async initialize(): Promise<void> {
    // Handle based on current state
    switch (this.state) {
      case 'initialized':

        return;

      case 'initializing':
        if (this.initializationPromise) {
          return this.initializationPromise;
        }
        // If promise is somehow null, fall through to reinitialize
        
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
        // Only mark initialized when we've verified readiness (ping or INIT_COMPLETE observed)
        this.state = this.verified ? 'initialized' : 'initializing';
        this.lastError = null;
        this.initializationPromise = null;
      })
      .catch((error) => {
        
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

      // Set the instance early so Provider fast-paths can see it
      this.workerInstance = remoteWorker;


      // Test the connection (best-effort). Skip if we already saw INIT_COMPLETE.
      try {
        const initComplete = Boolean(isWorkerInitCompleted?.());
        if (!initComplete) {
          const pingResult = await remoteWorker.ping();
          this.verified = true;
        } else {
          
          this.verified = true;
        }
        
      } catch (pingError) {
        
        // Leave this.verified as false; Provider will wait on channel/event.
      }

      if (!this.workerInstance) {
        throw new Error('getWorkerClient returned null');
      }


    } catch (error) {
      // Clean up on failure
      this.workerInstance = null;
      throw error;
    }
  }

  /**
   * Get singleton Worker instance directly
   */
  static getSingleton(): WorkerInterface {
    if (!this.workerInstance) {
      
      throw new NotInitializedError();
    }
    if (this.state !== 'initialized' && import.meta ?.env?.VITE_WORKERAPI_LOG === '1') {
      console.warn('[WorkerAPIClient] getSingleton called before initialization');
    }
    return this.workerInstance;
  }

  /**
   * Convenience: ensure initialized and return the instance.
   * Safe to call anywhere you would have used getSingleton() + initialize().
   */
  static async getOrInit(): Promise<WorkerInterface> {
    if (!this.isReady()) {
      await this.initialize();
    }
    return this.getSingleton();
  }

  /**
   * Reset the WorkerAPIClient state to allow re-initialization
   * Useful when connection fails and needs to be retried
   */
  static reset(): void {
    if (this.workerInstance) {
      // Attempt to terminate raw worker if possible
      const raw = WorkerAPIClient.getRawWorkerInstance();
      raw?.terminate();
    }
    this.workerInstance = null;
    this.state = 'uninitialized';
    this.initializationPromise = null;
    this.lastError = null;
    this.verified = false;
  }


  /**
   * Check if initialized
   */
  static isReady(): boolean {
    // Cross-module safeguard: if global INIT_COMPLETE observed and we have an instance, promote to initialized
    const globalInit = typeof window !== 'undefined' && (window as WorkerStatusWindow).__HDB_INIT_COMPLETE__ === true;
    if (!this.verified && globalInit) this.verified = true;
    if (this.state !== 'initialized' && this.workerInstance && globalInit) {
      this.state = 'initialized';
      
    }
    const ready = this.state === 'initialized' && this.workerInstance !== null;
    // Reduce console noise: only log when explicitly enabled
    // To re-enable: set VITE_WORKERAPI_LOG=1
    return ready;
  }

  /**
   * Get raw Worker instance for initialization detection
   */
  static getRawWorkerInstance(): Worker | null {
    return getRawWorkerInstance?.() ?? null;
  }


}

// Export for compatibility
export const getWorkerAPIClient = () => WorkerAPIClient.getSingleton();

type WorkerStatusWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
};
