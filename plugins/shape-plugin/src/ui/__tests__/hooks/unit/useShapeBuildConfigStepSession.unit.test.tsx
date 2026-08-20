import type { NodeId } from '@hierarchidb/core-types';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchBuildSessionEventAtom } from '../../../atoms/buildSessionStateAtoms';
import { useShapeBuildConfigStepSession } from '../../../components/build-config/useShapeBuildConfigStepSession';

const mocks = vi.hoisted(() => ({
  onStepNavigate: vi.fn(),
  useShapeBuildSessionStateAtomBridge: vi.fn(),
}));

vi.mock('@hierarchidb/ui-dialog', () => ({
  useDialogContext: () => ({
    stepComponents: [{ id: 'data-source' }, { id: 'build' }],
    onStepNavigate: mocks.onStepNavigate,
  }),
}));

vi.mock('../../../hooks/useShapeBuildSessionStateAtomBridge', () => ({
  useShapeBuildSessionStateAtomBridge: mocks.useShapeBuildSessionStateAtomBridge,
}));

describe('useShapeBuildConfigStepSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the canonical lifecycle atom and opens the build step', () => {
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const nodeId = 'node-1' as NodeId;
    const { result } = renderHook(() => useShapeBuildConfigStepSession({ nodeId }), { wrapper });

    expect(mocks.useShapeBuildSessionStateAtomBridge).toHaveBeenCalledWith(nodeId);
    expect(result.current.isBuildRunning).toBe(false);

    act(() => {
      store.set(dispatchBuildSessionEventAtom, {
        type: 'sessionStatusUpdated',
        payload: {
          nodeId,
          phase: 'starting',
          isActive: true,
        },
      });
    });

    expect(result.current.isBuildRunning).toBe(true);

    act(() => {
      result.current.handleOpenBuildStep();
    });

    expect(mocks.onStepNavigate).toHaveBeenCalledWith({
      type: 'direct',
      targetIndex: 1,
    });

    act(() => {
      store.set(dispatchBuildSessionEventAtom, {
        type: 'sessionStatusUpdated',
        payload: {
          nodeId,
          phase: 'paused',
          isActive: false,
          startedAt: 1_000,
        },
      });
    });

    expect(result.current.isBuildRunning).toBe(false);
  });
});
