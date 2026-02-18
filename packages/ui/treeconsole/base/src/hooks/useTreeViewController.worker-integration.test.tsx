/**
 * @file useTreeViewController.worker-integration.test.tsx
 * @description TDD tests for TreeViewController worker integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTreeViewController } from './useTreeViewController.js';
import { toNodeId, toNodeType, type NodeId } from '@hierarchidb/core-types';
import type { TreeNode, TreeNodeEvent } from '@hierarchidb/tree-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';

vi.mock('comlink', () => ({
  proxy: <T,>(value: T) => value,
}));

// Mock dependencies
vi.mock('@hierarchidb/provider', () => ({
  useTreeOperations: vi.fn(() => ({
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    archiveNode: vi.fn(),
    duplicateNode: vi.fn(),
  })),
  useTreeState: vi.fn(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getNode: vi.fn(),
    getChildren: vi.fn(),
  })),
}));

describe('useTreeViewController', () => {

  beforeEach(() => {
  });

  describe('worker integration', () => {
    it('loads initial subtree and applies updates from subscription events', async () => {
      const rootNodeId = 'root-node' as NodeId;
      const baseMetadata = {
        name: 'Root Node',
        description: '',
        tags: [],
      };
      const rootNode: Partial<TreeNode> = {
        id: rootNodeId,
        nodeType: toNodeType('folder'),
        parentId: null,
        metadata: baseMetadata,
      };
      const childNode: Partial<TreeNode> = {
        id: toNodeId('child-1'),
        nodeType: toNodeType('folder'),
        parentId: rootNodeId,
        metadata: {
          name: 'Child Node',
          description: '',
          tags: [],
        },
      };

      let subscriptionCallback: ((event: TreeNodeEvent) => void) | null = null;

      const mockSubscriptionAPI = {
        subscribeSubtree: vi.fn(async (_nodeId: NodeId, cb: (event: TreeNodeEvent) => void) => {
          subscriptionCallback = cb;
          return 'sub-1';
        }),
        unsubscribe: vi.fn(async () => {}),
      };

      const mockQueryAPI = {
        getNode: vi.fn(async (id: NodeId) => (String(id) === String(rootNodeId) ? rootNode : childNode)),
        listDescendants: vi.fn(async () => [childNode]),
      };

      const mockWorkerAPI = {
        getQueryAPI: vi.fn(async () => mockQueryAPI),
        getSubscriptionAPI: vi.fn(async () => mockSubscriptionAPI),
        getMutationAPI: vi.fn(),
        getTreeNodeUpdaterAPI: vi.fn(),
        getPluginLifecycleAPI: vi.fn(),
        getDialogStateAPI: vi.fn(),
        getImportExportAPI: vi.fn(),
        getTagAPI: vi.fn(),
        startBuildSession: vi.fn(),
        getBuildSessionStatus: vi.fn(),
        pauseBuildSession: vi.fn(),
        resumeBuildSession: vi.fn(),
        subscribeBuildProgress: vi.fn(),
        ping: vi.fn(() => ({ response: 'pong' as const, timestamp: Date.now() })),
        initialize: vi.fn(async () => {}),
        shutdown: vi.fn(async () => {}),
        getSystemHealth: vi.fn(async () => ({
          databases: { coreDB: true, ephemeralDB: true },
          services: { query: true, mutation: true, subscription: true, plugin: true, draft: true },
          memory: { used: 0, limit: 0 },
          uptime: 0,
        })),
      } as unknown as WorkerAPI;

      const mockWorkerClient = {
        getAPI: vi.fn(() => mockWorkerAPI),
      };

      const { result } = renderHook(() =>
        useTreeViewController({
          treeId: 'test-console-id',
          rootNodeId,
          workerClient: mockWorkerClient,
        }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: rootNodeId }),
            expect.objectContaining({ id: childNode.id }),
          ]),
        );
      });

      expect(mockSubscriptionAPI.subscribeSubtree).toHaveBeenCalledWith(
        rootNodeId,
        expect.any(Function),
        expect.objectContaining({ prefetch: { depth: 2 } }),
      );
      expect(subscriptionCallback).toBeTruthy();

      await act(async () => {
        subscriptionCallback?.({
          type: 'updated',
          nodeId: childNode.id as NodeId,
          node: {
            ...(childNode as TreeNode),
            metadata: {
              name: 'Updated Child Node',
              description: '',
              tags: [],
            },
          },
          parentId: rootNodeId,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: childNode.id,
              metadata: expect.objectContaining({ name: 'Updated Child Node' }),
            }),
          ]),
        );
      });
    });
  });
});
