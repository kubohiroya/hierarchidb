import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';
import { useShapeBuildProgressSummary } from '../../../components/build-progress/useShapeBuildProgressSummary.ts';

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
});
