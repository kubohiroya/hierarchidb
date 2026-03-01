import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  countSourceCaches: vi.fn(),
  countGeometryCaches: vi.fn(),
  clearShapeArtifacts: vi.fn(),
  deleteFeatureMetadataByNode: vi.fn(),
  deleteDataSourceMetadataByNode: vi.fn(),
  deleteBuildSession: vi.fn(),
  getVectorTileSummary: vi.fn(),
  listFeatureMetadata: vi.fn(),
  listGeometryErrorRecords: vi.fn(),
  countRawDataDataSourceBuffersForNode: vi.fn(),
  deleteRawDataDataSourceBuffersForNode: vi.fn(),
  deleteTasksByNode: vi.fn(),
  initializeBridge: vi.fn(),
  getBuildSessionStatus: vi.fn(),
  listBuildTasksByStage: vi.fn(),
  deleteBuildTasksByIds: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@hierarchidb/components', () => ({
  notify: {
    success: mocks.notifySuccess,
    error: mocks.notifyError,
  },
}));

vi.mock('@hierarchidb/ui-worker-client', () => {
  const getBridge = () => ({
    initialize: (...args: Parameters<typeof mocks.initializeBridge>) => mocks.initializeBridge(...args),
    getBuildSessionStatus: (...args: Parameters<typeof mocks.getBuildSessionStatus>) =>
      mocks.getBuildSessionStatus(...args),
  });
  return {
    getBuildWorkerBridge: () => getBridge(),
  };
});

vi.mock('../../../../services/utils/chunkStore.js', () => ({
  countRawDataDataSourceBuffersForNode: mocks.countRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNode: mocks.deleteRawDataDataSourceBuffersForNode,
}));

vi.mock('../../../../services/build/ShapeBuildAPIClient.ts', () => ({
  ephemeralShapeAPIImpl: {
    countSourceCaches: mocks.countSourceCaches,
    countGeometryCaches: mocks.countGeometryCaches,
    listBuildTasksByStage: mocks.listBuildTasksByStage,
    deleteBuildTasksByIds: mocks.deleteBuildTasksByIds,
  },
  shapeMutationAPIImpl: {
    clearShapeArtifacts: mocks.clearShapeArtifacts,
    deleteFeatureMetadataByNode: mocks.deleteFeatureMetadataByNode,
    deleteDataSourceMetadataByNode: mocks.deleteDataSourceMetadataByNode,
    deleteBuildSession: mocks.deleteBuildSession,
  },
  shapeQueryAPIImpl: {
    getVectorTileSummary: mocks.getVectorTileSummary,
    listFeatureMetadata: mocks.listFeatureMetadata,
    listGeometryErrorRecords: mocks.listGeometryErrorRecords,
  },
}));

vi.mock('@hierarchidb/vt-orchestrator', () => {
  class MockTaskQueueDb {
    tasks = {
      where: (query: string) => {
        if (query === 'nodeId') {
          return {
            equals: async () => ({
              toArray: async () => [],
              and: () => ({
                delete: async () => 0,
              }),
            }),
          };
        }
        return {
          equals: () => ({
            count: async () => 0,
            delete: async () => 0,
          }),
        };
      },
    };
  }
  return {
    VtTaskQueueDb: MockTaskQueueDb,
    deleteTasksByNode: mocks.deleteTasksByNode,
  };
});

import { useShapeBuildCacheActions } from '../../../hooks/useShapeBuildCacheActions';

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={createStore()}>{children}</Provider>
);

describe('useShapeBuildCacheActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countSourceCaches.mockResolvedValue(0);
    mocks.countGeometryCaches.mockResolvedValue(0);
    mocks.clearShapeArtifacts.mockResolvedValue(undefined);
    mocks.deleteFeatureMetadataByNode.mockResolvedValue(undefined);
    mocks.deleteDataSourceMetadataByNode.mockResolvedValue(undefined);
    mocks.deleteBuildSession.mockResolvedValue(undefined);
    mocks.getVectorTileSummary.mockResolvedValue({ tiles: 0 });
    mocks.listFeatureMetadata.mockResolvedValue([]);
    mocks.listGeometryErrorRecords.mockResolvedValue([]);
    mocks.countRawDataDataSourceBuffersForNode.mockResolvedValue(0);
    mocks.deleteRawDataDataSourceBuffersForNode.mockResolvedValue(undefined);
    mocks.deleteTasksByNode.mockResolvedValue(undefined);
    mocks.listBuildTasksByStage.mockResolvedValue([]);
    mocks.deleteBuildTasksByIds.mockResolvedValue(undefined);
    mocks.initializeBridge.mockResolvedValue(undefined);
    mocks.getBuildSessionStatus.mockResolvedValue({ status: 'idle' });
  });

  it('reloads cache counts after deleting fetch API cache', async () => {
    mocks.countRawDataDataSourceBuffersForNode
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    mocks.countSourceCaches.mockResolvedValue(0);
    mocks.listBuildTasksByStage
      .mockResolvedValueOnce([{ taskId: 'task-source' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.deleteBuildTasksByIds.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useShapeBuildCacheActions({ nodeId: 'node-1' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.counts.sourceApi).toBe(2);
      expect(result.current.canDeleteSourceApiCache).toBe(true);
    });

    await act(async () => {
      await result.current.handleDeleteSourceApiCache();
    });

    await waitFor(() => {
      expect(result.current.counts.sourceApi).toBe(0);
      expect(result.current.canDeleteSourceApiCache).toBe(false);
    });

    expect(mocks.deleteRawDataDataSourceBuffersForNode).toHaveBeenCalledWith('node-1');
    expect(mocks.listBuildTasksByStage).toHaveBeenCalledWith('node-1', 'source');
    expect(mocks.deleteBuildTasksByIds).toHaveBeenCalledWith(['task-source']);
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Deleted API cache');
  });

  it('still refreshes counts when task metadata cleanup fails during API cache deletion', async () => {
    mocks.countRawDataDataSourceBuffersForNode
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    mocks.countSourceCaches.mockResolvedValue(0);
    mocks.listBuildTasksByStage.mockResolvedValueOnce([{ taskId: 'task-1' }]);
    mocks.deleteBuildTasksByIds.mockRejectedValue(new Error('task clear failed'));
    mocks.deleteBuildTasksByIds.mockResolvedValue(undefined);
    mocks.getBuildSessionStatus.mockResolvedValue({ status: 'idle' });

    const { result } = renderHook(
      () => useShapeBuildCacheActions({ nodeId: 'node-1' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.counts.sourceApi).toBe(2);
    });

    await act(async () => {
      await result.current.handleDeleteSourceApiCache();
    });

    await waitFor(() => {
      expect(result.current.counts.sourceApi).toBe(0);
      expect(result.current.canDeleteSourceApiCache).toBe(false);
    });

    expect(mocks.notifyError).toHaveBeenCalledWith('Failed to remove API cache related task data.');
  });

  it('clears task queue rows when reset session is executed', async () => {
    const { result } = renderHook(
      () => useShapeBuildCacheActions({ nodeId: 'node-1' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledWith('node-1');
    });

    await act(async () => {
      await result.current.handleResetSession();
    });

    expect(mocks.deleteTasksByNode).toHaveBeenCalledTimes(1);
    expect(mocks.deleteTasksByNode.mock.calls[0]?.[1]).toBe('node-1');
    expect(mocks.clearShapeArtifacts).toHaveBeenCalledWith('node-1');
    expect(mocks.deleteBuildSession).toHaveBeenCalledWith('node-1');
  });
});
