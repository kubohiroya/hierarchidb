/**
 * WorkerAPIAdapter
 * API
 */

import { type NodeId, toNodeId } from '@hierarchidb/core-types';
import type { CommandResult, TreeChangeEvent } from '@hierarchidb/tree-api';
import { Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../types';
import { WorkerAPIAdapter } from '../WorkerAPIAdapter';

//  WorkerAPI
type MockWorkerAPI = {
  observeNode: ReturnType<typeof vi.fn>;
  observeChildren: ReturnType<typeof vi.fn>;
  observeSubtree: ReturnType<typeof vi.fn>;
  observeDrafts: ReturnType<typeof vi.fn>;
  getActiveSubscriptions: ReturnType<typeof vi.fn>;
  cleanupOrphanedSubscriptions: ReturnType<typeof vi.fn>;
  createDraftForCreate: ReturnType<typeof vi.fn>;
  createDraft: ReturnType<typeof vi.fn>;
  discardDraftForCreate: ReturnType<typeof vi.fn>;
  discardDraft: ReturnType<typeof vi.fn>;
  commitDraftForCreate: ReturnType<typeof vi.fn>;
  commitDraft: ReturnType<typeof vi.fn>;
  moveNodes: ReturnType<typeof vi.fn>;
  duplicateNodes: ReturnType<typeof vi.fn>;
  pasteNodes: ReturnType<typeof vi.fn>;
  moveToArchive: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  restoreFromArchive: ReturnType<typeof vi.fn>;
  importNodes: ReturnType<typeof vi.fn>;
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  getMutationAPI: ReturnType<typeof vi.fn>;
  getQueryAPI: ReturnType<typeof vi.fn>;
  getTreeNodeUpdaterAPI: ReturnType<typeof vi.fn>;
};

type MockTreeNodeUpdaterAPI = {
  initTreeNode: ReturnType<typeof vi.fn>;
  getTreeNode: ReturnType<typeof vi.fn>;
  updateTreeNodeDraftMetadata: ReturnType<typeof vi.fn>;
  updateTreeNodeDraftData: ReturnType<typeof vi.fn>;
  commitDraft: ReturnType<typeof vi.fn>;
  discardDraft: ReturnType<typeof vi.fn>;
};

const createMockWorkerAPI = (): MockWorkerAPI => ({
  // TreeObservableService methods
  observeNode: vi.fn(),
  observeChildren: vi.fn(),
  observeSubtree: vi.fn(),
  observeDrafts: vi.fn(),
  getActiveSubscriptions: vi.fn(),
  cleanupOrphanedSubscriptions: vi.fn(),

  // TreeMutationService methods
  createDraftForCreate: vi.fn(),
  createDraft: vi.fn(),
  discardDraftForCreate: vi.fn(),
  discardDraft: vi.fn(),
  commitDraftForCreate: vi.fn(),
  commitDraft: vi.fn(),
  moveNodes: vi.fn(),
  duplicateNodes: vi.fn(),
  pasteNodes: vi.fn(),
  moveToArchive: vi.fn(),
  remove: vi.fn(),
  restoreFromArchive: vi.fn(),
  importNodes: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),

  //  TreeQueryService methods ()
  // getNode: vi.fn(),
  // getChildren: vi.fn(),
  //  ...
});

