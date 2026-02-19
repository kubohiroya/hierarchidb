import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { useShapeBuildProgressSummaryComputation as useShapeBuildProgressSummary } from '~/ui/components/build-progress/shapeBuildProgressSummaryComputation';

const stages: BuildStage[] = [
  { id: 'fetch', title: 'Fetch', icon: null },
];

const normalizeStageKey = (task: ShapeBuildTaskSummary): TaskStage => task.stage as TaskStage;

describe('useShapeBuildProgressSummary', () => {
  it('excludes recycled tasks from progress totals and avoids divide-by-zero', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-recycled',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'recycled',
        progress: 100,
      } as ShapeBuildTaskSummary,
    ];

    const { result } = renderHook(() => useShapeBuildProgressSummary({
      stages,
      resolvedTaskType: undefined,
      overallProgress: 0,
      buildStatus: 'running',
      effectiveProgress: null,
      effectiveStatus: null,
      taskType: undefined,
      tasks,
      normalizeStageKey,
      isSkippedTask: () => false,
      timingStageMs: 0,
    }));

    expect(result.current.displayCounts.total).toBe(0);
    expect(result.current.displayCounts.completed).toBe(0);
    expect(result.current.displayCounts.percentage).toBe(0);
  });

  it('groups tasks by canonical stage even when legacy taskType is stale', () => {
    const multiStages: BuildStage[] = [
      { id: 'fetch', title: 'Fetch', icon: null },
      { id: 'transform', title: 'Transform', icon: null },
      { id: 'vt', title: 'VT', icon: null },
    ];
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-vt-running',
        nodeId: 'node-2',
        stage: 'vt',
        taskType: 'fetch',
        type: 'fetch',
        status: 'running',
        progress: 10,
      } as ShapeBuildTaskSummary,
    ];

    const { result } = renderHook(() => useShapeBuildProgressSummary({
      stages: multiStages,
      resolvedTaskType: 'vt',
      overallProgress: 10,
      buildStatus: 'running',
      effectiveProgress: null,
      effectiveStatus: null,
      taskType: 'vt',
      tasks,
      normalizeStageKey,
      isSkippedTask: () => false,
      timingStageMs: 0,
    }));

    expect(result.current.tasksByStage.vt).toHaveLength(1);
    expect(result.current.tasksByStage.fetch ?? []).toHaveLength(0);
  });

  it('keeps display stage on in-flight transform when vt is only planned', () => {
    const multiStages: BuildStage[] = [
      { id: 'fetch', title: 'Fetch', icon: null },
      { id: 'transform', title: 'Transform', icon: null },
      { id: 'vt', title: 'VT', icon: null },
    ];
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-fetch-completed',
        nodeId: 'node-3',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-transform-running',
        nodeId: 'node-3',
        stage: 'transform',
        taskType: 'transform',
        status: 'running',
        progress: 5,
      } as ShapeBuildTaskSummary,
    ];

    const { result } = renderHook(() => useShapeBuildProgressSummary({
      stages: multiStages,
      resolvedTaskType: 'fetch',
      overallProgress: 5,
      buildStatus: 'running',
      effectiveProgress: {
        total: 8,
        completed: 1,
        failed: 0,
        skipped: 0,
        percentage: 12,
        taskType: 'fetch',
        stageTotals: {
          fetch: { total: 2, completed: 1, failed: 0, skipped: 0 },
          transform: { total: 4, completed: 0, failed: 0, skipped: 0 },
          vt: { total: 2, completed: 0, failed: 0, skipped: 0 },
        },
      },
      effectiveStatus: { status: 'processing', progress: 12 },
      taskType: 'fetch',
      tasks,
      normalizeStageKey,
      isSkippedTask: () => false,
      timingStageMs: 0,
    }));

    expect(result.current.displayStageId).toBe('transform');
  });
});
