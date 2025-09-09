/**
 * WorkerAPIClient - Synchronous singleton for Worker access
 */

import { getWorkerClient } from './client';
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
        console.log(
          '[WorkerAPIClient.initialize] Already initializing, returning existing promise',
        );
        if (this.initializationPromise) {
          return this.initializationPromise;
        }
        // If promise is somehow null, fall through to reinitialize
        console.warn(
          '[WorkerAPIClient.initialize] State is initializing but no promise found, reinitializing',
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
        // Only mark initialized when we've verified readiness (ping or INIT_COMPLETE observed)
        this.state = this.verified ? 'initialized' : 'initializing';
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

      // Set the instance early so Provider fast-paths can see it
      this.workerInstance = remoteWorker;


      // Test the connection (best-effort). Skip if we already saw INIT_COMPLETE.
      try {
        let initComplete = false;
        try {
          const mod = await import('./client');
          if (typeof (mod as any)?.isWorkerInitCompleted === 'function') {
            initComplete = Boolean((mod as any).isWorkerInitCompleted());
          }
        } catch {
        }

        if (!initComplete) {
          const pingResult = await remoteWorker.ping();
          // eslint-disable-next-line no-console
          console.log('[WorkerAPIClient.doInitialize] ping OK', pingResult);
          this.verified = true;
        } else {
          // eslint-disable-next-line no-console
          console.log('[WorkerAPIClient.doInitialize] INIT_COMPLETE observed; skipping ping');
          this.verified = true;
        }
        if (this.lastError) {
          console.log('👍 [WorkerAPIClient.doInitialize] Reconnection successful after previous failure!');
        }
      } catch (pingError) {
        console.warn('[WorkerAPIClient.doInitialize] Ping failed (continuing, channel will gate readiness):', pingError);
        // Leave this.verified as false; Provider will wait on channel/event.
      }

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
    try {
      if (this.workerInstance) {
        // Attempt to terminate raw worker if possible
        const raw = WorkerAPIClient.getRawWorkerInstance();
        try {
          raw?.terminate();
        } catch {
        }
      }
    } catch {
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
    try {
      const globalInit = (typeof window !== 'undefined') && (window as any).__HDB_INIT_COMPLETE__;
      if (!this.verified && globalInit) this.verified = true;
      if (this.state !== 'initialized' && this.workerInstance && globalInit) {
        this.state = 'initialized';
        // eslint-disable-next-line no-console
        console.log('[WorkerAPIClient] Promoted to initialized via global INIT_COMPLETE');
      }
    } catch {
    }
    const ready = this.state === 'initialized' && this.workerInstance !== null;
    // Reduce console noise: only log when explicitly enabled
    // To re-enable: set VITE_WORKERAPI_LOG=1
    try {
      if ((import.meta as any)?.env?.VITE_WORKERAPI_LOG === '1') {
        // eslint-disable-next-line no-console
        console.log(
          `[WorkerAPIClient.isReady] state: ${this.state}, hasInstance: ${!!this.workerInstance}, returning: ${ready}`,
        );
      }
    } catch {
    }
    return ready;
  }

  /**
   * Get raw Worker instance for initialization detection
   */
  static getRawWorkerInstance(): Worker | null {
    // Import the function from initWorkerClient
    // @ts-ignore - dynamic import
    const { getRawWorkerInstance } = require('./client');
    return getRawWorkerInstance();
  }


}

// Export for compatibility
export const getWorkerAPIClient = () => WorkerAPIClient.getSingleton();
