/// <reference types="vite-plugin-comlink/client" />
/**
 * Initialize Worker with vite-plugin-comlink
 * This file is responsible for creating the Worker URL and establishing connection
 */

import * as Comlink from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

// Global instance
let workerInstance: WorkerAPI | null = null;

/**
 * Initialize the Worker using ComlinkWorker
 * Creates the Worker URL and returns the Remote object
 */
export async function initializeWorker(): Promise<WorkerAPI> {
  // Return existing instance if already initialized
  if (workerInstance) {
    console.log('[initWorker] Returning existing worker instance');
    return workerInstance;
  }

  console.log('[initWorker] Starting worker initialization...');
  console.log('[initWorker] Available globals:', {
    ComlinkWorker: typeof (globalThis as any).ComlinkWorker,
    Worker: typeof Worker,
    Comlink: typeof Comlink,
  });

  try {
    let worker: any;
    
    // Method 1: Try using ComlinkWorker from vite-plugin-comlink
    if (typeof (globalThis as any).ComlinkWorker !== 'undefined') {
      console.log('[initWorker] Using ComlinkWorker approach');
      try {
        worker = new (globalThis as any).ComlinkWorker(
          new URL('./worker', import.meta.url),
          { type: 'module' }
        );
        workerInstance = await worker;
        console.log('[initWorker] ComlinkWorker initialization successful');
      } catch (comlinkWorkerError) {
        console.warn('[initWorker] ComlinkWorker failed, falling back to standard approach:', comlinkWorkerError);
        worker = null;
      }
    }
    
    // Method 2: Fallback to standard Comlink approach
    if (!worker || !workerInstance) {
      console.log('[initWorker] Using standard Comlink + Worker approach');
      
      // Create standard Worker
      const webWorker = new Worker(
        new URL('./worker', import.meta.url),
        { type: 'module' }
      );

      console.log('[initWorker] WebWorker created, wrapping with Comlink...');
      
      // Wrap with Comlink
      workerInstance = Comlink.wrap(webWorker) as unknown as WorkerAPI;
      
      console.log('[initWorker] Comlink.wrap completed');
    }

    if (!workerInstance) {
      throw new Error('Failed to create worker instance with any method');
    }

    console.log('[initWorker] Worker initialized successfully');
    console.log('[initWorker] Worker instance type:', typeof workerInstance);
    
    // Test basic functionality
    try {
      console.log('[initWorker] Testing worker methods...');
      const methods = Object.getOwnPropertyNames(workerInstance);
      console.log('[initWorker] Available methods:', methods);
      
      // Test specific methods
      console.log('[initWorker] Checking specific methods:');
      console.log('[initWorker] getTrees:', typeof workerInstance.getTrees);
      console.log('[initWorker] getSystemHealth:', typeof workerInstance.getSystemHealth);
      console.log('[initWorker] getTree:', typeof workerInstance.getTree);
    } catch (methodError) {
      console.warn('[initWorker] Could not enumerate methods:', methodError);
    }

    // Skip health check - it can cause initialization deadlock
    // Worker will be tested when actually used
    
    // No need to test methods here - they will be tested when used

    return workerInstance;
  } catch (error) {
    console.error('[initWorker] Failed to initialize Worker:', error);
    console.error('[initWorker] Error stack:', (error as Error)?.stack);
    workerInstance = null;
    throw error;
  }
}

/**
 * Get the Worker instance (must be initialized first)
 */
export function getWorker(): WorkerAPI {
  if (!workerInstance) {
    throw new Error('Worker not initialized. Call initializeWorker() first.');
  }
  return workerInstance;
}
