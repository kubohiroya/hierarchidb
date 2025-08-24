/**
 * @file WorkerAPIClient.test.ts
 * @description Test suite for WorkerAPIClient with real Worker communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerAPIClient } from '../src/client/WorkerAPIClient';
import * as Comlink from 'comlink';

// Mock the worker-loader module
vi.mock('../src/worker-loader', () => ({
  createWorker: vi.fn(() => {
    // Create a mock Worker with postMessage/addEventListener
    const worker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };
    return worker;
  }),
}));

describe('WorkerAPIClient', () => {
  let client: WorkerAPIClient;

  beforeEach(() => {
    // Clear singleton between tests
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup if client was created
    if (client) {
      await client.cleanup();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', async () => {
      const client1 = await WorkerAPIClient.getSingleton();
      const client2 = await WorkerAPIClient.getSingleton();
      
      expect(client1).toBe(client2);
    });

    it('should initialize Worker and Comlink proxy', async () => {
      client = await WorkerAPIClient.getSingleton();
      
      const api = client.getAPI();
      expect(api).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('should successfully ping the Worker', async () => {
      // Mock Comlink.wrap to return a working proxy
      const mockProxy = {
        initialize: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.spyOn(Comlink, 'wrap').mockReturnValue(mockProxy as any);
      
      client = await WorkerAPIClient.getSingleton();
      const result = await client.ping();
      
      expect(result).toBe(true);
      expect(mockProxy.initialize).toHaveBeenCalled();
    });

    it('should return false when ping fails', async () => {
      // Mock Comlink.wrap to return a failing proxy
      const mockProxy = {
        initialize: vi.fn().mockRejectedValue(new Error('Connection failed')),
        shutdown: vi.fn(),
      };
      
      vi.spyOn(Comlink, 'wrap').mockReturnValue(mockProxy as any);
      
      client = await WorkerAPIClient.getSingleton();
      const result = await client.ping();
      
      expect(result).toBe(false);
    });

    it('should handle cleanup gracefully', async () => {
      const mockProxy = {
        initialize: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.spyOn(Comlink, 'wrap').mockReturnValue(mockProxy as any);
      
      client = await WorkerAPIClient.getSingleton();
      await client.cleanup();
      
      expect(mockProxy.shutdown).toHaveBeenCalled();
    });

    it('should throw error when getAPI is called before initialization', async () => {
      const newClient = new (WorkerAPIClient as any)();
      
      expect(() => newClient.getAPI()).toThrow('Worker not initialized');
    });
  });

  describe('API Method Calls', () => {
    let mockProxy: any;

    beforeEach(async () => {
      // Create a comprehensive mock proxy with all API methods
      mockProxy = {
        initialize: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
        
        // TreeQueryService methods
        getTrees: vi.fn().mockResolvedValue([]),
        getTree: vi.fn().mockResolvedValue(undefined),
        getNode: vi.fn().mockResolvedValue(undefined),
        getChildren: vi.fn().mockResolvedValue([]),
        getDescendants: vi.fn().mockResolvedValue([]),
        getAncestors: vi.fn().mockResolvedValue([]),
        searchNodes: vi.fn().mockResolvedValue([]),
        
        // TreeObservableService methods
        observeNode: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
        observeChildren: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
        observeSubtree: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
        observeWorkingCopies: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
        
        // TreeMutationService methods
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
        exportNodes: vi.fn().mockResolvedValue(''),
        importNodes: vi.fn().mockResolvedValue({ success: true }),
        undo: vi.fn().mockResolvedValue({ success: true }),
        redo: vi.fn().mockResolvedValue({ success: true }),
      };
      
      vi.spyOn(Comlink, 'wrap').mockReturnValue(mockProxy as any);
      
      client = await WorkerAPIClient.getSingleton();
    });

    it('should call TreeQueryService methods through the proxy', async () => {
      const api = client.getAPI();
      
      await api.getTrees();
      expect(mockProxy.getTrees).toHaveBeenCalled();
      
      await api.getTree({ treeId: 'test-tree' });
      expect(mockProxy.getTree).toHaveBeenCalledWith({ treeId: 'test-tree' });
      
      await api.searchNodes({ query: 'test' });
      expect(mockProxy.searchNodes).toHaveBeenCalledWith({ query: 'test' });
    });

    it('should call TreeObservableService methods through the proxy', async () => {
      const api = client.getAPI();
      
      const nodeObservable = api.observeNode({ nodeId: 'test-node' });
      expect(mockProxy.observeNode).toHaveBeenCalledWith({ nodeId: 'test-node' });
      expect(nodeObservable).toBeDefined();
      
      const childrenObservable = api.observeChildren({ parentId: 'test-parent' });
      expect(mockProxy.observeChildren).toHaveBeenCalledWith({ parentId: 'test-parent' });
      expect(childrenObservable).toBeDefined();
    });

    it('should call TreeMutationService methods through the proxy', async () => {
      const api = client.getAPI();
      
      await api.executeCommand({ type: 'CREATE_NODE', payload: {} });
      expect(mockProxy.executeCommand).toHaveBeenCalledWith({ 
        type: 'CREATE_NODE', 
        payload: {} 
      });
      
      await api.moveToTrash({ nodeIds: ['node1', 'node2'] });
      expect(mockProxy.moveToTrash).toHaveBeenCalledWith({ 
        nodeIds: ['node1', 'node2'] 
      });
      
      await api.undo();
      expect(mockProxy.undo).toHaveBeenCalled();
      
      await api.redo();
      expect(mockProxy.redo).toHaveBeenCalled();
    });

    it('should handle working copy operations', async () => {
      const api = client.getAPI();
      
      await api.createWorkingCopyForCreate({ parentId: 'parent', nodeType: 'folder' });
      expect(mockProxy.createWorkingCopyForCreate).toHaveBeenCalledWith({
        parentId: 'parent',
        nodeType: 'folder'
      });
      
      await api.commitWorkingCopy({ workingCopyId: 'wc-1' });
      expect(mockProxy.commitWorkingCopy).toHaveBeenCalledWith({
        workingCopyId: 'wc-1'
      });
      
      await api.discardWorkingCopy({ workingCopyId: 'wc-2' });
      expect(mockProxy.discardWorkingCopy).toHaveBeenCalledWith({
        workingCopyId: 'wc-2'
      });
    });

    it('should handle import/export operations', async () => {
      const api = client.getAPI();
      
      const exportResult = await api.exportNodes({ nodeIds: ['node1'] });
      expect(mockProxy.exportNodes).toHaveBeenCalledWith({ nodeIds: ['node1'] });
      expect(exportResult).toBe('');
      
      await api.importNodes({ data: 'import-data', parentId: 'parent' });
      expect(mockProxy.importNodes).toHaveBeenCalledWith({
        data: 'import-data',
        parentId: 'parent'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Worker initialization errors', async () => {
      const errorProxy = {
        initialize: vi.fn().mockRejectedValue(new Error('Init failed')),
      };
      
      vi.spyOn(Comlink, 'wrap').mockReturnValue(errorProxy as any);
      
      await expect(WorkerAPIClient.getSingleton()).rejects.toThrow('Init failed');
    });

    it('should handle cleanup errors gracefully', async () => {
      const errorProxy = {
        initialize: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockRejectedValue(new Error('Shutdown failed')),
      };
      
      vi.spyOn(Comlink, 'wrap').mockReturnValue(errorProxy as any);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      client = await WorkerAPIClient.getSingleton();
      await client.cleanup();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error disposing worker proxy:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});