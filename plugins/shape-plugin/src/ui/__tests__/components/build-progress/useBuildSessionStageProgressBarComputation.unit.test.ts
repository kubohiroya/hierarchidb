import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import { describe, expect, it } from 'vitest';
import {
  buildTaskProgressSegments,
  resolveViewportIndices,
  type TaskProgressComputeInput,
  type TaskProgressVisibilityFilter,
} from '../../../components/build-progress/ShapeBuildProgressPanel/BuildSessionStageProgressBar/useBuildSessionStageProgressBarComputation';
import type { TaskItemWithMetadata } from '../../../components/build-progress/taskItemCardList/types';

const stages: BuildStage[] = [
  { id: 'source', title: 'Source', icon: null },
  { id: 'geometry', title: 'Geometry', icon: null },
];

const makeTask = (
  taskId: string,
  stage: TaskItemWithMetadata['stage'],
  status: TaskItemWithMetadata['status'],
  skipped = false
): TaskItemWithMetadata => ({
  taskId,
  version: 1,
  stage,
  status,
  progress: status === 'completed' || status === 'recycled' ? 100 : 0,
  ...(skipped ? { display: { kind: 'skip' } } : {}),
});

const tasksByStage: Record<string, TaskItemWithMetadata[]> = {
  source: [
    makeTask('queued', 'source', 'queued'),
    makeTask('running', 'source', 'running'),
    makeTask('paused', 'source', 'paused'),
    makeTask('failed', 'source', 'failed'),
    makeTask('skipped', 'source', 'completed', true),
    makeTask('completed', 'source', 'completed'),
    makeTask('recycled', 'source', 'recycled'),
  ],
  geometry: [
    makeTask('geometry-failed', 'geometry', 'failed'),
    makeTask('geometry-completed', 'geometry', 'completed'),
  ],
};

const colors = {
  waitingColor: 'waiting',
  successColor: 'success',
  failedColor: 'failed',
  runningColor: 'running',
  pausedColor: 'paused',
  skippedColor: 'skipped',
};

const buildSegments = (filter: TaskProgressVisibilityFilter) =>
  buildTaskProgressSegments({
    stages,
    tasksByStage,
    stageTotals: {
      source: { total: 8 },
      geometry: { total: 3 },
    },
    buildStatus: 'running',
    resolveTaskTitle: (task) => task.taskId,
    filter,
    ...colors,
  } satisfies TaskProgressComputeInput);

const taskIds = (filter: TaskProgressVisibilityFilter) =>
  buildSegments(filter).segments.flatMap((segment) => (segment.taskId ? [segment.taskId] : []));

describe('buildTaskProgressSegments task visibility', () => {
  it('includes only failed tasks for failedMode', () => {
    expect(taskIds({ failedMode: true, skippedMode: false, completedMode: false })).toEqual([
      'failed',
      'geometry-failed',
    ]);
  });

  it('includes only skipped tasks for skippedMode', () => {
    expect(taskIds({ failedMode: false, skippedMode: true, completedMode: false })).toEqual([
      'skipped',
    ]);
  });

  it('includes completed and recycled tasks but excludes skipped completed tasks for completedMode', () => {
    expect(taskIds({ failedMode: false, skippedMode: false, completedMode: true })).toEqual([
      'completed',
      'recycled',
      'geometry-completed',
    ]);
  });

  it('combines active filters with OR semantics', () => {
    expect(taskIds({ failedMode: true, skippedMode: false, completedMode: true })).toEqual([
      'failed',
      'completed',
      'recycled',
      'geometry-completed',
      'geometry-failed',
    ]);
  });

  it('shows every task and planned waiting slots when all filters are off', () => {
    const result = buildSegments({ failedMode: false, skippedMode: false, completedMode: false });

    expect(taskIds({ failedMode: false, skippedMode: false, completedMode: false })).toEqual([
      'queued',
      'running',
      'paused',
      'failed',
      'skipped',
      'completed',
      'recycled',
      'geometry-completed',
      'geometry-failed',
    ]);
    expect(result.segments.filter((segment) => segment.taskId === undefined)).toEqual([
      expect.objectContaining({ stageId: 'source', width: 1 }),
      expect.objectContaining({ stageId: 'geometry', width: 1 }),
    ]);
    expect(result.stageCounts).toEqual(
      new Map([
        ['source', 8],
        ['geometry', 3],
      ])
    );
    expect(result.stageOffsets).toEqual(
      new Map([
        ['source', 0],
        ['geometry', 8],
      ])
    );
    expect(result.viewWidth).toBe(11);
  });

  it('derives counts, offsets, and width from filtered segments', () => {
    const result = buildSegments({ failedMode: true, skippedMode: false, completedMode: false });

    expect(result.segments.every((segment) => segment.fillOpacity === 1)).toBe(true);
    expect(result.segments.every((segment) => segment.taskId !== undefined)).toBe(true);
    expect(result.stageCounts).toEqual(
      new Map([
        ['source', 1],
        ['geometry', 1],
      ])
    );
    expect(result.stageOffsets).toEqual(
      new Map([
        ['source', 0],
        ['geometry', 1],
      ])
    );
    expect(result.viewWidth).toBe(2);
  });
});

describe('resolveViewportIndices task visibility', () => {
  it('maps viewport task ids against the filtered task sequence', () => {
    const result = resolveViewportIndices(
      { stageId: 'source', startTaskId: 'failed', endTaskId: 'recycled' },
      tasksByStage,
      { failedMode: true, skippedMode: false, completedMode: true }
    );

    expect(result).toEqual({ viewportStartIndex: 0, viewportEndIndex: 2 });
  });

  it('does not map a viewport endpoint hidden by the active filter', () => {
    const result = resolveViewportIndices(
      { stageId: 'source', startTaskId: 'queued', endTaskId: 'failed' },
      tasksByStage,
      { failedMode: true, skippedMode: false, completedMode: false }
    );

    expect(result).toEqual({ viewportStartIndex: null, viewportEndIndex: null });
  });
});
