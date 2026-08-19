import type { NodeId } from '@hierarchidb/core-types';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore, type Store } from 'jotai/vanilla';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchBuildSessionEventAtom } from '../../../atoms/buildSessionStateAtoms';
import {
  taskScrollTargetAtom,
  taskViewportRangeByStageAtom,
} from '../../../atoms/shapeBuildProgressAtomConstants';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressTypes';
import { useShapeBuildSession } from '../../../components/build-progress/internal/useShapeBuildSessionLogic.impl';
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

const mockStages = [
  { id: 'source', title: 'Source', description: '', icon: null },
  { id: 'geometry', title: 'Geometry', description: '', icon: null },
  { id: 'tileEmit', title: 'TileEmit', description: '', icon: null },
];

// Only stub the hooks/functions that would cause side-effects or heavy loading.
// The actual BuildSessionProgressPanel and BuildProgressPanel are used as-is
// so that Skeleton, task list, and scroll buttons render correctly.
vi.mock('@hierarchidb/ui-build-progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/ui-build-progress')>();
  return {
    ...actual,
    useBuildProgressStages: () => mockStages,
    resolveBuildStages: () => mockStages,
    BuildSessionLauncherPanel: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    resolveBuildSessionProgressPanelSplitViewProps: () => ({}),
  };
});

let taskVersionCounter = 1;
const TEST_SESSION_STARTED_AT = 1_000;
const TEST_SESSION_COMPLETED_AT = 2_000;
type TestStageId = 'source' | 'geometry' | 'tileEmit';
type TestStageTiming = {
  stageStartedAt: number;
  stageInactiveMs: number;
  stageCompletedAt?: number;
};

const nextTaskVersion = () => {
  taskVersionCounter += 1;
  return taskVersionCounter;
};

const setTasksByStage = (
  store: Store,
  tasksByStage: Partial<Record<TestStageId, ShapeBuildTaskSummary[]>>,
  timingByStage: Partial<Record<TestStageId, TestStageTiming>> = {}
) => {
  const stageEntries = Object.entries(tasksByStage) as Array<
    [TestStageId, ShapeBuildTaskSummary[] | undefined]
  >;
  for (const [stageId, stageTasks] of stageEntries) {
    if (!stageTasks) {
      throw new Error(`Test fixture requires an explicit task snapshot for stage ${stageId}.`);
    }
    const version = nextTaskVersion();
    const timing = timingByStage[stageId] ?? {
      stageStartedAt: TEST_SESSION_STARTED_AT + version,
      stageInactiveMs: 0,
    };
    store.set(dispatchBuildSessionEventAtom, {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId,
        tasks: stageTasks.map((task, index) => ({
          ...task,
          stage: stageId,
          version: task.version ?? version + index,
          sequence: task.sequence ?? index,
        })),
        stageStartedAt: timing.stageStartedAt,
        stageInactiveMs: timing.stageInactiveMs,
        stageCompletedAt: timing.stageCompletedAt,
      },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'uiSyncPhaseChanged',
      payload: {
        stageId,
        phase: 'running',
      },
    });
  }
};

const setSessionPhase = (
  store: Store,
  phase:
    | 'idle'
    | 'starting'
    | 'running'
    | 'pausing'
    | 'paused'
    | 'resuming'
    | 'finalizing'
    | 'completed'
    | 'failed',
  stageId?: TestStageId
) => {
  const isActive =
    phase === 'starting' ||
    phase === 'running' ||
    phase === 'pausing' ||
    phase === 'resuming' ||
    phase === 'finalizing';
  const hasStarted = phase !== 'idle' && phase !== 'starting';
  const isTerminal = phase === 'completed' || phase === 'failed';
  store.set(dispatchBuildSessionEventAtom, {
    type: 'sessionStatusUpdated',
    payload: {
      nodeId: 'test-node',
      phase,
      isActive,
      ...(hasStarted
        ? {
            startedAt: TEST_SESSION_STARTED_AT,
            inactiveMs: 0,
          }
        : {}),
      ...(isTerminal ? { completedAt: TEST_SESSION_COMPLETED_AT } : {}),
    },
  });
  if (stageId !== undefined) {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'viewSelectionChanged',
      payload: { activeStageId: stageId },
    });
  }
};

const makeStore = () => {
  const store = createStore();
  setSessionPhase(store, 'idle');
  return store;
};

const renderPanel = (store: Store) =>
  render(
    <Provider store={store}>
      <ShapeBuildProgressPanel data={{}} nodeId={'node-1' as NodeId} />
    </Provider>
  );

