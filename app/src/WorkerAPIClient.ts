/**
 * WorkerAPIClient - Synchronous singleton for Worker access
 */

import { initializeWorker } from './initWorker';
import type { WorkerAPI } from '@hierarchidb/common-api';

export class NotInitializedError extends Error {
  constructor() {
    super('WorkerAPIClient is not initialized. Make sure to call initialize() first.');
    this.name = 'NotInitializedError';
  }
}

export class WorkerAPIClient {
  private static workerInstance: WorkerAPI | null = null;
  private static isInitialized = false;
  private static initializationPromise: Promise<void> | null = null;

  /**
   * Initialize the Worker (must be called once at app startup)
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[WorkerAPIClient] Already initialized');
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      console.log('[WorkerAPIClient] Initialization already in progress, waiting...');
      return this.initializationPromise;
    }

    // Start new initialization
    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private static async doInitialize(): Promise<void> {
    console.log('[WorkerAPIClient] Starting initialization...');
    
    try {
      // Simply get the Comlink-wrapped worker instance
      this.workerInstance = await initializeWorker();
      
      // That's it! Worker should initialize itself internally
      this.isInitialized = true;
      console.log('[WorkerAPIClient] Initialized successfully');
    } catch (error) {
      // Reset on failure
      this.initializationPromise = null;
      this.workerInstance = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Get singleton Worker API instance directly
   */
  static getSingleton(): WorkerAPI {
    if (!this.isInitialized || !this.workerInstance) {
      throw new NotInitializedError();
    }
    
    console.log('[WorkerAPIClient] Returning worker instance directly');
    return this.workerInstance;
  }

  /**
   * Get the raw worker API (direct access to worker methods)
   */
  getAPI() {
    if (!WorkerAPIClient.isInitialized || !WorkerAPIClient.workerInstance) {
      throw new NotInitializedError();
    }
    
    console.log('[WorkerAPIClient] Returning worker API:', WorkerAPIClient.workerInstance);
    console.log('[WorkerAPIClient] API methods:', Object.getOwnPropertyNames(WorkerAPIClient.workerInstance));
    console.log('[WorkerAPIClient] getNode method type:', typeof WorkerAPIClient.workerInstance.getNode);
    console.log('[WorkerAPIClient] getTree method type:', typeof WorkerAPIClient.workerInstance.getTree);
    
    return WorkerAPIClient.workerInstance;
  }

  /**
   * Direct access to worker methods for convenience
   */
  async getTrees() {
    const api = this.getAPI();
    return await api.getTrees();
  }

  async getSystemHealth() {
    const api = this.getAPI();
    return await api.getSystemHealth();
  }

  async getTree(treeId: string) {
    const api = this.getAPI();
    return await api.getTree({ treeId: treeId as any });
  }

  /**
   * Check if initialized
   */
  static isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset (mainly for testing)
   */
  static reset(): void {
    this.workerInstance = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// Export for compatibility
export const getWorkerAPIClient = () => WorkerAPIClient.getSingleton();