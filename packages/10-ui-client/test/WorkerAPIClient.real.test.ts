/**
 * @file WorkerAPIClient.real.test.ts
 * @description Test suite for WorkerAPIClient with real Worker integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerAPIClient } from '../src/client/WorkerAPIClient';
import { setWorkerUrl } from '../src/worker-loader';

// Mock worker for testing - this simulates the actual worker behavior
const createMockWorkerScript = (): string => {
  return `
    // Import Comlink for the worker
    importScripts('https://unpkg.com/comlink/dist/umd/comlink.js');
    
    // Create a simple mock implementation of WorkerAPI
    const mockWorkerAPI = {
      async initialize() {
        return Promise.resolve();
      },
      
      shutdown() {
        // Cleanup
      },
      
      // TreeQueryService
      async getTrees() {
        return [];
      },
      
      async getTree(params) {
        return { treeId: params.treeId, name: 'Test Tree' };
      },
      
      async getNode(params) {
        return { nodeId: params.nodeId, name: 'Test Node' };
      },
      
      async getChildren(params) {
        return [];
      },
      
      async getDescendants(params) {
        return [];
      },
      
      async getAncestors(params) {
        return [];
      },
      
      async searchNodes(params) {
        return [];
      },
      
      // TreeObservableService - Return proper Observable-like objects
      observeNode(params) {
        return {
          subscribe: (observer) => {
            // Emit initial value asynchronously
            setTimeout(() => {
              observer.next({ node: { nodeId: params.nodeId, name: 'Observed Node' } });
            }, 10);
            
            return {
              unsubscribe: () => {
                // Cleanup subscription
              }
            };
          }
        };
      },
      
      observeChildren(params) {
        return {
          subscribe: (observer) => {
            setTimeout(() => {
              observer.next({ children: [] });
            }, 10);
            
            return {
              unsubscribe: () => {}
            };
          }
        };
      },
      
      observeSubtree(params) {
        return {
          subscribe: (observer) => {
            setTimeout(() => {
              observer.next({ subtree: [] });
            }, 10);
            
            return {
              unsubscribe: () => {}
            };
          }
        };
      },
      
      observeWorkingCopies(params) {
        return {
          subscribe: (observer) => {
            setTimeout(() => {
              observer.next({ workingCopies: [] });
            }, 10);
            
            return {
              unsubscribe: () => {}
            };
          }
        };
      },
      
      // TreeMutationService
      async executeCommand(command) {
        return { success: true, result: command };
      },
      
      async createWorkingCopyForCreate(params) {
        return { 
          success: true, 
          workingCopyId: 'wc-' + Date.now(),
          ...params 
        };
      },
      
      async createWorkingCopy(params) {
        return { 
          success: true, 
          workingCopyId: 'wc-edit-' + Date.now(),
          ...params 
        };
      },
      
      async discardWorkingCopy(params) {
        return { success: true, workingCopyId: params.workingCopyId };
      },
      
      async commitWorkingCopyForCreate(params) {
        return { 
          success: true, 
          nodeId: 'node-' + Date.now(),
          workingCopyId: params.workingCopyId 
        };
      },
      
      async commitWorkingCopy(params) {
        return { success: true, workingCopyId: params.workingCopyId };
      },
      
      async copyNodes(params) {
        return params.nodeIds.map(id => ({ nodeId: id + '-copy', originalId: id }));
      },
      
      async moveNodes(params) {
        return { 
          success: true, 
          movedNodes: params.nodeIds,
          targetParentId: params.targetParentId 
        };
      },
      
      async duplicateNodes(params) {
        return { 
          success: true, 
          duplicatedNodes: params.nodeIds.map(id => id + '-duplicate')
        };
      },
      
      async pasteNodes(params) {
        return { 
          success: true, 
          pastedNodes: params.nodeIds,
          targetParentId: params.targetParentId 
        };
      },
      
      async moveToTrash(params) {
        return { 
          success: true, 
          trashedNodes: params.nodeIds 
        };
      },
      
      async remove(params) {
        return { 
          success: true, 
          removedNodes: params.nodeIds 
        };
      },
      
      async recoverFromTrash(params) {
        return { 
          success: true, 
          recoveredNodes: params.nodeIds 
        };
      },
      
      async exportNodes(params) {
        return JSON.stringify({ 
          exportedNodes: params.nodeIds, 
          timestamp: Date.now() 
        });
      },
      
      async importNodes(params) {
        return { 
          success: true, 
          importedCount: 5,
          parentId: params.parentId 
        };
      },
      
      async undo() {
        return { success: true, action: 'undo' };
      },
      
      async redo() {
        return { success: true, action: 'redo' };
      }
    };
    
    // Expose the API via Comlink
    Comlink.expose(mockWorkerAPI);
  `;
};

describe('WorkerAPIClient Real Integration Tests', () => {
  let client: WorkerAPIClient;
  let workerUrl: string;
  
  beforeEach(async () => {
    // Create a blob URL for the mock worker
    const workerBlob = new Blob([createMockWorkerScript()], { 
      type: 'application/javascript' 
    });
    workerUrl = URL.createObjectURL(workerBlob);
    
    // Set the worker URL
    setWorkerUrl(workerUrl);
    
    // Clear any existing singleton instance
    // @ts-ignore - Access private static property for testing
    if (WorkerAPIClient._instances) {
      // @ts-ignore
      WorkerAPIClient._instances.clear();
    }
  });
  
  afterEach(async () => {
    if (client) {
      await client.cleanup();
    }
    
    if (workerUrl) {
      URL.revokeObjectURL(workerUrl);
    }
  });
  
  describe('Real Worker Communication', () => {
    it('should initialize with real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      
      const pingResult = await client.ping();
      expect(pingResult).toBe(true);
      
      const api = client.getAPI();
      expect(api).toBeDefined();
    });
    
    it('should communicate with real worker for basic queries', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      const trees = await api.getTrees();
      expect(trees).toEqual([]);
      
      const tree = await api.getTree({ treeId: 'test-tree' });
      expect(tree).toEqual({ treeId: 'test-tree', name: 'Test Tree' });
      
      const node = await api.getNode({ nodeId: 'test-node' });
      expect(node).toEqual({ nodeId: 'test-node', name: 'Test Node' });
    });
    
    it('should handle observables from real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      // Test observeNode
      const nodeObservable = api.observeNode({ nodeId: 'test-node' });
      
      return new Promise<void>((resolve, reject) => {
        const subscription = nodeObservable.subscribe({
          next: (value) => {
            try {
              expect(value).toEqual({ 
                node: { nodeId: 'test-node', name: 'Observed Node' } 
              });
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
    
    it('should handle command execution with real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      const command = {
        type: 'CREATE_NODE' as const,
        payload: { name: 'New Node', nodeType: 'folder' }
      };
      
      const result = await api.executeCommand(command);
      expect(result).toEqual({ success: true, result: command });
    });
    
    it('should handle working copy operations with real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      // Create working copy
      const createResult = await api.createWorkingCopyForCreate({
        parentId: 'parent-1',
        nodeType: 'folder'
      });
      
      expect(createResult.success).toBe(true);
      expect(createResult.workingCopyId).toMatch(/^wc-\d+$/);
      expect(createResult.parentId).toBe('parent-1');
      expect(createResult.nodeType).toBe('folder');
      
      // Commit working copy
      const commitResult = await api.commitWorkingCopyForCreate({
        workingCopyId: createResult.workingCopyId!
      });
      
      expect(commitResult.success).toBe(true);
      expect(commitResult.nodeId).toMatch(/^node-\d+$/);
    });
    
    it('should handle node operations with real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      // Test move nodes
      const moveResult = await api.moveNodes({
        nodeIds: ['node1', 'node2'],
        targetParentId: 'new-parent'
      });
      
      expect(moveResult).toEqual({
        success: true,
        movedNodes: ['node1', 'node2'],
        targetParentId: 'new-parent'
      });
      
      // Test duplicate nodes
      const duplicateResult = await api.duplicateNodes({
        nodeIds: ['node1']
      });
      
      expect(duplicateResult).toEqual({
        success: true,
        duplicatedNodes: ['node1-duplicate']
      });
    });
    
    it('should handle trash operations with real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      // Move to trash
      const trashResult = await api.moveToTrash({
        nodeIds: ['node1', 'node2']
      });
      
      expect(trashResult).toEqual({
        success: true,
        trashedNodes: ['node1', 'node2']
      });
      
      // Recover from trash
      const recoverResult = await api.recoverFromTrash({
        nodeIds: ['node1']
      });
      
      expect(recoverResult).toEqual({
        success: true,
        recoveredNodes: ['node1']
      });
      
      // Permanent remove
      const removeResult = await api.remove({
        nodeIds: ['node2']
      });
      
      expect(removeResult).toEqual({
        success: true,
        removedNodes: ['node2']
      });
    });
    
    it('should handle import/export with real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      // Export nodes
      const exportResult = await api.exportNodes({
        nodeIds: ['node1', 'node2']
      });
      
      const exportData = JSON.parse(exportResult);
      expect(exportData.exportedNodes).toEqual(['node1', 'node2']);
      expect(exportData.timestamp).toBeTypeOf('number');
      
      // Import nodes
      const importResult = await api.importNodes({
        data: exportResult,
        parentId: 'import-parent'
      });
      
      expect(importResult).toEqual({
        success: true,
        importedCount: 5,
        parentId: 'import-parent'
      });
    });
    
    it('should handle undo/redo with real worker', async () => {
      client = await WorkerAPIClient.getSingleton();
      const api = client.getAPI();
      
      const undoResult = await api.undo();
      expect(undoResult).toEqual({ success: true, action: 'undo' });
      
      const redoResult = await api.redo();
      expect(redoResult).toEqual({ success: true, action: 'redo' });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle worker initialization failure', async () => {
      // Set invalid worker URL
      setWorkerUrl('/non-existent-worker.js');
      
      // Clear singleton
      // @ts-ignore
      if (WorkerAPIClient._instances) {
        // @ts-ignore
        WorkerAPIClient._instances.clear();
      }
      
      // Should fail to initialize
      await expect(WorkerAPIClient.getSingleton()).rejects.toThrow();
    });
  });
});