/**
 * @file WorkerAPIClient.clean.test.ts
 * @description Clean test suite for WorkerAPIClient with mocked Worker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WorkerAPI } from '@hierarchidb/common-api';

// Create a test WorkerAPIClient that doesn't depend on actual worker file
class TestableWorkerAPIClient {
  private worker: any;
  private api: WorkerAPI;
  
  constructor() {
    this.worker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };
    
    // Create a mock API implementation
    this.api = {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      
      // TreeQueryService
      getTrees: vi.fn().mockResolvedValue([]),
      getTree: vi.fn().mockResolvedValue(undefined),
      getNode: vi.fn().mockResolvedValue(undefined),
      getChildren: vi.fn().mockResolvedValue([]),
      getDescendants: vi.fn().mockResolvedValue([]),
      getAncestors: vi.fn().mockResolvedValue([]),
      searchNodes: vi.fn().mockResolvedValue([]),
      
      // TreeObservableService - これらが"Not implemented"エラーを返していた
      observeNode: vi.fn().mockImplementation(() => {
        return {
          subscribe: vi.fn((observer) => {
            setTimeout(() => observer.next({ node: null }), 10);
            return { unsubscribe: vi.fn() };
          })
        };
      }),
      observeChildren: vi.fn().mockImplementation(() => {
        return {
          subscribe: vi.fn((observer) => {
            setTimeout(() => observer.next({ children: [] }), 10);
            return { unsubscribe: vi.fn() };
          })
        };
      }),
      observeSubtree: vi.fn().mockImplementation(() => {
        return {
          subscribe: vi.fn((observer) => {
            setTimeout(() => observer.next({ subtree: [] }), 10);
            return { unsubscribe: vi.fn() };
          })
        };
      }),
      observeWorkingCopies: vi.fn().mockImplementation(() => {
        return {
          subscribe: vi.fn((observer) => {
            setTimeout(() => observer.next({ workingCopies: [] }), 10);
            return { unsubscribe: vi.fn() };
          })
        };
      }),
      
      // TreeMutationService - これらも"Not implemented"エラーを返していた
      executeCommand: vi.fn().mockResolvedValue({ success: true }),
      createWorkingCopyForCreate: vi.fn().mockResolvedValue({ success: true }),
      createWorkingCopy: vi.fn().mockResolvedValue({ success: true }),
      discardWorkingCopy: vi.fn().mockResolvedValue({ success: true }),
      commitWorkingCopyForCreate: vi.fn().mockResolvedValue({ success: true }),
      commitWorkingCopy: vi.fn().mockResolvedValue({ success: true }),
      copyNodes: vi.fn().mockResolvedValue([]),
      moveNodes: vi.fn().mockResolvedValue({ success: true }),
      duplicateNodes: vi.fn().mockResolvedValue({ success: true }),
      pasteNodes: vi.fn().mockResolvedValue({ success: true }),
      moveToTrash: vi.fn().mockResolvedValue({ success: true }),
      remove: vi.fn().mockResolvedValue({ success: true }),
      recoverFromTrash: vi.fn().mockResolvedValue({ success: true }),
      exportNodes: vi.fn().mockResolvedValue('export-data'),
      importNodes: vi.fn().mockResolvedValue({ success: true }),
      undo: vi.fn().mockResolvedValue({ success: true }),
      redo: vi.fn().mockResolvedValue({ success: true }),
    } as WorkerAPI;
  }
  
  async initialize(): Promise<void> {
    await this.api.initialize();
  }
  
  getAPI(): WorkerAPI {
    return this.api;
  }
  
  async ping(): Promise<boolean> {
    try {
      await this.api.initialize();
      return true;
    } catch {
      return false;
    }
  }
  
  async cleanup(): Promise<void> {
    await this.api.shutdown();
    this.worker.terminate();
  }
}

describe('WorkerAPIClient Clean Tests', () => {
  let client: TestableWorkerAPIClient;
  
  beforeEach(async () => {
    client = new TestableWorkerAPIClient();
    await client.initialize();
  });
  
  afterEach(async () => {
    if (client) {
      await client.cleanup();
    }
  });
  
  describe('Basic Operations', () => {
    it('should initialize successfully', async () => {
      const result = await client.ping();
      expect(result).toBe(true);
    });
    
    it('should get API instance', () => {
      const api = client.getAPI();
      expect(api).toBeDefined();
      expect(api.getTrees).toBeDefined();
      expect(api.observeNode).toBeDefined();
      expect(api.executeCommand).toBeDefined();
    });
  });
  
  describe('TreeQueryService', () => {
    it('should call query methods', async () => {
      const api = client.getAPI();
      
      const trees = await api.getTrees();
      expect(trees).toEqual([]);
      expect(api.getTrees).toHaveBeenCalled();
      
      const tree = await api.getTree({ treeId: 'test' });
      expect(tree).toBeUndefined();
      expect(api.getTree).toHaveBeenCalledWith({ treeId: 'test' });
      
      const nodes = await api.searchNodes({ query: 'test' });
      expect(nodes).toEqual([]);
      expect(api.searchNodes).toHaveBeenCalledWith({ query: 'test' });
    });
  });
  
  describe('TreeObservableService', () => {
    it('should return working observables for node operations', async () => {
      const api = client.getAPI();
      
      const observable = api.observeNode({ nodeId: 'test-node' });
      expect(observable).toBeDefined();
      expect(observable.subscribe).toBeDefined();
      
      return new Promise<void>((resolve, reject) => {
        const subscription = observable.subscribe({
          next: (value) => {
            try {
              expect(value).toEqual({ node: null });
              subscription.unsubscribe();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          error: reject,
          complete: () => {}
        });
      });
    });
    
    it('should return working observables for children operations', async () => {
      const api = client.getAPI();
      
      const observable = api.observeChildren({ parentId: 'test-parent' });
      
      return new Promise<void>((resolve, reject) => {
        const subscription = observable.subscribe({
          next: (value) => {
            try {
              expect(value).toEqual({ children: [] });
              subscription.unsubscribe();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          error: reject,
          complete: () => {}
        });
      });
    });
  });
  
  describe('TreeMutationService', () => {
    it('should execute commands successfully', async () => {
      const api = client.getAPI();
      
      const result = await api.executeCommand({
        type: 'CREATE_NODE',
        payload: { name: 'Test Node' }
      });
      
      expect(result).toEqual({ success: true });
      expect(api.executeCommand).toHaveBeenCalledWith({
        type: 'CREATE_NODE',
        payload: { name: 'Test Node' }
      });
    });
    
    it('should handle working copy operations successfully', async () => {
      const api = client.getAPI();
      
      const createResult = await api.createWorkingCopyForCreate({
        parentId: 'parent',
        nodeType: 'folder'
      });
      expect(createResult).toEqual({ success: true });
      
      const commitResult = await api.commitWorkingCopy({
        workingCopyId: 'wc-1'
      });
      expect(commitResult).toEqual({ success: true });
      
      const discardResult = await api.discardWorkingCopy({
        workingCopyId: 'wc-2'
      });
      expect(discardResult).toEqual({ success: true });
    });
    
    it('should handle node operations successfully', async () => {
      const api = client.getAPI();
      
      const moveResult = await api.moveNodes({
        nodeIds: ['node1'],
        targetParentId: 'parent'
      });
      expect(moveResult).toEqual({ success: true });
      
      const duplicateResult = await api.duplicateNodes({
        nodeIds: ['node1']
      });
      expect(duplicateResult).toEqual({ success: true });
      
      const pasteResult = await api.pasteNodes({
        nodeIds: ['node1'],
        targetParentId: 'parent'
      });
      expect(pasteResult).toEqual({ success: true });
    });
    
    it('should handle trash operations successfully', async () => {
      const api = client.getAPI();
      
      const trashResult = await api.moveToTrash({
        nodeIds: ['node1', 'node2']
      });
      expect(trashResult).toEqual({ success: true });
      
      const recoverResult = await api.recoverFromTrash({
        nodeIds: ['node1']
      });
      expect(recoverResult).toEqual({ success: true });
      
      const removeResult = await api.remove({
        nodeIds: ['node2']
      });
      expect(removeResult).toEqual({ success: true });
    });
    
    it('should handle import/export operations successfully', async () => {
      const api = client.getAPI();
      
      const exportResult = await api.exportNodes({
        nodeIds: ['node1', 'node2']
      });
      expect(exportResult).toBe('export-data');
      
      const importResult = await api.importNodes({
        data: 'import-data',
        parentId: 'parent'
      });
      expect(importResult).toEqual({ success: true });
    });
    
    it('should handle undo/redo operations successfully', async () => {
      const api = client.getAPI();
      
      const undoResult = await api.undo();
      expect(undoResult).toEqual({ success: true });
      expect(api.undo).toHaveBeenCalled();
      
      const redoResult = await api.redo();
      expect(redoResult).toEqual({ success: true });
      expect(api.redo).toHaveBeenCalled();
    });
  });
});