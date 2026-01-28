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

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getWorkerBridge: () => ({
    initialize: vi.fn(),
    resumeBatchSession: vi.fn(),
    startBatchSession: vi.fn(),
    pauseBatchSession: vi.fn(),
  }),
}));

vi.mock('@hierarchidb/ui-worker-provider', () => ({
  getWorkerClientHook: () => () => null,
}));

vi.mock('@hierarchidb/components', () => ({
  notify: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@hierarchidb/util', () => ({
  loadTreeConsoleSettings: () => ({ buildContinuationPolicy: 'finish_all_stages' }),
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
