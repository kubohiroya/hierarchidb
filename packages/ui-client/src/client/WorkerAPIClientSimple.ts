/**
 * Simplified WorkerAPIClient for testing
 * Uses inline worker to avoid Vite import issues
 */

import * as Comlink from 'comlink';
import type { WorkerAPI } from '@hierarchidb/api';

// Simple mock implementation for testing
const workerCode = `
// Import Comlink from CDN for blob worker
importScripts('https://unpkg.com/comlink/dist/umd/comlink.js');

const api = {
  async initialize() {
    console.log('Worker initialized');
    return Promise.resolve();
  },
  
  async dispose() {
    console.log('Worker disposed');
    return Promise.resolve();
  },
  
  async getTrees() {
    console.log('Getting trees');
    return [];
  },
  
  async getTree(params) {
    console.log('Getting tree:', params);
    return undefined;
  },
  
  async createTree(params) {
    console.log('Creating tree:', params);
    return {
      treeId: 'test-tree-' + Date.now(),
      name: params.name || 'Test Tree',
      description: params.description || ''
    };
  },
  
  // Add other required methods as stubs
  getNode: async () => undefined,
  getChildren: async () => [],
  getDescendants: async () => [],
  getAncestors: async () => [],
  searchNodes: async () => [],
  observeNode: () => { throw new Error('Not implemented'); },
  observeChildren: () => { throw new Error('Not implemented'); },
  observeSubtree: () => { throw new Error('Not implemented'); },
  observeWorkingCopies: () => { throw new Error('Not implemented'); },
  executeCommand: async () => ({ success: false, error: 'Not implemented' }),
  createWorkingCopyForCreate: async () => ({ success: false, error: 'Not implemented' }),
  createWorkingCopy: async () => ({ success: false, error: 'Not implemented' }),
  discardWorkingCopy: async () => ({ success: false, error: 'Not implemented' }),
  commitWorkingCopyForCreate: async () => ({ success: false, error: 'Not implemented' }),
  commitWorkingCopy: async () => ({ success: false, error: 'Not implemented' }),
  copyNodes: async () => [],
  moveNodes: async () => ({ success: false, error: 'Not implemented' }),
  duplicateNodes: async () => ({ success: false, error: 'Not implemented' }),
  pasteNodes: async () => ({ success: false, error: 'Not implemented' }),
  moveToTrash: async () => ({ success: false, error: 'Not implemented' }),
  permanentDelete: async () => ({ success: false, error: 'Not implemented' }),
  recoverFromTrash: async () => ({ success: false, error: 'Not implemented' }),
  exportNodes: async () => '',
  importNodes: async () => ({ success: false, error: 'Not implemented' }),
  undo: async () => ({ success: false, error: 'Not implemented' }),
  redo: async () => ({ success: false, error: 'Not implemented' }),
};

Comlink.expose(api);
`;

export class WorkerAPIClientSimple {
  private worker: Worker | undefined;
  private workerAPIProxy: Comlink.Remote<WorkerAPI> | undefined;
  
  static async create(): Promise<WorkerAPIClientSimple> {
    const client = new WorkerAPIClientSimple();
    
    // Create blob worker
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    client.worker = new Worker(workerUrl, { type: 'module' });
    
    // Wrap with Comlink
    client.workerAPIProxy = Comlink.wrap<WorkerAPI>(client.worker);
    
    // Initialize
    await client.workerAPIProxy.initialize();
    
    return client;
  }
  
  getAPI(): Comlink.Remote<WorkerAPI> {
    if (!this.workerAPIProxy) {
      throw new Error('Worker not initialized');
    }
    return this.workerAPIProxy;
  }
  
  async ping(): Promise<boolean> {
    try {
      await this.workerAPIProxy?.initialize();
      return true;
    } catch {
      return false;
    }
  }
  
  async cleanup(): Promise<void> {
    if (this.workerAPIProxy) {
      await this.workerAPIProxy.dispose();
    }
    if (this.worker) {
      this.worker.terminate();
    }
  }
}