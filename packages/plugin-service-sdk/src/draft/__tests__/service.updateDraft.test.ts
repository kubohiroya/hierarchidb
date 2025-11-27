import { describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { DraftService } from '../service.js';

describe('DraftService.updateDraft', () => {
  it('forwards updates to worker API and merges state cache', async () => {
    const draftAPI = {
      getDraft: vi.fn().mockResolvedValue({
        treeId: 'tree-1',
        nodeType: 'basemap',
        data: { draftData: { mapStyle: { style: 'dark' } } },
        draftData: { mapStyle: { style: 'dark' } },
        currentStep: 0,
        completedSteps: [],
        isDraft: true,
      }),
      updateDraft: vi.fn().mockResolvedValue(undefined),
      updateTreeNodeDraftData: vi.fn().mockResolvedValue(undefined),
      getTreeNode: vi.fn().mockResolvedValue({ id: 'node-1', treeId: 'tree-1' }),
    };

    const workerAPI = {
      getDraftAPI: vi.fn().mockResolvedValue(draftAPI),
    };

    const service = new DraftService(workerAPI as any);
    const nodeId = 'node-1' as NodeId;

    await service.loadDraft(nodeId);

    const updates = {
      data: { draftData: { mapStyle: { style: 'satellite' } } },
      currentStep: 1,
      completedSteps: new Set([0, 1]),
      isDraft: true,
    };

    const state = await service.updateDraft(nodeId, updates);

    expect(draftAPI.updateTreeNodeDraftData).toHaveBeenCalledWith(nodeId, updates);
    expect(state.currentStep).toBe(1);
    expect(state.completedSteps.has(1)).toBe(true);
    expect(state.data).toEqual(updates.data);
  });
});
