import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTreeNodeUpdaterAPI: vi.fn(),
  updateTreeNode: vi.fn(),
  getTreeNode: vi.fn(),
  notifyWarning: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@hierarchidb/components/notify', () => ({
  notify: {
    warning: mocks.notifyWarning,
    error: mocks.notifyError,
  },
}));

import { useShapeBuildDraftSaver } from '../../../components/build-progress/internal/useShapeBuildSessionLogic/useShapeBuildDraftSaver';

describe('useShapeBuildDraftSaver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateTreeNode.mockResolvedValue({ status: 'ok' });
    mocks.getTreeNode.mockResolvedValue(undefined);
    mocks.getTreeNodeUpdaterAPI.mockResolvedValue({
      updateTreeNode: mocks.updateTreeNode,
      getTreeNode: mocks.getTreeNode,
    });
  });

  it('saves draft without reading tree node first', async () => {
    const workerClient = {
      getAPI: () => ({
        getTreeNodeUpdaterAPI: mocks.getTreeNodeUpdaterAPI,
      }),
    };
    const { result } = renderHook(() =>
      useShapeBuildDraftSaver({
        activeNodeId: 'node-1',
        data: {
          buildConfig: {
            dataSourceName: 'source-a',
          },
        },
        workerClient: workerClient as unknown as WorkerClientRef,
      })
    );

    let saved = false;
    await act(async () => {
      saved = await result.current.saveDraftBeforeBuild();
    });

    expect(saved).toBe(true);
    expect(mocks.getTreeNodeUpdaterAPI).toHaveBeenCalledTimes(1);
    expect(mocks.getTreeNode).not.toHaveBeenCalled();
    expect(mocks.updateTreeNode).toHaveBeenCalledTimes(1);
    expect(mocks.updateTreeNode.mock.calls[0]?.[0]).toBe('node-1');
    expect(mocks.updateTreeNode.mock.calls[0]?.[1]).toMatchObject({
      mode: 'save-draft',
      draftData: {
        buildConfig: {
          dataSourceName: 'source-a',
        },
      },
    });
  });
});
