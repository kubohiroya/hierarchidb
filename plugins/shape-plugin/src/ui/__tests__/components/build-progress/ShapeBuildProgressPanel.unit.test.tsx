import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('@hierarchidb/ui-batch-progress', () => ({
  BuildSessionLauncherPanel: () => null,
}));

import { ShapeBuildProgressPanel } from '../../../components/build-progress/ShapeBuildProgressPanel/ShapeBuildProgressPanel.tsx';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';
import {
  buildStagesAtom,
  buildStageProgressAtom,
  taskPaneProgressAtom,
  taskProgressControlsAtom,
  taskScrollTargetAtom,
  taskProgressSummaryAtom,
  taskSummaryLoadingAtom,
  taskViewportRangeAtom,
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
  store.set(tasksByStageAtom, { fetch: [], transform: [], vt: [] });
  store.set(taskProgressControlsAtom, {
    canStartOrResume: false,
    statusLabel: '',
  });
  return store;
};

afterEach(() => {
  cleanup();
});

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
      message: 'simplify-only:done',
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
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    await within(view.container).findByText('Build controls');
    await waitFor(() => {
      expect(document.body.textContent).toContain('transform failed: max vertices per feature exceeded');
    });
  });

  it('shows resume label when tasks remain even if status is idle', async () => {
    const store = makeStore();
    store.set(taskProgressControlsAtom, {
      canStartOrResume: true,
      statusLabel: '',
      showResumeLabel: true,
    });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Idle',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 0,
      failed: 0,
      skipped: 0,
      buildStatus: 'idle',
      hasProgressData: false,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');
    await waitFor(() => {
      expect(local.getByText('Resume Build')).toBeTruthy();
    });
  });

  it('disables start button immediately after click', async () => {
    const store = makeStore();
    let resolveStart: (() => void) | null = null;
    const startPromise = new Promise<void>((resolve) => {
      resolveStart = resolve;
    });
    store.set(taskProgressControlsAtom, {
      canStartOrResume: true,
      statusLabel: '',
      showResumeLabel: false,
      startPending: false,
      handleStartOrResume: () => startPromise,
    });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Idle',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 0,
      failed: 0,
      skipped: 0,
      buildStatus: 'idle',
      hasProgressData: false,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');
    const startButton = await local.findByRole('button', { name: 'Start Build' }) as HTMLButtonElement;
    await waitFor(() => {
      expect(startButton.disabled).toBe(false);
    });

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(startButton.disabled).toBe(true);
    });

    resolveStart?.();
    await waitFor(() => {
      expect(startButton.disabled).toBe(false);
    });
  });

  it('keeps task skeleton after start resolves until tasks arrive', async () => {
    const store = makeStore();
    let resolveStart: (() => void) | null = null;
    const startPromise = new Promise<void>((resolve) => {
      resolveStart = resolve;
    });
    store.set(tasksLoadingAtom, false);
    store.set(taskSummaryLoadingAtom, false);
    store.set(tasksByStageAtom, { fetch: [], transform: [], vt: [] });
    store.set(taskProgressControlsAtom, {
      canStartOrResume: true,
      statusLabel: '',
      showResumeLabel: false,
      startPending: false,
      handleStartOrResume: () => startPromise,
    });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Idle',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 0,
      failed: 0,
      skipped: 0,
      buildStatus: 'idle',
      hasProgressData: false,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');
    const startButton = await local.findByRole('button', { name: 'Start Build' }) as HTMLButtonElement;
    fireEvent.click(startButton);
    resolveStart?.();

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('No tasks yet.')).toBeNull();
  });

  it('shows startup snackbar while start is pending before running', async () => {
    const store = makeStore();
    store.set(taskProgressControlsAtom, {
      canStartOrResume: false,
      statusLabel: 'session-start-request',
      startPending: true,
    });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Idle',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 0,
      failed: 0,
      skipped: 0,
      buildStatus: 'idle',
      hasProgressData: false,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('session-start-request')).toBeTruthy();
    });
  });

  it('shows task skeleton while tasks are loading and no task list is available yet', async () => {
    const store = makeStore();
    store.set(tasksLoadingAtom, true);
    store.set(taskSummaryLoadingAtom, false);
    store.set(tasksByStageAtom, { fetch: [], transform: [], vt: [] });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Idle',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 0,
      failed: 0,
      skipped: 0,
      buildStatus: 'idle',
      hasProgressData: false,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Build controls')).toBeTruthy();
    });

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('No tasks yet.')).toBeNull();
  });

  it('shows task skeleton while start is pending and no task list is available yet', async () => {
    const store = makeStore();
    store.set(tasksLoadingAtom, false);
    store.set(taskSummaryLoadingAtom, false);
    store.set(tasksByStageAtom, { fetch: [], transform: [], vt: [] });
    store.set(taskProgressControlsAtom, {
      canStartOrResume: true,
      statusLabel: '',
      startPending: true,
      handleStartOrResume: () => Promise.resolve(),
    });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Idle',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 0,
      failed: 0,
      skipped: 0,
      buildStatus: 'idle',
      hasProgressData: false,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Build controls')).toBeTruthy();
    });

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('No tasks yet.')).toBeNull();
  });

  it('allows dismissing startup snackbar manually', async () => {
    const store = makeStore();
    store.set(taskProgressControlsAtom, {
      canStartOrResume: false,
      statusLabel: 'session-start-request',
      startPending: true,
    });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Idle',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 0,
      failed: 0,
      skipped: 0,
      buildStatus: 'idle',
      hasProgressData: false,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('session-start-request')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByText('session-start-request')).toBeNull();
    });
  });

  it('scrolls to queued task from down arrow when running task exists', async () => {
    const store = makeStore();
    const runningTask: ShapeBuildTaskSummary = {
      taskId: 'task-running-0',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'running',
      progress: 10,
      message: 'Running',
    } as ShapeBuildTaskSummary;
    const queuedTask: ShapeBuildTaskSummary = {
      taskId: 'task-queued-1',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    store.set(tasksByStageAtom, { fetch: [runningTask, queuedTask], transform: [], vt: [] });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Running',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 2,
      failed: 0,
      skipped: 0,
      buildStatus: 'running',
      hasProgressData: true,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });
    store.set(taskViewportRangeAtom, {
      stageId: 'fetch',
      startTaskId: 'task-running-0',
      endTaskId: 'task-running-0',
      startIndex: 0,
      endIndex: 0,
      total: 2,
      updatedAt: 1,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');
    const scrollButton = await local.findByRole('button', {
      name: 'Scroll down to running or queued task',
    });
    fireEvent.click(scrollButton);

    await waitFor(() => {
      const target = store.get(taskScrollTargetAtom);
      expect(target?.stageId).toBe('fetch');
      expect(target?.taskId).toBe('task-queued-1');
      expect(typeof target?.requestedAt).toBe('number');
    });
  });

  it('hides both arrows when no running task exists and visible tasks are queued', async () => {
    const store = makeStore();
    const queuedTaskA: ShapeBuildTaskSummary = {
      taskId: 'task-queued-a',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    const queuedTaskB: ShapeBuildTaskSummary = {
      taskId: 'task-queued-b',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    store.set(tasksByStageAtom, { fetch: [queuedTaskA, queuedTaskB], transform: [], vt: [] });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Queued',
      taskUnitLabel: 'Tasks',
      overallProgress: 0,
      completed: 0,
      total: 2,
      failed: 0,
      skipped: 0,
      buildStatus: 'running',
      hasProgressData: true,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');

    await waitFor(() => {
      expect(local.queryByRole('button', { name: 'Scroll up to running or queued task' })).toBeNull();
      expect(local.queryByRole('button', { name: 'Scroll down to running or queued task' })).toBeNull();
    });
  });

  it('hides both arrows when viewport tasks are queued even if running task exists outside viewport', async () => {
    const store = makeStore();
    const queuedTop: ShapeBuildTaskSummary = {
      taskId: 'task-queued-top',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    const queuedVisible: ShapeBuildTaskSummary = {
      taskId: 'task-queued-visible',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    const runningBottom: ShapeBuildTaskSummary = {
      taskId: 'task-running-bottom',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'running',
      progress: 10,
      message: 'Running',
    } as ShapeBuildTaskSummary;
    const queuedBottom: ShapeBuildTaskSummary = {
      taskId: 'task-queued-bottom',
      nodeId: 'node-1',
      stage: 'fetch',
      taskType: 'fetch',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    store.set(tasksByStageAtom, { fetch: [queuedTop, queuedVisible, runningBottom, queuedBottom], transform: [], vt: [] });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Running',
      taskUnitLabel: 'Tasks',
      overallProgress: 5,
      completed: 0,
      total: 4,
      failed: 0,
      skipped: 0,
      buildStatus: 'running',
      hasProgressData: true,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });
    store.set(taskViewportRangeAtom, {
      stageId: 'fetch',
      startTaskId: 'task-queued-visible',
      endTaskId: 'task-queued-visible',
      startIndex: 1,
      endIndex: 1,
      total: 4,
      updatedAt: 1,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');

    await waitFor(() => {
      expect(local.queryByRole('button', { name: 'Scroll up to running or queued task' })).toBeNull();
      expect(local.queryByRole('button', { name: 'Scroll down to running or queued task' })).toBeNull();
    });
  });

  it('hides both arrows when viewport top includes running and queued tasks but next targets are still visible', async () => {
    const store = makeStore();
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-running-0',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'running',
        progress: 40,
        message: 'Running',
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-running-1',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'running',
        progress: 20,
        message: 'Running',
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-queued-2',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'queued',
        progress: 0,
        message: 'Queued',
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-queued-3',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'queued',
        progress: 0,
        message: 'Queued',
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-queued-4',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'queued',
        progress: 0,
        message: 'Queued',
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-queued-5',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'queued',
        progress: 0,
        message: 'Queued',
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-queued-6',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'queued',
        progress: 0,
        message: 'Queued',
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-queued-7',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'queued',
        progress: 0,
        message: 'Queued',
      } as ShapeBuildTaskSummary,
    ];

    store.set(tasksByStageAtom, { fetch: tasks, transform: [], vt: [] });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Fetch',
      taskLabel: 'Running',
      taskUnitLabel: 'Tasks',
      overallProgress: 5,
      completed: 0,
      total: tasks.length,
      failed: 0,
      skipped: 0,
      buildStatus: 'running',
      hasProgressData: true,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });
    store.set(taskViewportRangeAtom, {
      stageId: 'fetch',
      startTaskId: 'task-running-0',
      endTaskId: 'task-queued-5',
      startIndex: 0,
      endIndex: 5,
      total: tasks.length,
      updatedAt: 1,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');

    await waitFor(() => {
      expect(local.queryByRole('button', { name: 'Scroll up to running or queued task' })).toBeNull();
      expect(local.queryByRole('button', { name: 'Scroll down to running or queued task' })).toBeNull();
    });
  });

  it('hides arrow icon when current position reaches the scroll target', async () => {
    const store = makeStore();
    const runningTop: ShapeBuildTaskSummary = {
      taskId: 'a-running-target',
      nodeId: 'node-1',
      stage: 'transform',
      taskType: 'transform',
      status: 'running',
      progress: 40,
      message: 'Running',
    } as ShapeBuildTaskSummary;
    const queuedBottom: ShapeBuildTaskSummary = {
      taskId: 'z-queued-next',
      nodeId: 'node-1',
      stage: 'transform',
      taskType: 'transform',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    store.set(tasksByStageAtom, { fetch: [], transform: [runningTop, queuedBottom], vt: [] });
    store.set(taskProgressSummaryAtom, {
      stageLabel: 'Transform',
      taskLabel: 'Running',
      taskUnitLabel: 'Tasks',
      overallProgress: 30,
      completed: 0,
      total: 2,
      failed: 0,
      skipped: 0,
      buildStatus: 'running',
      hasProgressData: true,
      timingStageId: null,
      completedStageElapsedMs: {},
      totalElapsedMs: 0,
      stageElapsedMs: 0,
      stageRemainingMs: null,
    });
    store.set(taskScrollTargetAtom, {
      stageId: 'transform',
      taskId: 'a-running-target',
      requestedAt: 1,
    });
    store.set(taskViewportRangeAtom, {
      stageId: 'transform',
      startTaskId: 'a-running-target',
      endTaskId: 'a-running-target',
      startIndex: 0,
      endIndex: 0,
      total: 2,
      updatedAt: 1,
    });

    const view = render(
      <Provider store={store}>
        <ShapeBuildProgressPanel data={{}} />
      </Provider>
    );

    const local = within(view.container);
    await local.findByText('Build controls');

    await waitFor(() => {
      expect(local.queryByRole('button', { name: 'Scroll up to running or queued task' })).toBeNull();
      expect(local.queryByRole('button', { name: 'Scroll down to running or queued task' })).toBeNull();
    });
  });
});
