/// <reference types="vite-plugin-comlink/client" />
/**
 * Initialize Worker with vite-plugin-comlink
 */

import type { Remote } from 'comlink';

// Import the actual worker module type
import type WorkerModule from './worker';

// Global instance - properly typed
let workerInstance: Remote<typeof WorkerModule> | null = null;

/**
 * Initialize the Worker
 */
export async function initializeWorker(): Promise<Remote<typeof WorkerModule>> {
  const RETRY_DELAYS = [2000, 3000, 7000]; // 2, 3, 7 seconds
  
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    console.log(`[initWorker] Initialization attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}`);
    
    try {
      // Clean up any existing instance
      if (workerInstance) {
        console.log('[initWorker] Disposing previous worker instance');
        try {
          // Try to terminate the worker if possible
          if ('terminate' in workerInstance) {
            (workerInstance as any).terminate();
          }
        } catch (terminationError) {
          console.warn('[initWorker] Failed to terminate previous worker:', terminationError);
        }
        workerInstance = null;
      }

      console.log('[initWorker] Creating new Worker with ComlinkWorker...');

      // Create Worker instance - ComlinkWorker automatically wraps with Remote
      const worker = new ComlinkWorker<typeof WorkerModule>(
        new URL('./worker', import.meta.url), 
        {
          type: 'module',
        }
      );
      
      console.log('[initWorker] ComlinkWorker created:', typeof worker);
      
      // Test connection immediately with timeout
      console.log('[initWorker] Testing connection with ping...');
      const pingPromise = worker.ping();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Ping timeout after 5 seconds')), 5000)
      );
      
      const pingResult = await Promise.race([pingPromise, timeoutPromise]);
      console.log('[initWorker] Connection test successful:', pingResult);
      
      // Store the instance only after successful connection test
      workerInstance = worker;
      
      // Log success with emoji - especially important for retry success
      if (attempt > 0) {
        console.log(`👍 [initWorker] Reconnection successful after ${attempt} retries!`);
      } else {
        console.log('[initWorker] Worker API initialized successfully');
      }
      
      return workerInstance;
      
    } catch (error) {
      console.error(`[initWorker] Attempt ${attempt + 1} failed:`, error);
      
      // Clean up failed worker instance
      workerInstance = null;
      
      // If this isn't the last attempt, wait and retry
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`[initWorker] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('[initWorker] All retry attempts failed');
        throw error;
      }
    }
  }
  
  throw new Error('[initWorker] Maximum retry attempts exceeded');
}

/**
 * Get the Worker instance (must be initialized first)
 */
export async function getWorkerClient(): Promise<Remote<typeof WorkerModule>> {
  if (!workerInstance) {
    return await initializeWorker();
  }
  return workerInstance;
}