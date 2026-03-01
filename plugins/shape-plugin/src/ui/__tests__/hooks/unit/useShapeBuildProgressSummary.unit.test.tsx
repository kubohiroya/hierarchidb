import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BuildStage } from '@hierarchidb/components';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms';
import { useShapeBuildProgressSummaryComputation as useShapeBuildProgressSummary } from '../../../components/build-progress/shapeBuildProgressSummaryComputation';

const stages: BuildStage[] = [
  { id: 'source', title: 'Source', icon: null },
];

describe('useShapeBuildProgressSummary', () => {
  it('excludes recycled tasks from progress totals and avoids divide-by-zero', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-recycled',
        nodeId: 'node-1',
        stage: 'source',
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
      stage: undefined,
      tasks,
      isSkippedTask: () => false,
      timingStageMs: 0,
    }));

    expect(result.current.displayCounts.total).toBe(0);
    expect(result.current.displayCounts.completed).toBe(0);
    expect(result.current.displayCounts.percentage).toBe(0);
  });

  it('groups tasks by stage only', () => {
    const multiStages: BuildStage[] = [
      { id: 'source', title: 'Source', icon: null },
      { id: 'geometry', title: 'Geometry', icon: null },
      { id: 'tileEmit', title: 'TileEmit', icon: null },
    ];
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-tileEmit-running',
        nodeId: 'node-2',
        stage: 'tileEmit',
        status: 'running',
        progress: 10,
      } as ShapeBuildTaskSummary,
    ];

    const { result } = renderHook(() => useShapeBuildProgressSummary({
      stages: multiStages,
      resolvedTaskType: 'tileEmit',
      overallProgress: 10,
      buildStatus: 'running',
      effectiveProgress: null,
      effectiveStatus: null,
      stage: 'tileEmit',
      tasks,
      isSkippedTask: () => false,
      timingStageMs: 0,
    }));

    expect(result.current.tasksByStage.tileEmit).toHaveLength(1);
    expect(result.current.tasksByStage.source ?? []).toHaveLength(0);
  });

  it('keeps display stage on in-flight geometry when tileEmit is only planned', () => {
    const multiStages: BuildStage[] = [
      { id: 'source', title: 'Source', icon: null },
      { id: 'geometry', title: 'Geometry', icon: null },
      { id: 'tileEmit', title: 'TileEmit', icon: null },
    ];
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-source-completed',
        nodeId: 'node-3',
        stage: 'source',
        status: 'completed',
        progress: 100,
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-geometry-running',
        nodeId: 'node-3',
        stage: 'geometry',
        status: 'running',
        progress: 5,
      } as ShapeBuildTaskSummary,
    ];

    const { result } = renderHook(() => useShapeBuildProgressSummary({
      stages: multiStages,
      resolvedTaskType: 'source',
      overallProgress: 5,
      buildStatus: 'running',
      effectiveProgress: {
        total: 8,
        completed: 1,
        failed: 0,
        skipped: 0,
        percentage: 12,
        stage: 'source',
        stageTotals: {
          source: { total: 2, completed: 1, failed: 0, skipped: 0 },
          geometry: { total: 4, completed: 0, failed: 0, skipped: 0 },
          tileEmit: { total: 2, completed: 0, failed: 0, skipped: 0 },
        },
      },
      effectiveStatus: { status: 'processing', progress: 12 },
      stage: 'source',
      tasks,
      isSkippedTask: () => false,
      timingStageMs: 0,
    }));

    expect(result.current.displayStageId).toBe('geometry');
  });

  it('uses task-level progress while running even if no completion counts exist yet', () => {
    const multiStages: BuildStage[] = [
      { id: 'source', title: 'Source', icon: null },
      { id: 'geometry', title: 'Geometry', icon: null },
      { id: 'tileEmit', title: 'TileEmit', icon: null },
    ];
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-source-running-1',
        nodeId: 'node-4',
        stage: 'source',
        status: 'running',
        progress: 20,
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-source-running-2',
        nodeId: 'node-4',
        stage: 'source',
        status: 'running',
        progress: 40,
      } as ShapeBuildTaskSummary,
    ];

    const { result } = renderHook(() => useShapeBuildProgressSummary({
      stages: multiStages,
      resolvedTaskType: 'source',
      overallProgress: 20,
      buildStatus: 'running',
      effectiveProgress: {
        total: 2,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
        stage: 'source',
        stageTotals: {
          source: { total: 2, completed: 0, failed: 0, skipped: 0 },
          geometry: { total: 0, completed: 0, failed: 0, skipped: 0 },
          tileEmit: { total: 0, completed: 0, failed: 0, skipped: 0 },
        },
      },
      effectiveStatus: { status: 'processing', progress: 0 },
      stage: 'source',
      tasks,
      isSkippedTask: () => false,
      timingStageMs: 0,
    }));

    expect(result.current.paneProgress[0]?.progress).toBe(30);
    expect(result.current.displayCounts.total).toBe(2);
    expect(result.current.displayCounts.percentage).toBe(30);
  });
});
