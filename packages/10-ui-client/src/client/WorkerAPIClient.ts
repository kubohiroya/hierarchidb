/**
 * @file WorkerServicesClient.ts
 * @description Singleton client for managing Worker services via Comlink
 */

import * as Comlink from 'comlink';
import type { WorkerAPI } from '@hierarchidb/01-api';
import { SingletonMixin } from '@hierarchidb/00-core';
import { createWorker } from '../worker-loader';

/**
 * Singleton client for Worker services management
 */
export class WorkerAPIClient {
  private worker: Worker | undefined;
  private workerAPIProxy: Comlink.Remote<WorkerAPI> | undefined;

  /**
   * Initialize Worker and establish Comlink connection
   */
  static async getSingleton(): Promise<WorkerAPIClient> {
    return SingletonMixin.getSingleton(WorkerAPIClient.name, async () => {
      const client = new WorkerAPIClient();

      // Create Worker instance using the loader
      client.worker = createWorker();

      // Wrap with Comlink
      client.workerAPIProxy = Comlink.wrap<WorkerAPI>(client.worker);

      // Initialize Worker API
      await client.workerAPIProxy.initialize();

      return client;
    });
  }

  /**
   * Test Worker connection
   */
  async ping(): Promise<boolean> {
    if (!this.workerAPIProxy) return false;

    try {
      // Call a simple method to test connection
      await this.workerAPIProxy.initialize();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup and terminate Worker
   */
  async cleanup(): Promise<void> {
    if (this.workerAPIProxy) {
      try {
        await this.workerAPIProxy.shutdown();
      } catch (error) {
        console.error('Error disposing worker proxy:', error);
      }
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }

    this.workerAPIProxy = undefined;
  }

  /**
   * Get all service facades
   */
  getAPI(): Comlink.Remote<WorkerAPI> {
    if (!this.workerAPIProxy) {
      throw new Error('Worker not initialized');
    }

    // Return the worker proxy which implements all service interfaces
    return this.workerAPIProxy;
  }
}