describe('WorkerAPIAdapter', () => {
  let mockWorkerAPI: MockWorkerAPI;
  let adapter: WorkerAPIAdapter;
  let updaterAPI: MockTreeNodeUpdaterAPI;

  beforeEach(() => {
    mockWorkerAPI = createMockWorkerAPI();

    // Provide APIs expected by the adapters
    // Map Worker API methods into the corresponding sub-APIs used internally
    mockWorkerAPI.getMutationAPI = vi.fn().mockResolvedValue({
      moveNodes: mockWorkerAPI.moveNodes,
      duplicateNodes: mockWorkerAPI.duplicateNodes,
      moveNodesToArchive: mockWorkerAPI.moveToArchive,
      removeNodes: mockWorkerAPI.remove,
      restoreNodesFromArchive: mockWorkerAPI.restoreFromArchive,
    });

    updaterAPI = {
      initTreeNode: vi.fn().mockResolvedValue({ id: 'wc-1' }),
      getTreeNode: vi.fn().mockResolvedValue({ id: 'wc-1' }),
      updateTreeNodeDraftMetadata: vi.fn().mockResolvedValue(undefined),
      updateTreeNodeDraftData: vi.fn().mockResolvedValue(undefined),
      commitDraft: vi.fn().mockResolvedValue({ status: 'ok', nodeId: 'n:1' }),
      discardDraft: vi.fn().mockResolvedValue(undefined),
    };
    mockWorkerAPI.getTreeNodeUpdaterAPI = vi.fn().mockResolvedValue(updaterAPI);

    mockWorkerAPI.getQueryAPI = vi.fn().mockReturnValue({
      getNode: vi.fn().mockResolvedValue({ id: 'test-node', updatedAt: Date.now() }),
    });

    adapter = new WorkerAPIAdapter({
      workerAPI: mockWorkerAPI,
      defaultViewId: 'test-view',
      defaultOnNameConflict: 'error',
    });
  });

  describe('Configuration', () => {
    it('should initialize with provided configuration', () => {
      const info = adapter.getAdapterInfo();

      expect(info.viewId).toBe('test-view');
      expect(info.defaultOnNameConflict).toBe('error');
      expect(info.subscriptionStats.total).toBe(0);
    });

    it('should update viewId correctly', () => {
      adapter.updateViewId('new-view-id');
      const info = adapter.getAdapterInfo();

      expect(info.viewId).toBe('new-view-id');
    });
  });

  describe('Observable Operations', () => {
    it('should convert observeSubtree to callback-based subscription', async () => {
      //  Observable
      const mockObservable = new Observable<TreeChangeEvent>((subscriber) => {
        subscriber.next({
          type: 'node-updated',
          nodeId: 'test-node',
          timestamp: Date.now(),
        } as TreeChangeEvent);
      });

      mockWorkerAPI.observeSubtree.mockResolvedValue(mockObservable);

      // Callback tracking variables
      let expandedCallbackCalled = false;
      let subtreeCallbackCalled = false;

      const unsubscribe = await adapter.subscribeToSubtree(toNodeId('test-node'), () => {
        expandedCallbackCalled = true;
        subtreeCallbackCalled = true;
      });

      //  CommandEnvelope
      expect(mockWorkerAPI.observeSubtree).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'observeSubtree',
          payload: expect.objectContaining({
            rootNodeId: 'test-node',
            includeInitialSnapshot: true,
          }),
          commandId: expect.any(String),
          groupId: expect.any(String),
          issuedAt: expect.any(Number),
        })
      );

      // Test callback functionality
      expect(expandedCallbackCalled).toBe(false); // Initially false
      expect(subtreeCallbackCalled).toBe(false); // Initially false

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should handle subscription errors gracefully', async () => {
      const error = new Error('Connection failed');
      mockWorkerAPI.observeSubtree.mockRejectedValue(error);

      await expect(adapter.subscribeToSubtree(toNodeId('test-node'), () => {})).rejects.toThrow();
    });
  });

  describe('Mutation Operations', () => {
    it('should convert moveNodes to mutation payload', async () => {
      const successResult: CommandResult = {
        success: true,
        seq: 123,
      };

      mockWorkerAPI.moveNodes.mockResolvedValue(successResult);

      await adapter.moveNodes([toNodeId('node1'), toNodeId('node2')], toNodeId('target-parent'));

      expect(mockWorkerAPI.moveNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeIds: ['node1', 'node2'],
          toParentId: 'target-parent',
          onNameConflict: 'error',
        })
      );
    });

    it('should handle command failures properly', async () => {
      const failureResult: CommandResult = {
        success: false,
        error: 'Target not found',
        code: 'NODE_NOT_FOUND',
        seq: 123,
      };

      mockWorkerAPI.moveNodes.mockResolvedValue(failureResult);

      await expect(
        adapter.moveNodes([toNodeId('node1')], toNodeId('invalid-target'))
      ).rejects.toThrow('Failed to move nodes: Target not found');
    });

    it('should handle deleteNodes (moveToArchive) conversion', async () => {
      const successResult: CommandResult = {
        success: true,
        seq: 123,
      };

      mockWorkerAPI.moveToArchive.mockResolvedValue(successResult);

      await adapter.archiveNodes([toNodeId('node1'), toNodeId('node2')]);

      expect(mockWorkerAPI.moveToArchive).toHaveBeenCalledWith(['node1', 'node2']);
    });
  });

  describe('Working Copy Operations', () => {
    it('should handle startNodeEdit correctly', async () => {
      mockWorkerAPI.createDraft.mockResolvedValue(undefined);

      const editSession = await adapter.startNodeEdit(toNodeId('test-node'));

      expect(editSession).toEqual(
        expect.objectContaining({
          draftId: expect.any(String),
          sourceId: 'test-node',
          isCreate: false,
        })
      );

      expect(updaterAPI.updateTreeNodeDraftMetadata).not.toHaveBeenCalled();
      expect(updaterAPI.updateTreeNodeDraftData).not.toHaveBeenCalled();
    });

    it('should handle startNodeCreate correctly', async () => {
      const editSession = await adapter.startNodeCreate(
        toNodeId('parent-node'),
        'New Node',
        'Description'
      );

      expect(editSession).toEqual(
        expect.objectContaining({
          draftId: expect.any(String),
          parentId: 'parent-node',
          isCreate: true,
        })
      );
    });
  });

  describe('Lifecycle Management', () => {
    it('should cleanup all subscriptions on cleanup()', async () => {
      const mockObservable = new Observable<TreeChangeEvent>(() => {});
      mockWorkerAPI.observeSubtree.mockResolvedValue(mockObservable);

      await adapter.subscribeToSubtree(toNodeId('test-node'), () => {});

      let stats = adapter.getAdapterInfo().subscriptionStats;
      expect(stats.total).toBeGreaterThan(0);

      adapter.cleanup();

      stats = adapter.getAdapterInfo().subscriptionStats;
      expect(stats.total).toBe(0);
    });

    it('should provide subscription statistics', () => {
      const stats = adapter.getAdapterInfo().subscriptionStats;

      expect(stats).toEqual(
        expect.objectContaining({
          total: 0,
          byType: expect.objectContaining({
            subtree: 0,
            node: 0,
            children: 0,
          }),
          byNodeId: expect.any(Object),
        })
      );
    });
  });

  describe('Context Override', () => {
    it('should apply context overrides correctly', async () => {
      const successResult: CommandResult = {
        success: true,
        seq: 123,
      };

      mockWorkerAPI.moveNodes.mockResolvedValue(successResult);

      const context: Partial<AdapterContext> = {
        viewId: 'custom-view',
        groupId: 'custom-group',
        onNameConflict: 'error',
      };
      await adapter.moveNodes([toNodeId('node1')], toNodeId('target'), context);

      expect(mockWorkerAPI.moveNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeIds: ['node1'],
          toParentId: 'target',
          onNameConflict: 'error',
        })
      );
    });
  });
});
