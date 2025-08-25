/**
 * Worker entry point for the application
 * This file is responsible for exposing the WorkerAPI via Comlink
 */

import * as Comlink from 'comlink';
import { WorkerAPIImpl } from '@hierarchidb/runtime-worker';

// Get app name from environment
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';

// Initialize and expose WorkerAPIImpl
async function initializeWorker() {
  console.log('[App Worker] Starting initialization...');
  
  try {
    console.log('[App Worker] Getting WorkerAPIImpl singleton...');
    const instance = await WorkerAPIImpl.getSingleton(appName);
    
    console.log('[App Worker] WorkerAPIImpl instance obtained:', instance);
    console.log('[App Worker] Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
    
    // Comlinkで直接expose - これだけで十分！
    console.log('[App Worker] Exposing instance via Comlink...');
    Comlink.expose(instance);
    
    console.log('[App Worker] Initialization successful');
    return instance;
  } catch (error) {
    console.error('[App Worker] Initialization failed:', error);
    console.error('[App Worker] Error stack:', (error as Error)?.stack);

    // エラーハンドラーも簡潔に
    const errorHandler = {
      initialize: async () => {
        throw new Error(`Worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      },
    };
    
    console.log('[App Worker] Exposing error handler via Comlink...');
    Comlink.expose(errorHandler);

    throw error;
  }
}

// Export the main initialization function directly
export default initializeWorker;

// Also make it available as a named export
export { initializeWorker };

// Initialize on module load
initializeWorker().catch((error) => {
  console.error('[App Worker] Failed to initialize:', error);
});
