import type { NodeId } from '@hierarchidb/core-types';
import type { PluginStepConfig } from '@hierarchidb/plugin-base';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStepNavigation } from '../usePluginDialogController/useStepNavigation';

const createArgs = (overrides?: {
  activeStepConfig?: PluginStepConfig;
  commitTreeNodeUpdater?: ReturnType<typeof vi.fn>;
  updateLocalDraft?: ReturnType<typeof vi.fn>;
  setStepTransitionDialog?: ReturnType<typeof vi.fn>;
}) => {
  const commitTreeNodeUpdater =
    overrides?.commitTreeNodeUpdater ?? vi.fn().mockResolvedValue('node-1');
  const updateLocalDraft =
    overrides?.updateLocalDraft ??
    vi.fn().mockResolvedValue({
      draftMetadata: { name: 'A', description: '', tags: [] },
      draftData: { connectionName: 'local' },
    });
  return {
    activeStepIndex: 0,
    stepsLength: 2,
    setActiveStepIndex: vi.fn(),
    setUrlStep: vi.fn(),
    toPersistedStepIndex: (index: number) => index + 1,
    runWithPending: vi.fn(async (_action, task) => {
      await task();
    }),
    updateLocalDraft,
    updateDialogUIState: vi.fn(),
    getPersistableDialogUIState: vi.fn(() => ({})),
    setStepTransitionDialog: overrides?.setStepTransitionDialog ?? vi.fn(),
    commitTreeNodeUpdater,
    activeStepConfig: overrides?.activeStepConfig,
    stepDescriptors: [
      { id: 'connection', label: 'Connection', component: () => null },
      { id: 'commands', label: 'Commands', component: () => null },
    ],
    dialogData: { connectionName: 'local' },
    mode: 'create' as const,
    treeId: 'tree-1',
    currentNodeVersion: 7,
    nodeId: 'node-1' as NodeId,
    parentId: 'parent-1' as NodeId,
    nodeType: 'idegsm-project',
    treeUpdaterTreeNodeId: 'node-1' as NodeId,
    treeUpdaterDraftMetadata: { name: 'A', description: '', tags: [] },
    localDraftDataRef: { current: { connectionName: 'local' } },
  };
};

describe('useStepNavigation beforeNavigateNext', () => {
  it('awaits the guard and save-draft before changing the active step', async () => {
    const calls: string[] = [];
    const guard = vi.fn(async () => {
      calls.push('guard');
      return { type: 'advance' as const, canonicalData: { connectionName: 'canonical' } };
    });
    const commitTreeNodeUpdater = vi.fn(async () => {
      calls.push('save-draft');
      return 'node-1';
    });
    const setActiveStepIndex = vi.fn(() => {
      calls.push('set-active');
    });
    const args = createArgs({
      activeStepConfig: {
        id: 'connection',
        label: 'Connection',
        componentFactory: () => null,
        capabilities: { beforeNavigateNext: guard },
      },
      commitTreeNodeUpdater,
    });
    args.setActiveStepIndex = setActiveStepIndex;
    const { result } = renderHook(() => useStepNavigation(args));

    act(() => {
      result.current.handleNavigation({ type: 'next' });
    });

    await waitFor(() => expect(setActiveStepIndex).toHaveBeenCalledWith(1));
    expect(calls).toEqual(['guard', 'save-draft', 'set-active']);
    expect(args.setUrlStep).toHaveBeenCalledWith(1);
    expect(args.updateDialogUIState).toHaveBeenCalledWith({
      dialogProgress: { activeStepIndex: 2 },
    });
    expect(commitTreeNodeUpdater.mock.calls[0]?.[1]?.draftData).toEqual({
      connectionName: 'canonical',
    });
  });

  it('stays on the current step when the guard rejects navigation', async () => {
    const guard = vi.fn().mockResolvedValue({ type: 'stay', reason: 'PROMOTION_FAILED' });
    const setStepTransitionDialog = vi.fn();
    const args = createArgs({
      activeStepConfig: {
        id: 'connection',
        label: 'Connection',
        componentFactory: () => null,
        capabilities: { beforeNavigateNext: guard },
      },
      setStepTransitionDialog,
    });
    const { result } = renderHook(() => useStepNavigation(args));

    act(() => {
      result.current.handleNavigation({ type: 'next' });
    });

    await waitFor(() =>
      expect(setStepTransitionDialog).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'PROMOTION_FAILED' })
      )
    );
    expect(args.setActiveStepIndex).not.toHaveBeenCalled();
    expect(args.setUrlStep).not.toHaveBeenCalled();
    expect(args.commitTreeNodeUpdater).not.toHaveBeenCalled();
  });

  it('does not advance when save-draft persistence fails', async () => {
    const args = createArgs({
      commitTreeNodeUpdater: vi.fn().mockRejectedValue(new Error('write failed')),
    });
    const { result } = renderHook(() => useStepNavigation(args));

    act(() => {
      result.current.handleNavigation({ type: 'next' });
    });

    await waitFor(() =>
      expect(args.setStepTransitionDialog).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'SAVE_DRAFT_FAILED' })
      )
    );
    expect(args.setActiveStepIndex).not.toHaveBeenCalled();
    expect(args.setUrlStep).not.toHaveBeenCalled();
  });

  it('uses the guard for direct forward navigation', async () => {
    const guard = vi.fn().mockResolvedValue({ type: 'advance' as const });
    const args = createArgs({
      activeStepConfig: {
        id: 'connection',
        label: 'Connection',
        componentFactory: () => null,
        capabilities: { beforeNavigateNext: guard },
      },
    });
    const { result } = renderHook(() => useStepNavigation(args));

    act(() => {
      result.current.handleNavigation({ type: 'direct', targetIndex: 1 });
    });

    await waitFor(() => expect(args.setActiveStepIndex).toHaveBeenCalledWith(1));
    expect(guard).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        currentStepId: 'connection',
        targetStepId: 'commands',
        currentStepIndex: 0,
        targetStepIndex: 1,
      })
    );
  });

  it('aborts a cancellable guard without advancing', async () => {
    let cancel: (() => void) | undefined;
    const guard = vi.fn(
      (
        _data,
        context: Parameters<NonNullable<PluginStepConfig['capabilities']>['beforeNavigateNext']>[1]
      ) =>
        new Promise<{ type: 'stay'; reason: string }>((resolve) => {
          context.signal.addEventListener(
            'abort',
            () => {
              resolve({ type: 'stay', reason: 'CANCELLED' });
            },
            { once: true }
          );
        })
    );
    const setStepTransitionDialog = vi.fn((state) => {
      if (state?.onCancel) {
        cancel = state.onCancel;
      }
    });
    const args = createArgs({
      activeStepConfig: {
        id: 'connection',
        label: 'Connection',
        componentFactory: () => null,
        capabilities: { beforeNavigateNext: guard },
      },
      setStepTransitionDialog,
    });
    const { result } = renderHook(() => useStepNavigation(args));

    act(() => {
      result.current.handleNavigation({ type: 'next' });
    });

    await waitFor(() => expect(cancel).toBeTypeOf('function'));
    act(() => {
      cancel?.();
    });

    await waitFor(() =>
      expect(setStepTransitionDialog).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'CANCELLED' })
      )
    );
    expect(args.setActiveStepIndex).not.toHaveBeenCalled();
    expect(args.setUrlStep).not.toHaveBeenCalled();
    expect(args.commitTreeNodeUpdater).not.toHaveBeenCalled();
  });
});
