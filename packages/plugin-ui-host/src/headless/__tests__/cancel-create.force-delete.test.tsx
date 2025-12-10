import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePluginDialogController } from '../usePluginDialogController.js';

const discardDraft = vi.fn();

vi.mock('@hierarchidb/plugin-ui-sdk', () => ({
  useTreeNodeUpdater: vi.fn(() => ({
    treeNodeUpdater: { treeNodeId: 'draft-1', draftMetadata: null, draftData: {} },
    hasUnsavedChanges: true,
    updateTreeNodeUpdater: vi.fn(),
    commitTreeNodeUpdater: vi.fn(),
    discardDraft,
    loading: false,
    error: null,
  })),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/t/1/parent/draft', searchStr: '', hash: '' }),
}));

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  getWorkerClientHook: () => () => null,
}));

vi.mock('@hierarchidb/plugin-presentation', () => ({
  getPresentation: () => ({ label: 'Folder', description: undefined }),
  getIconComponent: () => null,
  hydratePresentationDefinitionsFromGlobal: vi.fn(),
}));

vi.mock('@hierarchidb/plugin-base', () => {
  const registry = {
    getInstance: () => ({
      subscribe: () => vi.fn(),
      getBaseStepConfigs: () => [],
      getVersion: () => 0,
      resolveHostForNodeType: () => undefined,
    }),
  };
  return {
    HostProfileRegistry: registry,
    PluginStepRegistry: registry,
    composeStepConfigs: () => ({ hasHostBase: false, configs: [] }),
  };
});

vi.mock('../usePluginDialogController/steps.js', () => ({
  useDialogSteps: () => ({
    steps: [],
    stepDescriptors: [],
    currentStepData: {},
    dialogData: {},
  }),
}));

vi.mock('../usePluginDialogController/capabilities.js', () => ({
  useStepCapabilities: () => ({
    evaluatedState: { guards: { canSave: false, canStartBatch: false } },
    enabledStepIndices: [],
    validatedStepIndices: [],
    committableStepIndices: [],
    activeStepConfig: null,
  }),
}));

vi.mock('../usePluginDialogController/basic-info.js', () => ({
  useBasicInfoState: () => ({
    basicInfo: { name: 'New Folder', description: '', tags: [] },
    setBasicInfo: vi.fn(),
    basicInfoMeta: { error: null, hasConflict: false },
    basicInfoValidationError: null,
    isBasicInfoValid: true,
    handleBasicInfoBridge: vi.fn(),
  }),
}));

vi.mock('../usePluginDialogController/frame-state.js', () => ({
  useDialogFrameState: () => ({
    dialogPosition: { x: 0, y: 0 },
    setDialogPosition: vi.fn(),
    dialogSize: { width: 960, height: 640 },
    setDialogSize: vi.fn(),
    displayMode: 'normal',
    transitionDisplayMode: vi.fn(),
    activeStepIndex: 0,
    setActiveStepIndex: vi.fn(),
    setUrlStep: vi.fn(),
    handleSizeChange: vi.fn(),
    handlePositionChange: vi.fn(),
    dialogRef: { current: null },
  }),
}));

vi.mock('../controller/step-guards.js', async () => {
  const actual = await vi.importActual('../controller/step-guards.js');
  return {
    ...actual,
    buildStepWorkingData: actual.buildStepWorkingData,
    BASIC_INFO_META_KEY: actual.BASIC_INFO_META_KEY,
  };
});

describe('usePluginDialogController cancel (create mode)', () => {
  beforeEach(() => {
    discardDraft.mockClear();
  });

  it('requests forceDelete when cancelling create dialog', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      usePluginDialogController({
        mode: 'create',
        nodeType: 'folder',
        nodeId: 'n:1' as any,
        pageNodeId: 'p:1' as any,
        treeId: 't:1' as any,
        open: true,
        onClose,
      })
    );

    act(() => {
      result.current.headlessProps.onRequestClose?.();
    });

    await Promise.resolve();

    expect(discardDraft).toHaveBeenCalledWith({ forceDelete: true });
    expect(onClose).toHaveBeenCalled();
  });
});
