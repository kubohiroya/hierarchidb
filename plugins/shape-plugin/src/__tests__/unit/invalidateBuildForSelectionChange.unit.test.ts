import type { NodeId } from '@hierarchidb/core-types';
import type { BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateBuildForSelectionChange } from '../../ui/components/country-selection/internal/invalidateBuildForSelectionChange.js';

const mocks = vi.hoisted(() => ({
  deleteBuildSession: vi.fn(),
  runCleanup: vi.fn(),
}));

vi.mock('~/services/build/ShapeBuildAPIClient', () => ({
  shapeMutationAPIImpl: {
    deleteBuildSession: mocks.deleteBuildSession,
  },
}));

vi.mock('~/services/vt/runShapeArtifactCascadeCleanup', () => ({
  runShapeArtifactCascadeCleanup: mocks.runCleanup,
}));

const nodeId = 'selection-invalidation-unit' as NodeId;

const createBridge = () => {
  const updateTreeNode = vi.fn().mockResolvedValue(undefined);
  const getTreeNode = vi.fn().mockResolvedValue({ draftData: { existing: true } });
  const initialize = vi.fn().mockResolvedValue(undefined);
  const getTreeNodeUpdaterAPI = vi.fn().mockResolvedValue({ getTreeNode, updateTreeNode });
  return {
    bridge: { initialize, getTreeNodeUpdaterAPI } as unknown as BuildWorkerBridge,
    getTreeNode,
    getTreeNodeUpdaterAPI,
    initialize,
    updateTreeNode,
  };
};

describe('invalidateBuildForSelectionChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteBuildSession.mockResolvedValue(undefined);
    mocks.runCleanup.mockResolvedValue(undefined);
  });

  it('persists the draft and removes the obsolete session only after cleanup succeeds', async () => {
    const bridge = createBridge();

    await invalidateBuildForSelectionChange({
      bridgeRef: bridge.bridge,
      nodeId,
      prev: { JP: [true] },
      nextSelection: { JP: [false] },
    });

    expect(mocks.runCleanup).toHaveBeenCalledWith({
      nodeId,
      target: {
        kind: 'selection',
        removedSelections: [{ countryCode: 'JP', adminLevel: 0 }],
      },
    });
    expect(bridge.updateTreeNode).toHaveBeenCalledWith(nodeId, {
      mode: 'save-draft',
      draftData: {
        existing: true,
        selectedArrayByCountries: { JP: [false] },
      },
    });
    expect(mocks.deleteBuildSession).toHaveBeenCalledWith(nodeId);
    expect(mocks.runCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      bridge.initialize.mock.invocationCallOrder[0] ?? 0
    );
    expect(bridge.updateTreeNode.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteBuildSession.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('does not mutate the draft or session when cleanup fails', async () => {
    const bridge = createBridge();
    mocks.runCleanup.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(
      invalidateBuildForSelectionChange({
        bridgeRef: bridge.bridge,
        nodeId,
        prev: { JP: [true] },
        nextSelection: { JP: [false] },
      })
    ).rejects.toThrow('cleanup failed');

    expect(bridge.initialize).not.toHaveBeenCalled();
    expect(bridge.updateTreeNode).not.toHaveBeenCalled();
    expect(mocks.deleteBuildSession).not.toHaveBeenCalled();
  });
});
