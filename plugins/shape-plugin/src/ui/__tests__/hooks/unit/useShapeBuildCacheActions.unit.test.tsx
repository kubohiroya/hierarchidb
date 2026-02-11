import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  countFetchCaches: vi.fn(),
  countTransformCaches: vi.fn(),
  clearShapeArtifacts: vi.fn(),
  deleteFeatureMetadataByNode: vi.fn(),
  deleteDataSourceMetadataByNode: vi.fn(),
  deleteBuildSession: vi.fn(),
  getVectorTileSummary: vi.fn(),
  listFeatureMetadata: vi.fn(),
  listTransformErrorRecords: vi.fn(),
  countRawDataDataSourceBuffersForNode: vi.fn(),
  deleteRawDataDataSourceBuffersForNode: vi.fn(),
  deleteTasksByNode: vi.fn(),
  initializeBridge: vi.fn(),
  getBuildSessionStatus: vi.fn(),
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getWorkerBridge: () => ({
    initialize: mocks.initializeBridge,
    getBuildSessionStatus: mocks.getBuildSessionStatus,
  }),
}));

vi.mock('../../../../services/utils/chunkStore.js', () => ({
  countRawDataDataSourceBuffersForNode: mocks.countRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNode: mocks.deleteRawDataDataSourceBuffersForNode,
}));

vi.mock('../../../../services/batch/ShapeBuildAPIClient.ts', () => ({
  ephemeralShapeAPIImpl: {
    countFetchCaches: mocks.countFetchCaches,
    countTransformCaches: mocks.countTransformCaches,
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
    listTransformErrorRecords: mocks.listTransformErrorRecords,
  },
}));

vi.mock('@hierarchidb/vt-orchestrator', () => {
  class MockTaskQueueDb {
    tasks = {
      where: () => ({
        equals: () => ({
          count: async () => 0,
          delete: async () => 0,
        }),
      }),
    };
  }
  return {
    VtTaskQueueDb: MockTaskQueueDb,
    deleteTasksByNode: mocks.deleteTasksByNode,
  };
});

import { useShapeBuildCacheActions } from '../../../components/build-config/useShapeBuildCacheActions.ts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={createStore()}>{children}</Provider>
);

describe('useShapeBuildCacheActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countFetchCaches.mockResolvedValue(0);
    mocks.countTransformCaches.mockResolvedValue(0);
    mocks.clearShapeArtifacts.mockResolvedValue(undefined);
    mocks.deleteFeatureMetadataByNode.mockResolvedValue(undefined);
    mocks.deleteDataSourceMetadataByNode.mockResolvedValue(undefined);
    mocks.deleteBuildSession.mockResolvedValue(undefined);
    mocks.getVectorTileSummary.mockResolvedValue({ tiles: 0 });
    mocks.listFeatureMetadata.mockResolvedValue([]);
    mocks.listTransformErrorRecords.mockResolvedValue([]);
    mocks.countRawDataDataSourceBuffersForNode.mockResolvedValue(0);
    mocks.deleteRawDataDataSourceBuffersForNode.mockResolvedValue(undefined);
    mocks.deleteTasksByNode.mockResolvedValue(undefined);
    mocks.initializeBridge.mockResolvedValue(undefined);
    mocks.getBuildSessionStatus.mockResolvedValue({ status: 'idle' });
  });

  it('clears task queue rows when reset session is executed', async () => {
    const { result } = renderHook(
      () => useShapeBuildCacheActions({ nodeId: 'node-1' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.countFetchCaches).toHaveBeenCalledWith('node-1');
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
