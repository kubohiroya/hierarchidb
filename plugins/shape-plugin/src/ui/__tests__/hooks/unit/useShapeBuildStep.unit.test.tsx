import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShapeBuildStep } from '../../../components/build-progress/useShapeBuildStep.ts';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';

let tasksMock: ShapeBuildTaskSummary[] = [];
let isLoadingMock = false;

vi.mock('../../../components/build-progress/useShapeBuildTasks.ts', () => ({
  useShapeBuildTasks: () => ({
    tasks: tasksMock,
    isLoading: isLoadingMock,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../components/build-progress/useBuildProgress.ts', () => ({
  useBuildProgress: () => ({
    progress: null,
    status: null,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

vi.mock('../../../components/build-progress/useShapeBuildStages.ts', () => ({
  useShapeBuildStages: () => ([
    { id: 'fetch', title: 'Fetch', icon: null },
    { id: 'transform', title: 'Transform', icon: null },
    { id: 'vt', title: 'VT Generation', icon: null },
  ]),
}));

vi.mock('../../../components/build-progress/useShapeBuildTiming.ts', () => ({
  useShapeBuildTiming: () => ({
    timingSnapshot: { stageId: null, stageMs: 0 },
    session: null,
  }),
}));

vi.mock('../../../components/build-progress/useShapeBuildProgressSummary.ts', () => ({
  useShapeBuildProgressSummary: () => ({
    taskSummary: {},
    aggregatedCounts: { total: 0, completed: 0, failed: 0, skipped: 0 },
    stageProgress: {},
    tasksByStage: {},
    paneProgress: [],
    displayStageId: undefined,
    displayCounts: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 },
    rawDisplayCounts: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 },
    hasProgressData: false,
    stageRemainingMs: null,
  }),
}));

vi.mock('../../../components/build-progress/useShapeBuildLabels.ts', () => ({
  useShapeBuildLabels: () => ({
    statusLabel: 'Ready to start stage',
    warningMessage: null,
    stageLabel: 'idle',
    taskLabel: 'Ready',
    taskUnitLabel: 'Tasks',
  }),
}));

vi.mock('../../../components/build-progress/useShapeBuildAutoResume.ts', () => ({
  useShapeBuildAutoResume: () => ({
    canStartOrResume: true,
    isStartPending: false,
    startOrResume: vi.fn(async () => undefined),
    clearStartPending: vi.fn(),
  }),
}));

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getWorkerBridge: () => ({
    initialize: vi.fn(),
    resumeBuildSession: vi.fn(),
    startBuildSession: vi.fn(),
    pauseBuildSession: vi.fn(),
  }),
}));

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  getWorkerClientHook: () => () => null,
}));

vi.mock('@hierarchidb/components/build-session', () => ({
  executePauseBuildFlow: vi.fn(async () => undefined),
  useBuildSessionTransition: () => ({
    buildSessionTransition: {
      active: false,
      phase: 'idle',
      startedAt: 0,
    },
    beginBuildSessionTransition: vi.fn(),
    advanceBuildSessionTransitionPhase: vi.fn(),
    finishBuildSessionTransition: vi.fn(),
    emitBuildSessionTransitionLog: vi.fn(),
    pushBuildSessionTransitionNotification: vi.fn(),
  }),
}));

vi.mock('@hierarchidb/components/notify', () => ({
  notify: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@hierarchidb/util', () => ({
  loadTreeConsoleSettings: () => ({ buildContinuationPolicy: 'finish_all_stages' }),
  DEFAULT_ZOOM_BAND_BOUNDARIES: [2, 3, 6],
  getDBName: (suffix: string) => `test-${suffix}`,
}));

vi.mock('@hierarchidb/ui-monitoring', () => ({
  appendBuildSample: vi.fn(),
  BUILD_MONITOR_SAMPLE_INTERVAL_MS: 1000,
  getBuildMonitorKey: () => 'mock',
  getMemorySnapshot: () => ({}),
  recordBuildFinish: vi.fn(),
  recordBuildStart: vi.fn(),
}));

describe('useShapeBuildStep', () => {
  beforeEach(() => {
    tasksMock = [];
    isLoadingMock = false;
  });

  it('uses processingStatus when runtime status is missing', () => {
    const { result } = renderHook(() => useShapeBuildStep({
      nodeId: 'node-1',
      data: { nodeId: 'node-1', processingStatus: 'processing' },
      onChange: vi.fn(),
    }));

    expect(result.current.buildStatus).toBe('running');
  });

  it('exposes tasks from the task subscription hook', () => {
    tasksMock = [
      { taskId: 'task-1', stage: 'fetch', status: 'queued', progress: 0 },
    ];

    const { result } = renderHook(() => useShapeBuildStep({
      nodeId: 'node-2',
      data: { nodeId: 'node-2', processingStatus: 'idle' },
      onChange: vi.fn(),
    }));

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]?.taskId).toBe('task-1');
  });
});
