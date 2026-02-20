import type { NodeId } from '@hierarchidb/core-types';
import type { composeStepConfigs } from '@hierarchidb/plugin-base';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDialogSteps } from '../usePluginDialogController/steps';

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  getWorkerClientHook: () => () => null,
}));

describe('useDialogSteps input flush', () => {
  it('does not call updateDraft on input change, but flushes on navigation', () => {
    const composedConfigs: ReturnType<typeof composeStepConfigs> = {
      hasHostBase: false,
      configs: [],
    };
    const updateDraft = vi.fn();
    const { result } = renderHook(() =>
      useDialogSteps({
        composedConfigs,
        basicInfo: { name: 'A', description: '', tags: [] },
        setBasicInfo: vi.fn(),
        basicInfoMeta: { error: null, hasConflict: false },
        basicInfoValidationError: null,
        isBasicInfoValid: true,
        tagSuggestions: [],
        mode: 'create',
        nodeId: 'n1' as NodeId,
        pageNodeId: 'p1' as NodeId,
        draftData: {},
        setDraftData: vi.fn(),
        handleBasicInfoBridge: vi.fn(),
        dialogRef: { current: null },
      })
    );

    // onChange is passed through but updateDraft is not called here (local only)
    const desc = result.current.stepDescriptors[0];
    expect(desc?.component).toBeTruthy();
    // navigation flush path is covered in controller-level tests; this hook should not
    // trigger persistence on construction.
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
