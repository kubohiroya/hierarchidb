import { describe, expect, it } from 'vitest';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressTypes';
import {
  buildTileEmitTaskOutcomeSummary,
  isTileEmitWarningResult,
} from '../../../components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';

const translate = (_key: string, fallback?: string): string => fallback ?? _key;

const warningTask = (metadata: Record<string, unknown>): ShapeBuildTaskSummary => ({
  taskId: 'tile-emit-1',
  stage: 'tileEmit',
  status: 'completed',
  progress: 100,
  metadata: {
    resultSeverity: 'warning',
    invalidPolygonFilteredCount: 2,
    invalidPolygonCheckedCount: 8,
    invalidPolygonFilteredRate: 0.25,
    affectedFeatureCount: 1,
    featureErrorCountTotal: 3,
    ...metadata,
  },
});

describe('tileEmit warning outcome summary', () => {
  it('renders explicit warning metrics without inferring severity from the message', () => {
    const task = warningTask({});
    const summary = buildTileEmitTaskOutcomeSummary({
      task,
      stageId: 'tileEmit',
      taskTitle: 'tile-emit-1',
      translate,
    });

    expect(isTileEmitWarningResult(task)).toBe(true);
    expect(summary.kind).toBe('completed');
    expect(summary.summaryLine).toBe('Warning: Filtered polygons 2/8 (25%)');
    expect(summary.detailLines).toEqual([
      'Filtered polygons: 2',
      'Checked polygons: 8',
      'Filtered rate: 25%',
      'Affected features: 1',
      'Feature errors: 3',
    ]);
  });

  it('rejects incomplete warning metadata', () => {
    const task = warningTask({ invalidPolygonFilteredRate: undefined });
    expect(() =>
      buildTileEmitTaskOutcomeSummary({
        task,
        stageId: 'tileEmit',
        taskTitle: 'tile-emit-1',
        translate,
      })
    ).toThrow('invalidPolygonFilteredRate');
  });

  it('rejects warning severity on a non-completed task', () => {
    expect(() =>
      isTileEmitWarningResult({
        ...warningTask({}),
        status: 'failed',
      })
    ).toThrow('must have completed status');
  });
});
