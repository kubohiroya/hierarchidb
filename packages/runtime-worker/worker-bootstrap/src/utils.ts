/**
 * Utility functions for Worker initialization
 */

import { WorkerInitializationReporter } from './WorkerInitializationReporter';
import type { InitializationStep } from './types';

/**
 * Helper function to wrap the entire Worker initialization with reporting
 */
export async function initializeWorkerWithReporting(
  initFunction: () => Promise<void>,
  steps?: InitializationStep[],
  debug = false
): Promise<void> {
  const reporter = new WorkerInitializationReporter(steps || [], debug);
  
  try {
    // Run the main initialization function
    await initFunction();
    
    // Report completion
    reporter.reportComplete();
    
    if (debug) {
      console.log('[Worker] Initialization completed successfully');
    }
  } catch (error) {
    console.error('[Worker] Initialization failed:', error);
    reporter.reportError(error as Error);
    throw error;
  }
}

/**
 * Create a lazy singleton initializer for Worker
 * 
 * This creates a singleton pattern that initializes only once,
 * suitable for use with the dual-layer provider system.
 */
export function createLazySingletonInitializer<T>(
  factory: () => Promise<T>,
  reportProgress?: (message: string, progress: number) => void
): () => Promise<T> {
  let instance: T | null = null;
  let initPromise: Promise<T> | null = null;
  
  return async () => {
    if (instance) {
      return instance;
    }
    
    if (initPromise) {
      return initPromise;
    }
    
    initPromise = (async () => {
      try {
        reportProgress?.('Starting initialization', 0);
        instance = await factory();
        reportProgress?.('Initialization complete', 100);
        return instance;
      } catch (error) {
        initPromise = null;
        throw error;
      }
    })();
    
    return initPromise;
  };
}

/**
 * Default initialization steps for common Worker setup
 */
export const DEFAULT_INIT_STEPS: InitializationStep[] = [
  { name: 'Loading core modules', weight: 10 },
  { name: 'Initializing runtime', weight: 20 },
  { name: 'Setting up message handlers', weight: 10 },
  { name: 'Preparing API', weight: 20 },
  { name: 'Initializing singleton instance', weight: 30 },
  { name: 'Finalizing setup', weight: 10 },
];

/**
 * Create a Worker with initialization reporting built-in
 */
export function createReportingWorker(
  workerUrl: URL | string,
  options?: WorkerOptions,
  debug = false
): Worker {
  const worker = new Worker(workerUrl, options);
  
  if (debug) {
    worker.addEventListener('message', (event) => {
      if (event.data.type?.startsWith('INIT_')) {
        console.log('[Worker Message]', event.data);
      }
    });
  }
  
  return worker;
}