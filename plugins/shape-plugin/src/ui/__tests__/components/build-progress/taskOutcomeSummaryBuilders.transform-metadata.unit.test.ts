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

  it('prioritizes finalRetryAttempts over interim retryAttempt', () => {
    const task = buildBaseTask({
      metadata: {
        retryAttempt: 0,
        finalRetryAttempts: 3,
        retryMax: 24,
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.retryAttempt).toBe(3);
    expect(summary.summaryLine).toContain('3/24');
  });

  it('prefers fetchDetail.polygons over polygonsPerFeature for source metrics', () => {
    const task = buildBaseTask({
      metadata: {
        retryAttempt: 1,
        retryMax: 24,
        fetchDetail: {
          features: { input: 1, output: 1 },
          polygons: { input: 1952, output: 27 },
          polygonsPerFeature: { input: 27, output: 27 },
        },
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.sourceMetrics?.features.input).toBe(1);
    expect(summary.sourceMetrics?.features.output).toBe(1);
    expect(summary.sourceMetrics?.polygons.input).toBe(1952);
    expect(summary.sourceMetrics?.polygons.output).toBe(27);
  });

  it('carries adminLevel from metadata to geometry summary', () => {
    const task = buildBaseTask({
      metadata: {
        retryAttempt: 1,
        retryMax: 24,
        fetchDetail: {
          adminLevel: 2,
          features: { input: 1, output: 1 },
          polygons: { input: 1952, output: 27 },
        },
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.adminLevel).toBe(2);
  });

  it('falls back to preview.adminLevel when fetchDetail is absent', () => {
    const task = buildBaseTask({
      metadata: {
        retryAttempt: 1,
        retryMax: 24,
        preview: {
          adminLevel: 3,
        },
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.adminLevel).toBe(3);
  });

  it('uses retryAttemptsTotal from message when retryAttempt metadata stays 0', () => {
    const task = buildBaseTask({
      errorMessage: 'geometry completed: retryAttemptsTotal=4, retriedFeatures=1/1',
      metadata: {
        retryAttempt: 0,
        retryMax: 24,
      },
    });

    const summary = buildGeometryTaskOutcomeSummary({
      task,
      stageId: 'geometry',
      taskTitle: 'geometry-task-1',
      translate: t,
    });

    expect(summary.kind).toBe('completed');
    expect(summary.retryAttempt).toBe(4);
    expect(summary.summaryLine).toContain('4/24');
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
