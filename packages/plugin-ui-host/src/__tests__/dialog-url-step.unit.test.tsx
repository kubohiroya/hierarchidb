/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom/vitest" />
import '@testing-library/jest-dom/vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDialogFrameState } from '~/headless/usePluginDialogController/frame-state';

type Snapshot = {
  activeStepIndex: number;
};

const TestHarness = ({
  urlState,
  initialDialogUIState,
  onSnapshot,
  onUrlStateChange,
}: {
  urlState: { mode: 'normal' | 'maximize' | 'full-screen'; step: number };
  initialDialogUIState: {
    dialogWindow: {
      mode: 'normal' | 'maximize' | 'full-screen';
      position: { x: number; y: number };
      size: { width: number; height: number };
      restorePosition: { x: number; y: number } | null;
      restoreSize: { width: number; height: number } | null;
    };
    dialogProgress: { activeStepIndex: number } | null;
  };
  onSnapshot: (value: Snapshot) => void;
  onUrlStateChange: (next: { mode: 'normal' | 'maximize' | 'full-screen'; step: number }) => void;
}) => {
  const state = useDialogFrameState({
    nodeType: 'shape',
    nodeId: 'node-1',
    pageNodeId: 'page-1',
    initialStep: 1,
    initialDialogUIState,
    urlState,
    onUrlStateChange,
  });
  onSnapshot({ activeStepIndex: state.activeStepIndex });
  return null;
};

afterEach(() => {
  cleanup();
});

describe('useDialogFrameState url step', () => {
  it('keeps active step from urlState even when dialog progress exists', async () => {
    const onUrlStateChange = vi.fn();
    let snapshot: Snapshot | null = null;

    render(
      <TestHarness
        urlState={{ mode: 'normal', step: 5 }}
        initialDialogUIState={{
          dialogWindow: {
            mode: 'normal',
            position: { x: 0, y: 0 },
            size: { width: 800, height: 600 },
            restorePosition: null,
            restoreSize: null,
          },
          dialogProgress: { activeStepIndex: 1 },
        }}
        onSnapshot={(value) => {
          snapshot = value;
        }}
        onUrlStateChange={onUrlStateChange}
      />
    );

    await waitFor(() => {
      expect(snapshot?.activeStepIndex).toBe(4);
    });

    for (const call of onUrlStateChange.mock.calls) {
      expect(call[0].step).toBe(5);
    }
  });
});
