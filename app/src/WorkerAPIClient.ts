/**
 * WorkerAPIClient - Synchronous singleton for Worker access
 */

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
    switch (WorkerAPIClient.state) {
      case 'initialized':

        return;

      case 'initializing':
        if (WorkerAPIClient.initializationPromise) {
          return WorkerAPIClient.initializationPromise;
        }
        // If promise is somehow null, fall through to reinitialize
        
        break;

      case 'error':

        break;

      case 'uninitialized':

        break;
    }

    // Start new initialization

    WorkerAPIClient.state = 'initializing';

    WorkerAPIClient.initializationPromise = WorkerAPIClient.doInitialize()
      .then(() => {
        // Only mark initialized when we've verified readiness (ping or INIT_COMPLETE observed)
        WorkerAPIClient.state = WorkerAPIClient.verified ? 'initialized' : 'initializing';
        WorkerAPIClient.lastError = null;
        WorkerAPIClient.initializationPromise = null;
      })
      .catch((error) => {
        
        WorkerAPIClient.state = 'error';
        WorkerAPIClient.lastError = error instanceof Error ? error : new Error(String(error));
        WorkerAPIClient.initializationPromise = null;
        throw error;
      });

    return WorkerAPIClient.initializationPromise;
  }

  private static async doInitialize(): Promise<void> {


    try {

      const { getWorkerClient, isWorkerInitCompleted } = await loadClientModule();
      const remoteWorker = await getWorkerClient(); // getWorkerClient now has retry logic

      // Set the instance early so Provider fast-paths can see it
      WorkerAPIClient.workerInstance = remoteWorker;


      // Test the connection (best-effort). Skip if we already saw INIT_COMPLETE.
      try {
        const initComplete = Boolean(isWorkerInitCompleted?.());
        if (!initComplete) {
          await remoteWorker.ping();
          WorkerAPIClient.verified = true;
        } else {
          
          WorkerAPIClient.verified = true;
        }
        
      } catch (pingError) {
        
        // Leave this.verified as false; Provider will wait on channel/event.
      }

      if (!WorkerAPIClient.workerInstance) {
        throw new Error('getWorkerClient returned null');
      }


    } catch (error) {
      // Clean up on failure
      WorkerAPIClient.workerInstance = null;
      throw error;
    }
  }

  /**
   * Get singleton Worker instance directly
   */
  static getSingleton(): WorkerInterface {
    if (!WorkerAPIClient.workerInstance) {
      
      throw new NotInitializedError();
    }
    if (WorkerAPIClient.state !== 'initialized' && import.meta ?.env?.VITE_WORKERAPI_LOG === '1') {
      console.warn('[WorkerAPIClient] getSingleton called before initialization');
    }
    return WorkerAPIClient.workerInstance;
  }

  /**
   * Convenience: ensure initialized and return the instance.
   * Safe to call anywhere you would have used getSingleton() + initialize().
   */
  static async getOrInit(): Promise<WorkerInterface> {
    if (!WorkerAPIClient.isReady()) {
      await WorkerAPIClient.initialize();
    }
    return WorkerAPIClient.getSingleton();
  }

  /**
   * Reset the WorkerAPIClient state to allow re-initialization
   * Useful when connection fails and needs to be retried
   */
  static reset(): void {
    if (WorkerAPIClient.workerInstance) {
      // Attempt to terminate raw worker if possible
      const raw = WorkerAPIClient.getRawWorkerInstance();
      raw?.terminate();
    }
    WorkerAPIClient.workerInstance = null;
    WorkerAPIClient.state = 'uninitialized';
    WorkerAPIClient.initializationPromise = null;
    WorkerAPIClient.lastError = null;
    WorkerAPIClient.verified = false;
  }


  /**
   * Check if initialized
   */
  static isReady(): boolean {
    const module = getClientModuleOrNull();
    const initComplete = module?.isWorkerInitCompleted?.();

    if (!WorkerAPIClient.verified && initComplete) {
      WorkerAPIClient.verified = true;
    }

    // Cross-module safeguard: if global INIT_COMPLETE observed and we have an instance, promote to initialized
    const globalInit = typeof window !== 'undefined' && (window as WorkerStatusWindow).__HDB_INIT_COMPLETE__ === true;
    if (!WorkerAPIClient.verified && globalInit) WorkerAPIClient.verified = true;
    if (WorkerAPIClient.state !== 'initialized' && WorkerAPIClient.workerInstance && (globalInit || initComplete)) {
      WorkerAPIClient.state = 'initialized';
      
    }
    const ready = WorkerAPIClient.state === 'initialized' && WorkerAPIClient.workerInstance !== null;
    // Reduce console noise: only log when explicitly enabled
    // To re-enable: set VITE_WORKERAPI_LOG=1
    return ready;
  }

  /**
   * Get raw Worker instance for initialization detection
   */
  static getRawWorkerInstance(): Worker | null {
    const module = getClientModuleOrNull();
    return module?.getRawWorkerInstance?.() ?? null;
  }


}

// Export for compatibility
export const getWorkerAPIClient = () => WorkerAPIClient.getSingleton();

type WorkerStatusWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
};
type ClientModule = typeof import('./client.js');

let clientModule: ClientModule | null = null;
let clientModulePromise: Promise<ClientModule> | null = null;

async function loadClientModule(): Promise<ClientModule> {
  if (!clientModulePromise) {
    clientModulePromise = import('./client.js').then((module) => {
      clientModule = module;
      return module;
    }).catch((error) => {
      clientModulePromise = null;
      throw error;
    });
  }
  return clientModulePromise;
}

function getClientModuleOrNull(): ClientModule | null {
  return clientModule;
}
