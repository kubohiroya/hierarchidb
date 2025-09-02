/**
 * Initialize Worker with Comlink
 */

import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

// Global instance - properly typed
let workerInstance: Remote<WorkerAPI> | null = null;
let rawWorkerInstance: Worker | null = null;

/**
 * Initialize the Worker
 */
export async function initializeWorker(): Promise<Remote<WorkerAPI>> {
  // Plugin auto-loading is performed inside the Worker context now.
  // Keep UI-side initialization minimal and focused on standing up the worker.

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

      console.log('[initWorker] Creating new Worker...');

      // First create the raw Worker instance
      rawWorkerInstance = new Worker(
        new URL('./worker', import.meta.url),
        { type: 'module' }
      );
      
      console.log('[initWorker] Raw Worker created');
      
      // Import Comlink to wrap the Worker
      const Comlink = await import('comlink');
      
      // Wrap the raw Worker with Comlink using the shared WorkerAPI contract
      const worker = Comlink.wrap<WorkerAPI>(rawWorkerInstance);
      
      console.log('[initWorker] Worker wrapped with Comlink:', typeof worker);
      console.log('[initWorker] Raw Worker instance available:', !!rawWorkerInstance);
      
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
export async function getWorkerClient(): Promise<Remote<WorkerAPI>> {
  if (!workerInstance) {
    return await initializeWorker();
  }
  return workerInstance;
}

/**
 * Get the raw Worker instance for initialization detection
 */
export function getRawWorkerInstance(): Worker | null {
  return rawWorkerInstance;
}
