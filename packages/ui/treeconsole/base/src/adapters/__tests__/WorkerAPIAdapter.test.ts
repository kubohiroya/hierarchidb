/**
 * WorkerAPIAdapter テストファイル
 *
 * APIアダプターの基本動作を確認します。
 * 実際の移植作業時に、アダプターの変換ロジックを検証するために使用します。
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { Observable } from 'rxjs';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TreeChangeEvent, CommandResult } from '@hierarchidb/common-core';
import { WorkerAPIAdapter } from '../WorkerAPIAdapter';

// WorkerAPI のモックを作成
const createMockWorkerAPI = (): jest.Mocked<WorkerAPI> =>
  ({
    // TreeObservableService methods
    observeNode: vi.fn(),
    observeChildren: vi.fn(),
    observeSubtree: vi.fn(),
    observeWorkingCopies: vi.fn(),
    getActiveSubscriptions: vi.fn(),
    cleanupOrphanedSubscriptions: vi.fn(),

    // TreeMutationService methods
    createWorkingCopyForCreate: vi.fn(),
    createWorkingCopy: vi.fn(),
    discardWorkingCopyForCreate: vi.fn(),
    discardWorkingCopy: vi.fn(),
    commitWorkingCopyForCreate: vi.fn(),
    commitWorkingCopy: vi.fn(),
    moveNodes: vi.fn(),
    duplicateNodes: vi.fn(),
    pasteNodes: vi.fn(),
    moveToTrash: vi.fn(),
    remove: vi.fn(),
    recoverFromTrash: vi.fn(),
    importNodes: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),

    // TreeQueryService methods (必要に応じて追加)
    // getNode: vi.fn(),
    // getChildren: vi.fn(),
    // など...
  }) as any;

describe('WorkerAPIAdapter', () => {
  let mockWorkerAPI: jest.Mocked<WorkerAPI>;
  let adapter: WorkerAPIAdapter;

  beforeEach(() => {
    mockWorkerAPI = createMockWorkerAPI();

    adapter = new WorkerAPIAdapter({
      workerAPI: mockWorkerAPI,
      defaultViewId: 'test-view',
      defaultOnNameConflict: 'auto-rename',
    });
  });

  describe('Configuration', () => {
    it('should initialize with provided configuration', () => {
      const info = adapter.getAdapterInfo();

      expect(info.viewId).toBe('test-view');
      expect(info.defaultOnNameConflict).toBe('auto-rename');
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
      // モックの Observable を作成
      const mockObservable = new Observable<TreeChangeEvent>((subscriber) => {
        subscriber.next({
          type: 'node-updated',
          nodeId: 'test-node',
          timestamp: Date.now(),
        } as TreeChangeEvent);
      });

      mockWorkerAPI.observeSubtree.mockResolvedValue(mockObservable);

      let expandedCallbackCalled = false;
      let subtreeCallbackCalled = false;

      const unsubscribe = await adapter.subscribeToSubtree(
        'test-node' as any,
        () => {
          expandedCallbackCalled = true;
        },
        () => {
          subtreeCallbackCalled = true;
        }
      );

      // CommandEnvelope の構造を検証
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

      // クリーンアップ確認
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should handle subscription errors gracefully', async () => {
      const error = new Error('Connection failed');
      mockWorkerAPI.observeSubtree.mockRejectedValue(error);

      await expect(
        adapter.subscribeToSubtree(
          'test-node' as any,
          () => {},
          () => {}
        )
      ).rejects.toThrow();
    });
  });

  describe('Mutation Operations', () => {
    it('should convert moveNodes to CommandEnvelope format', async () => {
      const successResult: CommandResult = {
        success: true,
        commandId: 'test-command',
      };

      mockWorkerAPI.moveNodes.mockResolvedValue(successResult);

      await adapter.moveNodes(['node1', 'node2'] as any, 'target-parent' as any);

      expect(mockWorkerAPI.moveNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'moveNodes',
          payload: expect.objectContaining({
            nodeIds: ['node1', 'node2'],
            toParentId: 'target-parent',
            onNameConflict: 'auto-rename',
          }),
          commandId: expect.any(String),
          groupId: expect.any(String),
          issuedAt: expect.any(Number),
        })
      );
    });

    it('should handle command failures properly', async () => {
      const failureResult: CommandResult = {
        success: false,
        error: 'Target not found',
        code: 'TARGET_NOT_FOUND',
        commandId: 'test-command',
      };

      mockWorkerAPI.moveNodes.mockResolvedValue(failureResult);

      await expect(adapter.moveNodes(['node1'] as any, 'invalid-target' as any)).rejects.toThrow(
        'Failed to move nodes: Target not found'
      );
    });

    it('should handle deleteNodes (moveToTrash) conversion', async () => {
      const successResult: CommandResult = {
        success: true,
        commandId: 'test-command',
      };

      mockWorkerAPI.moveToTrash.mockResolvedValue(successResult);

      await adapter.deleteNodes(['node1', 'node2'] as any);

      expect(mockWorkerAPI.moveToTrash).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'moveToTrash',
          payload: expect.objectContaining({
            nodeIds: ['node1', 'node2'],
          }),
          commandId: expect.any(String),
          groupId: expect.any(String),
          issuedAt: expect.any(Number),
        })
      );
    });
  });

  describe('Working Copy Operations', () => {
    it('should handle startNodeEdit correctly', async () => {
      mockWorkerAPI.createWorkingCopy.mockResolvedValue(undefined);

      const editSession = await adapter.startNodeEdit('test-node' as any);

      expect(editSession).toEqual(
        expect.objectContaining({
          workingCopyId: expect.any(String),
          sourceNodeId: 'test-node',
          isCreate: false,
        })
      );

      expect(mockWorkerAPI.createWorkingCopy).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'createWorkingCopy',
          payload: expect.objectContaining({
            sourceNodeId: 'test-node',
            workingCopyId: expect.any(String),
          }),
        })
      );
    });

    it('should handle startNodeCreate correctly', async () => {
      mockWorkerAPI.createWorkingCopyForCreate.mockResolvedValue(undefined);

      const editSession = await adapter.startNodeCreate(
        'parent-node' as any,
        'New Node',
        'Description'
      );

      expect(editSession).toEqual(
        expect.objectContaining({
          workingCopyId: expect.any(String),
          parentNodeId: 'parent-node',
          isCreate: true,
        })
      );

      expect(mockWorkerAPI.createWorkingCopyForCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'createWorkingCopyForCreate',
          payload: expect.objectContaining({
            parentNodeId: 'parent-node',
            name: 'New Node',
            description: 'Description',
            workingCopyId: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Lifecycle Management', () => {
    it('should cleanup all subscriptions on cleanup()', async () => {
      // いくつかのサブスクリプションを作成
      const mockObservable = new Observable<TreeChangeEvent>(() => {});
      mockWorkerAPI.observeSubtree.mockResolvedValue(mockObservable);

      await adapter.subscribeToSubtree(
        'test-node' as any,
        () => {},
        () => {}
      );

      let stats = adapter.getAdapterInfo().subscriptionStats;
      expect(stats.total).toBeGreaterThan(0);

      // クリーンアップ実行
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
        commandId: 'test-command',
      };

      mockWorkerAPI.moveNodes.mockResolvedValue(successResult);

      await adapter.moveNodes(
        ['node1'] as any,
        'target' as any,
        {
          viewId: 'custom-view',
          groupId: 'custom-group',
          onNameConflict: 'error',
        } as any
      );

      expect(mockWorkerAPI.moveNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            onNameConflict: 'error',
          }),
          groupId: 'custom-group',
        })
      );
    });
  });
});