const SessionElapsedProbe = () => {
  const session = useShapeBuildSession({ data: {}, nodeId: 'node-1' as NodeId });
  return <span data-testid="stage-elapsed-ms">{session.stageElapsedMs}</span>;
};

const renderSessionElapsedProbe = (store: Store) =>
  render(
    <Provider store={store}>
      <SessionElapsedProbe />
    </Provider>
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
      metadata: {
        preview: {
          sourceCountryCode: 'JP',
          sourceCountryName: 'Japan',
          adminLevel: 0,
          bandIndex: 0,
          bandMinZoom: 1,
          bandMaxZoom: 2,
        },
      },
    } as ShapeBuildTaskSummary;
    setTasksByStage(
      store,
      { geometry: [failedTask] },
      {
        geometry: {
          stageStartedAt: TEST_SESSION_STARTED_AT,
          stageInactiveMs: 0,
          stageCompletedAt: TEST_SESSION_COMPLETED_AT,
        },
      }
    );
    setSessionPhase(store, 'failed', 'geometry');

    const view = renderPanel(store);

    await within(view.container).findByRole('group', { name: 'Build control buttons' });
    await waitFor(() => {
      expect(document.body.textContent).toContain('Start Build');
    });
  });

  it('shows task skeleton while awaiting first snapshot in running state', async () => {
    const store = makeStore();
    setSessionPhase(store, 'running', 'source');

    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Build control buttons' })).toBeTruthy();
    });

    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('No tasks yet.')).toBeNull();
  });

  it('calculates elapsed time from the authoritative stage snapshot timing', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const store = makeStore();
    setSessionPhase(store, 'running', 'source');
    setTasksByStage(
      store,
      { source: [] },
      {
        source: {
          stageStartedAt: 4_000,
          stageInactiveMs: 1_000,
        },
      }
    );

    renderSessionElapsedProbe(store);

    await waitFor(() => {
      expect(screen.getByTestId('stage-elapsed-ms').textContent).toBe('5000');
    });
  });

  it('does not show task skeleton while idle before start is requested', async () => {
    const store = makeStore();
    setSessionPhase(store, 'idle');

    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Build control buttons' })).toBeTruthy();
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
    setSessionPhase(store, 'running', 'source');
    setTasksByStage(store, { source: [runningTask, queuedTask] });
    store.set(taskViewportRangeByStageAtom, {
      source: {
        stageId: 'source',
        startTaskId: 'task-running-0',
        endTaskId: 'task-running-0',
        startIndex: 0,
        endIndex: 0,
        total: 2,
      },
    });

    const view = renderPanel(store);

    const local = within(view.container);
    await local.findByRole('group', { name: 'Build control buttons' });
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
      metadata: {
        preview: {
          sourceCountryCode: 'JP',
          sourceCountryName: 'Japan',
          adminLevel: 0,
          bandIndex: 0,
          bandMinZoom: 1,
          bandMaxZoom: 2,
        },
      },
    } as ShapeBuildTaskSummary;
    const queuedBottom: ShapeBuildTaskSummary = {
      taskId: 'z-queued-next',
      nodeId: 'node-1',
      stage: 'geometry',
      taskType: 'geometry',
      status: 'queued',
      progress: 0,
      message: 'Queued',
      metadata: {
        preview: {
          sourceCountryCode: 'JP',
          sourceCountryName: 'Japan',
          adminLevel: 0,
          bandIndex: 0,
          bandMinZoom: 1,
          bandMaxZoom: 2,
        },
      },
    } as ShapeBuildTaskSummary;
    setSessionPhase(store, 'running', 'geometry');
    setTasksByStage(store, { geometry: [runningTop, queuedBottom] });
    store.set(taskScrollTargetAtom, {
      stageId: 'geometry',
      taskId: 'a-running-target',
      requestedAt: 1,
    });
    store.set(taskViewportRangeByStageAtom, {
      geometry: {
        stageId: 'geometry',
        startTaskId: 'a-running-target',
        endTaskId: 'a-running-target',
        startIndex: 0,
        endIndex: 0,
        total: 2,
      },
    });

    const view = renderPanel(store);

    const local = within(view.container);
    await local.findByRole('group', { name: 'Build control buttons' });

    await waitFor(() => {
      expect(
        local.queryByRole('button', { name: 'Scroll up to running or queued task' })
      ).toBeNull();
      expect(
        local.queryByRole('button', { name: 'Scroll down to running or queued task' })
      ).toBeNull();
    });
  });
});
