import { describe, expect, it } from 'vitest';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms';
import { buildTransformTaskOutcomeSummary } from '../../../components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';

const t = (_key: string, fallback?: string): string => fallback ?? _key;

const buildBaseTask = (overrides: Partial<ShapeBuildTaskSummary>): ShapeBuildTaskSummary => ({
  taskId: 'transform-task-1',
  nodeId: 'node-1',
  stage: 'transform',
  status: 'completed',
  progress: 100,
  display: {
    kind: 'summary',
    metrics: {
      features: { input: 10, output: 10 },
      polygons: { input: 27, output: 27 },
      vertices: { input: 39550, output: 840 },
    },
  },
  metadata: {},
  ...overrides,
});

describe('buildTransformTaskOutcomeSummary metadata handoff', () => {
  it('uses effectiveTolerance and retryAttempt from metadata for completed summary', () => {
    const task = buildBaseTask({
      metadata: {
        effectiveTolerance: 0.2,
        retryAttempt: 2,
      },
    });

    const summary = buildTransformTaskOutcomeSummary({
      task,
      stageId: 'transform',
      taskTitle: 'transform-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.summaryLine).toContain('Tol 0.2');
    expect(summary.summaryLine).toContain('Retry 2/10');
    expect(summary.detailLines.join(' ')).toContain('Effective tolerance: 0.2');
  });

  it('accepts nested metadata.finalTolerance as effectiveTolerance fallback', () => {
    const task = buildBaseTask({
      metadata: {
        metadata: {
          finalTolerance: 0.9,
        },
      },
    });

    const summary = buildTransformTaskOutcomeSummary({
      task,
      stageId: 'transform',
      taskTitle: 'transform-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.summaryLine).toContain('Tol 0.9');
  });

  it('keeps failed summary carrying final effectiveTolerance and retryAttempt', () => {
    const task = buildBaseTask({
      status: 'failed',
      errorMessage: 'transform failed: simplify',
      metadata: {
        finalEffectiveTolerance: 0.35,
        retryAttempt: 6,
      },
    });

    const summary = buildTransformTaskOutcomeSummary({
      task,
      stageId: 'transform',
      taskTitle: 'transform-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('failed');
    expect(summary.summaryLine).toContain('Tol 0.35');
    expect(summary.summaryLine).toContain('Retry 6/10');
    expect(summary.detailLines.join(' ')).toContain('Failure: transform failed: simplify');
  });
});
