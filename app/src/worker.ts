/**
 * Worker entry point for the application
 * 
 * Exposes a SingletonProvider that returns the initialized WorkerAPIImpl.
 * This creates a clean separation between Comlink exposure and API initialization.
 */

import * as Comlink from 'comlink';
import { WorkerAPIImpl } from '@hierarchidb/runtime-worker';
import type { WorkerAPI } from '@hierarchidb/common-api';

// Get app name from environment
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';

console.log('[App Worker] Starting...');

/**
 * SingletonProvider - The only responsibility is to provide the initialized WorkerAPI singleton
 * This is immediately exposed via Comlink and handles lazy initialization internally.
 */
class SingletonProvider {
  private instancePromise: Promise<WorkerAPIImpl> | null = null;

  /**
   * Get the WorkerAPI singleton instance
   * Ensures initialization happens only once and all subsequent calls get the same instance
   */
  async getSingleton(): Promise<WorkerAPI> {
    if (!this.instancePromise) {
      console.log('[SingletonProvider] Creating WorkerAPIImpl singleton...');
      this.instancePromise = WorkerAPIImpl.getSingleton(appName);
      
      // Log when initialization completes (store promise to avoid null check issue)
      const promise = this.instancePromise;
      promise.then(() => {
        console.log('[SingletonProvider] WorkerAPIImpl initialization complete');
      }).catch((error) => {
        console.error('[SingletonProvider] WorkerAPIImpl initialization failed:', error);
        this.instancePromise = null; // Allow retry on next call
      });
    }
    
    return this.instancePromise;
  }
}

// Create and immediately expose the SingletonProvider
const provider = new SingletonProvider();
console.log('[App Worker] Exposing SingletonProvider via Comlink...');
Comlink.expose(provider);
console.log('[App Worker] SingletonProvider exposed and ready');