import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore, type Store } from 'jotai/vanilla';
import { BuildSessionProgressPanel } from '@hierarchidb/components';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressTypes';
import { taskScrollTargetAtom, taskViewportRangeAtom } from '../../../atoms/shapeBuildProgressAtoms';
import { dispatchBuildSessionEventAtom } from '../../../atoms/buildSessionStateAtoms';
import { ShapeBuildProgressPanel } from '../../../components/build-progress/ShapeBuildProgressPanel/ShapeBuildProgressPanel';

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

vi.mock('../../../components/build-progress/internal/useShapeBuildSessionState.js', () => ({
  useShapeBuildSessionState: () => ({
    updateSessionRecord: async () => true,
  }),
}));

vi.mock('@hierarchidb/ui-build-progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/ui-build-progress')>();
  const mockStages = [
    { id: 'source', title: 'Source', description: '', icon: null },
    { id: 'geometry', title: 'Geometry', description: '', icon: null },
    { id: 'tileEmit', title: 'TileEmit', description: '', icon: null },
  ];

  return {
    ...actual,
    BuildSessionProgressPanelShell: (props: object) => (
      <BuildSessionProgressPanel {...props} />
    ),
    useBuildProgressStages: () => mockStages,
    resolveBuildStages: () => mockStages,
    BuildSessionLauncherPanel: ({ children }: { children?: unknown }) => <>{children}</>,
    resolveBuildSessionProgressPanelSplitViewProps: () => ({}),
    __esModule: true,
  };
});

let eventVersionCounter = 1;
const nextEventVersion = () => {
  eventVersionCounter += 1;
  return eventVersionCounter;
};

const setStageProgress = (
  store: Store,
  progressByStage: Partial<Record<'source' | 'geometry' | 'tileEmit', number>>,
) => {
  const stages: Array<'source' | 'geometry' | 'tileEmit'> = ['source', 'geometry', 'tileEmit'];
  for (const stageId of stages) {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'progressReceived',
      eventVersion: nextEventVersion(),
      payload: {
        stageId,
        value: progressByStage[stageId] ?? 0,
        phase: 'running',
      },
    });
  }
};

const setTasksByStage = (
  store: Store,
  tasksByStage: Partial<Record<'source' | 'geometry' | 'tileEmit', ShapeBuildTaskSummary[]>>,
) => {
  const stages: Array<'source' | 'geometry' | 'tileEmit'> = ['source', 'geometry', 'tileEmit'];
  for (const stageId of stages) {
    const eventVersion = nextEventVersion();
    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskSnapshotReceived',
      eventVersion,
      payload: {
        stageId,
        tasks: (tasksByStage[stageId] ?? []).map((task, index) => ({
          ...task,
          stage: stageId,
          version: task.version ?? eventVersion + index,
          sequence: task.sequence ?? index,
        })),
      },
    });
  }
};

const setSessionPhase = (
  store: Store,
  phase: 'idle' | 'starting' | 'running' | 'pausing' | 'paused' | 'resuming' | 'finalizing' | 'completed' | 'failed',
) => {
  store.set(dispatchBuildSessionEventAtom, {
    type: 'sessionRecordReceived',
    eventVersion: nextEventVersion(),
    payload: {
      nodeId: 'test-node',
      phase,
    },
  });
};

const makeStore = () => {
  const store = createStore();
  setStageProgress(store, { source: 100, geometry: 50, tileEmit: 0 });
  setSessionPhase(store, 'idle');
  setTasksByStage(store, { source: [], geometry: [], tileEmit: [] });
  return store;
};

const renderPanel = (store: Store) => render(
  <Provider store={store}>
    <ShapeBuildProgressPanel data={{}} nodeId={'node-1' as NodeId} />
  </Provider>,
);

afterEach(() => {
  cleanup();
});

