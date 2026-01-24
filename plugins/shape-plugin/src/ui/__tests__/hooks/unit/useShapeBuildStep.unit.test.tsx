import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShapeBuildStep } from '../../../components/step5/useShapeBuildStep.ts';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';

let tasksMock: ShapeBuildTaskSummary[] = [];
let isLoadingMock = false;

vi.mock('../../../components/step5/useShapeBuildTasks.ts', () => ({
  useShapeBuildTasks: () => ({
    tasks: tasksMock,
    isLoading: isLoadingMock,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../components/step5/useBuildProgress.ts', () => ({
  useBuildProgress: () => ({
    progress: null,
    status: null,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

vi.mock('../../../components/step5/useBuildStages.tsx', () => ({
  useBuildStages: () => ([
    { id: 'fetch', title: 'Fetch', description: '', icon: null },
    { id: 'transform', title: 'Transform', description: '', icon: null },
    { id: 'vt', title: 'VT', description: '', icon: null },
  ]),
}));

vi.mock('../../../components/step5/useBatchSessionActions.ts', () => ({
  useBatchSessionActions: () => ({
    canStartOrResume: false,
    handleStartOrResume: vi.fn(),
    handlePause: vi.fn(),
    authDialogOpen: false,
    closeAuthDialog: vi.fn(),
    handleProviderSelect: vi.fn(),
  }),
}));

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
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
