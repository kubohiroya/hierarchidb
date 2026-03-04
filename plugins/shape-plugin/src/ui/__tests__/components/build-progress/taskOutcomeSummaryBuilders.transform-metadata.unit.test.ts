import { describe, expect, it } from 'vitest';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms';
import { buildGeometryTaskOutcomeSummary } from '../../../components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';

const t = (_key: string, fallback?: string): string => fallback ?? _key;

const buildBaseTask = (overrides: Partial<ShapeBuildTaskSummary>): ShapeBuildTaskSummary => ({
  taskId: 'geometry-task-1',
  nodeId: 'node-1',
  stage: 'geometry',
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

describe('buildGeometryTaskOutcomeSummary metadata handoff', () => {
  it('uses effectiveTolerance and retry values from metadata for completed summary', () => {
    const task = buildBaseTask({
      metadata: {
        effectiveTolerance: 0.2,
        retryAttempt: 2,
        retryMax: 10,
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.summaryLine).toContain('Tol: 0.2');
    expect(summary.summaryLine).toContain('Attempt');
    expect(summary.summaryLine).toContain('2/10');
    expect(summary.detailLines.join(' ')).toContain('Effective Tolerance: 0.2');
  });

  it('accepts nested metadata.finalTolerance as effectiveTolerance fallback', () => {
    const task = buildBaseTask({
      metadata: {
        metadata: {
          finalTolerance: 0.9,
          retryMax: 10,
        },
        retryAttempt: 0,
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.summaryLine).toContain('Tol: 0.9');
  });

  it('keeps failed summary carrying final effectiveTolerance and retryAttempt', () => {
    const task = buildBaseTask({
      status: 'failed',
      errorMessage: 'geometry failed: simplify',
      metadata: {
        finalEffectiveTolerance: 0.35,
        retryAttempt: 6,
        retryMax: 10,
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('failed');
    expect(summary.summaryLine).toContain('Tol: 0.35');
    expect(summary.summaryLine).toContain('6/10');
    expect(summary.detailLines.join(' ')).toContain('Failure Reason: geometry failed: simplify');
  });

  it('does not recover retryMax from message text', () => {
    const task = buildBaseTask({
      status: 'failed',
      errorMessage: 'geometry failed: max vertices (searchMaxIterations=10)',
      metadata: {
        retryAttempt: 1,
      },
    });

    expect(() => buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    })).toThrow('[shape-plugin] geometry retryMax is missing');
  });
});