describe('ShapeBuildProgressPanel (state-tree)', () => {
  it('renders failed-task snapshot without crashing', async () => {
    const store = makeStore();
    const failedTask: ShapeBuildTaskSummary = {
      taskId: 'task-1',
      nodeId: 'node-1',
      stage: 'geometry',
      taskType: 'geometry',
      status: 'failed',
      progress: 100,
      message: 'simplify-only:done',
      errorMessage: 'geometry failed: max vertices per feature exceeded',
    } as ShapeBuildTaskSummary;
    setTasksByStage(store, { geometry: [failedTask] });
    setSessionPhase(store, 'failed');

    const view = renderPanel(store);

    await within(view.container).findByText('Build Session');
    await waitFor(() => {
      expect(document.body.textContent).toContain('Build Session');
    });
  });

  it('shows task skeleton while awaiting first snapshot in running state', async () => {
    const store = makeStore();
    setSessionPhase(store, 'running');
    setTasksByStage(store, { source: [], geometry: [], tileEmit: [] });

    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText('Build Session')).toBeTruthy();
    });

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('No tasks yet.')).toBeNull();
  });

  it('does not show task skeleton while idle before start is requested', async () => {
    const store = makeStore();
    setSessionPhase(store, 'idle');
    setTasksByStage(store, { source: [], geometry: [], tileEmit: [] });

    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText('Build Session')).toBeTruthy();
    });

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(0);
    expect(screen.getAllByText('No tasks yet.').length).toBeGreaterThan(0);
  });

  it('scrolls to queued task from down arrow when running task exists', async () => {
    const store = makeStore();
    const runningTask: ShapeBuildTaskSummary = {
      taskId: 'task-running-0',
      nodeId: 'node-1',
      stage: 'source',
      taskType: 'source',
      status: 'running',
      progress: 10,
      message: 'Running',
    } as ShapeBuildTaskSummary;
    const queuedTask: ShapeBuildTaskSummary = {
      taskId: 'task-queued-1',
      nodeId: 'node-1',
      stage: 'source',
      taskType: 'source',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    setSessionPhase(store, 'running');
    setTasksByStage(store, { source: [runningTask, queuedTask], geometry: [], tileEmit: [] });
    store.set(taskViewportRangeAtom, {
      stageId: 'source',
      startTaskId: 'task-running-0',
      endTaskId: 'task-running-0',
      startIndex: 0,
      endIndex: 0,
      total: 2,
      updatedAt: 1,
    });

    const view = renderPanel(store);

    const local = within(view.container);
    await local.findByText('Build Session');
    const scrollButton = await local.findByRole('button', {
      name: 'Scroll down to running or queued task',
    });
    fireEvent.click(scrollButton);

    await waitFor(() => {
      const target = store.get(taskScrollTargetAtom);
      expect(target?.stageId).toBe('source');
      expect(target?.taskId).toBe('task-queued-1');
      expect(typeof target?.requestedAt).toBe('number');
    });
  });

  it('hides arrow icon when current position reaches the scroll target', async () => {
    const store = makeStore();
    const runningTop: ShapeBuildTaskSummary = {
      taskId: 'a-running-target',
      nodeId: 'node-1',
      stage: 'geometry',
      taskType: 'geometry',
      status: 'running',
      progress: 40,
      message: 'Running',
    } as ShapeBuildTaskSummary;
    const queuedBottom: ShapeBuildTaskSummary = {
      taskId: 'z-queued-next',
      nodeId: 'node-1',
      stage: 'geometry',
      taskType: 'geometry',
      status: 'queued',
      progress: 0,
      message: 'Queued',
    } as ShapeBuildTaskSummary;
    setSessionPhase(store, 'running');
    setTasksByStage(store, { source: [], geometry: [runningTop, queuedBottom], tileEmit: [] });
    store.set(taskScrollTargetAtom, {
      stageId: 'geometry',
      taskId: 'a-running-target',
      requestedAt: 1,
    });
    store.set(taskViewportRangeAtom, {
      stageId: 'geometry',
      startTaskId: 'a-running-target',
      endTaskId: 'a-running-target',
      startIndex: 0,
      endIndex: 0,
      total: 2,
      updatedAt: 1,
    });

    const view = renderPanel(store);

    const local = within(view.container);
    await local.findByText('Build Session');

    await waitFor(() => {
      expect(local.queryByRole('button', { name: 'Scroll up to running or queued task' })).toBeNull();
      expect(local.queryByRole('button', { name: 'Scroll down to running or queued task' })).toBeNull();
    });
  });
});
