import { describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { WorkingCopyService } from '../service.js';

describe('WorkingCopyService.updateWorkingCopy', () => {
  it('forwards updates to worker API and merges state cache', async () => {
    const workingCopyAPI = {
      getWorkingCopy: vi.fn().mockResolvedValue({
        treeId: 'tree-1',
        nodeType: 'basemap',
        data: { draftData: { mapStyle: { style: 'dark' } } },
        draftData: { mapStyle: { style: 'dark' } },
        currentStep: 0,
        completedSteps: [],
        isDraft: true,
      }),
      updateWorkingCopy: vi.fn().mockResolvedValue(undefined),
    };

    const workerAPI = {
      getWorkingCopyAPI: vi.fn().mockResolvedValue(workingCopyAPI),
    };

    const service = new WorkingCopyService(workerAPI as any);
    const nodeId = 'node-1' as NodeId;

    await service.loadWorkingCopy(nodeId);

    const updates = {
      data: { draftData: { mapStyle: { style: 'satellite' } } },
      currentStep: 1,
      completedSteps: new Set([0, 1]),
      isDraft: true,
    };

    const state = await service.updateWorkingCopy(nodeId, updates);

    expect(workingCopyAPI.updateWorkingCopy).toHaveBeenCalledWith(nodeId, updates);
    expect(state.currentStep).toBe(1);
    expect(state.completedSteps.has(1)).toBe(true);
    expect(state.data).toEqual(updates.data);
  });
});
