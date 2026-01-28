import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error test shim
(globalThis as { ResizeObserver?: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('../../../components/build-progress/useBuildCrashInsight.js', () => ({
  useBuildCrashInsight: () => null,
}));

vi.mock('../../../components/build-progress/useShapeBuildProgressWarnings.js', () => ({
  useShapeBuildProgressWarnings: () => ({
    startWarning: null,
    crashHint: null,
    warningDialogOpen: false,
    setWarningDialogOpen: vi.fn(),
    crashHintOpen: false,
    setCrashHintOpen: vi.fn(),
    sizeWarningOpen: false,
    setSizeWarningOpen: vi.fn(),
  }),
}));

import { ShapeBuildProgressPanel } from '../../../components/build-progress/ShapeBuildProgressPanel.tsx';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';
import {
  buildStagesAtom,
  buildStageProgressAtom,
  taskPaneProgressAtom,
  taskProgressControlsAtom,
  taskProgressSummaryAtom,
  taskSummaryLoadingAtom,
  tasksLoadingAtom,
  taskWarningMessageAtom,
  tasksByStageAtom,
} from '../../../atoms/shapeBuildProgressAtoms.js';

const makeStore = () => {
  const store = createStore();
  store.set(buildStagesAtom, [
    { id: 'fetch', title: 'Fetch', description: '', icon: null },
    { id: 'transform', title: 'Transform', description: '', icon: null },
    { id: 'vt', title: 'VT', description: '', icon: null },
  ]);
  store.set(buildStageProgressAtom, { fetch: 100, transform: 50, vt: 0 });
  store.set(taskPaneProgressAtom, []);
  store.set(tasksLoadingAtom, false);
  store.set(taskSummaryLoadingAtom, false);
  store.set(taskWarningMessageAtom, null);
  store.set(taskProgressControlsAtom, {
    canStartOrResume: false,
    statusLabel: '',
  });
  return store;
};

describe('ShapeBuildProgressPanel', () => {
  it('shows detailed error message from failed tasks', async () => {
    const store = makeStore();
    const failedTask: ShapeBuildTaskSummary = {
      taskId: 'task-1',
      nodeId: 'node-1',
      stage: 'transform',
      taskType: 'transform',
      status: 'failed',
      progress: 100,
      message: 'phase=simplify-only:done',
      errorMessage: 'transform failed: max vertices per feature exceeded',
    } as ShapeBuildTaskSummary;
    store.set(tasksByStageAtom, { transform: [failedTask] });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Transform',
      taskLabel: 'Failed',
      taskUnitLabel: 'Tasks',
      overallProgress: 50,
      completed: 0,
      total: 1,
      failed: 1,
      skipped: 0,
      buildStatus: 'failed',
      hasProgressData: true,
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    await screen.findByText('Build controls');
    expect(document.body.textContent).toContain('Build failed');
    expect(document.body.textContent).toContain('transform failed: max vertices per feature exceeded');
  });
});
