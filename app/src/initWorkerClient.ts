/// <reference types="vite-plugin-comlink/client" />
/**
 * Initialize Worker with vite-plugin-comlink
 * Uses SingletonProvider pattern for clean initialization
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { Remote } from 'comlink';

// Type for the SingletonProvider exposed by the Worker
interface SingletonProvider {
  getSingleton(): Promise<Remote<WorkerAPI>>;
}

// Global instances
let providerInstance: Remote<SingletonProvider> | null = null;
let workerAPIInstance: Remote<WorkerAPI> | null = null;

/**
 * Initialize the Worker and get the WorkerAPI singleton
 */
export async function initializeWorker(): Promise<Remote<WorkerAPI>> {
  // Return existing instance if already initialized
  if (workerAPIInstance) {
    return workerAPIInstance;
  }

  console.log('[initWorker] Creating Worker with ComlinkWorker...');

  try {
    // Create Worker instance - this gives us the SingletonProvider
    if (!providerInstance) {
      providerInstance = new ComlinkWorker<SingletonProvider>(
        new URL('./worker', import.meta.url), 
        {
          type: 'module',
        }
      );
      console.log('[initWorker] SingletonProvider obtained');
    }
    
    // Get the WorkerAPI singleton from the provider
    console.log('[initWorker] Requesting WorkerAPI singleton from provider...');
    workerAPIInstance = await providerInstance.getSingleton();
    
    console.log('[initWorker] WorkerAPI singleton obtained successfully');
    
    // Verify the API is working
    if (workerAPIInstance && typeof workerAPIInstance.ping === 'function') {
      console.log('[initWorker] WorkerAPI methods are accessible');
    }
    
    if (!workerAPIInstance) {
      throw new Error('Failed to get WorkerAPI instance from provider');
    }
    
    return workerAPIInstance;
  } catch (error) {
    console.error('[initWorker] Failed to initialize Worker:', error);
    providerInstance = null;
    workerAPIInstance = null;
    throw error;
  }
}

/**
 * Get the Worker instance (must be initialized first)
 */
export async function getWorkerClient(): Promise<Remote<WorkerAPI>> {
  if (!workerAPIInstance) {
    return await initializeWorker();
  }
  return workerAPIInstance;
}