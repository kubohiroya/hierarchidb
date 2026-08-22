import type { SessionPhase } from '@hierarchidb/build-api';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  getShapeMutationAPI: vi.fn(),
  recoverLegacyBuildSession: vi.fn(),
  listBuildTasksByStage: vi.fn(),
  deleteBuildTasksByIds: vi.fn(),
  clearStage: vi.fn(),
  markSourceCachesRawCacheInvalidated: vi.fn(),
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
    initialize: (...args: Parameters<typeof mocks.initializeBridge>) =>
      mocks.initializeBridge(...args),
    getBuildSessionStatus: (...args: Parameters<typeof mocks.getBuildSessionStatus>) =>
      mocks.getBuildSessionStatus(...args),
    getShapeMutationAPI: (...args: Parameters<typeof mocks.getShapeMutationAPI>) =>
      mocks.getShapeMutationAPI(...args),
  });
  return {
    getBuildWorkerBridge: () => getBridge(),
  };
});

vi.mock('../../../../services/utils/createShapeChunkStore.js', () => ({
  countRawDataDataSourceBuffersForNode: mocks.countRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNode: mocks.deleteRawDataDataSourceBuffersForNode,
}));

vi.mock('../../../../services/build/ShapeBuildAPIClient.ts', () => ({
  ephemeralShapeAPIImpl: {
    countSourceCaches: mocks.countSourceCaches,
    countGeometryCaches: mocks.countGeometryCaches,
    listBuildTasksByStage: mocks.listBuildTasksByStage,
    deleteBuildTasksByIds: mocks.deleteBuildTasksByIds,
    clearStage: mocks.clearStage,
    markSourceCachesRawCacheInvalidated: mocks.markSourceCachesRawCacheInvalidated,
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
            equals: () => ({
              count: async () => 0,
              delete: async () => 0,
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

import { dispatchBuildSessionEventAtom } from '../../../atoms/buildSessionStateAtoms';
import { useShapeBuildCacheActions } from '../../../hooks/useShapeBuildCacheActions';

const wrapper = ({ children }: { children: ReactNode }) => <Provider>{children}</Provider>;

const createWrapper =
  (store: ReturnType<typeof createStore>) =>
  ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

const emitLifecycle = (
  store: ReturnType<typeof createStore>,
  phase: SessionPhase,
  options: {
    nodeId?: string;
    stopReason?: ShapeBuildStopReason;
    startedAt?: number;
    completedAt?: number;
  } = {}
) => {
  const isActive =
    phase === 'starting' ||
    phase === 'running' ||
    phase === 'pausing' ||
    phase === 'resuming' ||
    phase === 'finalizing';
  store.set(dispatchBuildSessionEventAtom, {
    type: 'sessionStatusUpdated',
    payload: {
      nodeId: options.nodeId ?? 'node-1',
      phase,
      isActive,
      ...(options.startedAt === undefined ? {} : { startedAt: options.startedAt }),
      ...(options.completedAt === undefined ? {} : { completedAt: options.completedAt }),
      ...(options.stopReason === undefined ? {} : { stopReason: options.stopReason }),
    },
  });
};

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
    mocks.clearStage.mockResolvedValue(undefined);
    mocks.markSourceCachesRawCacheInvalidated.mockResolvedValue(undefined);
    mocks.initializeBridge.mockResolvedValue(undefined);
    mocks.getBuildSessionStatus.mockResolvedValue({ status: 'idle' });
    mocks.recoverLegacyBuildSession.mockResolvedValue({
      nodeId: 'node-1',
      deletedRowCounts: {
        buildSessionConfigs: 1,
        buildSessionHeartbeats: 1,
        buildSessionStatuses: 1,
        buildStageStatuses: 1,
        buildTasks: 1,
      },
    });
    mocks.getShapeMutationAPI.mockResolvedValue({
      recoverLegacyBuildSession: mocks.recoverLegacyBuildSession,
    });
  });

  it.each([
    { phase: 'completed' as const, stopReason: 'completed' as const },
    { phase: 'failed' as const, stopReason: 'failed' as const },
  ])('reloads counts once for a new $phase outcome', async ({ phase, stopReason }) => {
    mocks.countSourceCaches.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    const store = createStore();
    const { result } = renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper: createWrapper(store),
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      emitLifecycle(store, 'running', { startedAt: 1_000 });
      emitLifecycle(store, phase, {
        startedAt: 1_000,
        completedAt: 2_000,
        stopReason,
      });
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(2);
      expect(result.current.counts.sourceFiltered).toBe(2);
      expect(result.current.canDeleteSourceFilteredCache).toBe(true);
    });

    await act(async () => {
      emitLifecycle(store, phase, {
        startedAt: 1_000,
        completedAt: 2_000,
        stopReason,
      });
      await Promise.resolve();
    });

    expect(mocks.countSourceCaches).toHaveBeenCalledTimes(2);
    expect(mocks.getBuildSessionStatus).not.toHaveBeenCalled();
  });

  it('loads only once when the initially observed phase is already terminal', async () => {
    const store = createStore();
    emitLifecycle(store, 'completed', {
      startedAt: 1_000,
      completedAt: 2_000,
      stopReason: 'completed',
    });

    renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper: createWrapper(store),
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      emitLifecycle(store, 'completed', {
        startedAt: 1_000,
        completedAt: 2_000,
        stopReason: 'completed',
      });
      await Promise.resolve();
    });

    expect(mocks.countSourceCaches).toHaveBeenCalledTimes(1);
  });

  it('reloads for queued cancellation but not for paused', async () => {
    const store = createStore();
    renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper: createWrapper(store),
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      emitLifecycle(store, 'running', { startedAt: 1_000 });
      emitLifecycle(store, 'paused', {
        startedAt: 1_000,
        stopReason: 'user-pause',
      });
      await Promise.resolve();
    });
    expect(mocks.countSourceCaches).toHaveBeenCalledTimes(1);

    await act(async () => {
      emitLifecycle(store, 'starting');
      await Promise.resolve();
    });
    await act(async () => {
      emitLifecycle(store, 'idle', { stopReason: 'user-pause' });
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(2);
    });
  });

  it('reloads once for each consecutive completed session', async () => {
    const store = createStore();
    renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper: createWrapper(store),
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      emitLifecycle(store, 'running', { startedAt: 1_000 });
      emitLifecycle(store, 'completed', {
        startedAt: 1_000,
        completedAt: 2_000,
        stopReason: 'completed',
      });
    });
    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      emitLifecycle(store, 'running', { startedAt: 3_000 });
      await Promise.resolve();
    });
    await act(async () => {
      emitLifecycle(store, 'completed', {
        startedAt: 3_000,
        completedAt: 4_000,
        stopReason: 'completed',
      });
    });
    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledTimes(3);
    });
  });

  it('does not let a stale count response overwrite a newly selected node', async () => {
    let resolveFirstCount: ((value: number) => void) | undefined;
    const firstCount = new Promise<number>((resolve) => {
      resolveFirstCount = resolve;
    });
    mocks.countSourceCaches.mockReturnValueOnce(firstCount).mockResolvedValueOnce(2);

    const store = createStore();
    const { result, rerender } = renderHook(
      ({ nodeId }: { nodeId: string }) => useShapeBuildCacheActions({ nodeId }),
      {
        initialProps: { nodeId: 'node-1' },
        wrapper: createWrapper(store),
      }
    );

    rerender({ nodeId: 'node-2' });

    await waitFor(() => {
      expect(result.current.counts.sourceFiltered).toBe(2);
      expect(mocks.countSourceCaches).toHaveBeenCalledWith('node-2');
    });

    if (!resolveFirstCount) {
      throw new Error('first count request was not started');
    }
    resolveFirstCount(9);
    await act(async () => {
      await firstCount;
      await Promise.resolve();
    });

    expect(result.current.counts.sourceFiltered).toBe(2);
    expect(result.current.countsLoading).toBe(false);
  });

  it('reloads cache counts after deleting source API cache', async () => {
    mocks.countRawDataDataSourceBuffersForNode.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    mocks.countSourceCaches.mockResolvedValue(0);
    mocks.listBuildTasksByStage
      .mockResolvedValueOnce([{ taskId: 'task-source' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.deleteBuildTasksByIds.mockResolvedValue(undefined);

    const { result } = renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper,
    });

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
    expect(mocks.markSourceCachesRawCacheInvalidated).toHaveBeenCalledWith('node-1');
    expect(mocks.listBuildTasksByStage).toHaveBeenCalledWith('node-1', 'source');
    expect(mocks.deleteBuildTasksByIds).toHaveBeenCalledWith(['task-source']);
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Deleted API cache');
  });

  it('deletes source filtered cache without deleting raw API cache', async () => {
    mocks.countRawDataDataSourceBuffersForNode.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    mocks.countSourceCaches.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    mocks.listBuildTasksByStage
      .mockResolvedValueOnce([{ taskId: 'task-source' }])
      .mockResolvedValueOnce([{ taskId: 'task-geometry' }])
      .mockResolvedValueOnce([{ taskId: 'task-tile' }]);

    const { result } = renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.canDeleteSourceFilteredCache).toBe(true);
    });

    await act(async () => {
      await result.current.handleDeleteSourceFilteredCache();
    });

    expect(mocks.clearStage).toHaveBeenCalledWith('node-1', 'source');
    expect(mocks.deleteRawDataDataSourceBuffersForNode).not.toHaveBeenCalled();
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Deleted source filtered cache');
  });

  it('still refreshes counts when task metadata cleanup fails during API cache deletion', async () => {
    mocks.countRawDataDataSourceBuffersForNode.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    mocks.countSourceCaches.mockResolvedValue(0);
    mocks.listBuildTasksByStage.mockResolvedValueOnce([{ taskId: 'task-1' }]);
    mocks.deleteBuildTasksByIds.mockRejectedValue(new Error('task clear failed'));
    mocks.getBuildSessionStatus.mockResolvedValue({ status: 'idle' });

    const { result } = renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper,
    });

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
    const { result } = renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper,
    });

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

  it('uses the Worker recovery command without deleting caches or output metadata', async () => {
    const recovery = {
      code: 'LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING' as const,
      recoverable: true as const,
      nodeId: 'node-1',
      table: 'buildStageStatuses' as const,
      field: 'inactiveMs' as const,
      fieldPath: 'buildStageStatuses.inactiveMs' as const,
      stageStatusId: 'node-1:source',
      stage: 'source' as const,
      received: 'undefined' as const,
      message: 'inactiveMs is missing',
    };
    const { result } = renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledWith('node-1');
    });

    await act(async () => {
      await result.current.handleRecoverLegacyBuildSession(recovery);
    });

    expect(mocks.recoverLegacyBuildSession).toHaveBeenCalledWith({
      nodeId: 'node-1',
      confirmation: 'RESET_LEGACY_BUILD_SESSION_AND_TASKS',
      error: recovery,
    });
    expect(mocks.deleteTasksByNode).not.toHaveBeenCalled();
    expect(mocks.clearShapeArtifacts).not.toHaveBeenCalled();
    expect(mocks.deleteFeatureMetadataByNode).not.toHaveBeenCalled();
    expect(mocks.deleteDataSourceMetadataByNode).not.toHaveBeenCalled();
    expect(mocks.deleteBuildSession).not.toHaveBeenCalled();
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Recovered legacy build session');
  });

  it('propagates Worker recovery failure without running destructive cleanup', async () => {
    const recovery = {
      code: 'LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING' as const,
      recoverable: true as const,
      nodeId: 'node-1',
      table: 'buildStageStatuses' as const,
      field: 'inactiveMs' as const,
      fieldPath: 'buildStageStatuses.inactiveMs' as const,
      stageStatusId: 'node-1:source',
      stage: 'source' as const,
      received: 'undefined' as const,
      message: 'inactiveMs is missing',
    };
    mocks.recoverLegacyBuildSession.mockRejectedValue(new Error('recovery descriptor changed'));
    const { result } = renderHook(() => useShapeBuildCacheActions({ nodeId: 'node-1' }), {
      wrapper,
    });

    await waitFor(() => {
      expect(mocks.countSourceCaches).toHaveBeenCalledWith('node-1');
    });

    await expect(result.current.handleRecoverLegacyBuildSession(recovery)).rejects.toThrow(
      'recovery descriptor changed'
    );
    expect(mocks.deleteTasksByNode).not.toHaveBeenCalled();
    expect(mocks.clearShapeArtifacts).not.toHaveBeenCalled();
    expect(mocks.deleteBuildSession).not.toHaveBeenCalled();
    expect(mocks.notifySuccess).not.toHaveBeenCalledWith('Recovered legacy build session');
  });
});
