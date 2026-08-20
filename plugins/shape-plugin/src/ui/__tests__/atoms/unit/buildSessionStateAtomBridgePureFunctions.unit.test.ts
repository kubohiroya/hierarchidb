/**
 * Pure function unit tests for useShapeBuildSessionStateAtomBridge
 *
 * Covers: resolveSnapshotTargetStages
 */

import { describe, expect, it } from 'vitest';
import type { StageSnapshotUpdatedEvent } from '../../../../common/types/session-events';
import { resolveSnapshotTargetStages } from '../../../hooks/useShapeBuildSessionStateAtomBridge';

// ---------------------------------------------------------------------------
// resolveSnapshotTargetStages
// ---------------------------------------------------------------------------

const makeSnapshot = (
  stageId: string,
  tasks: StageSnapshotUpdatedEvent['payload']['tasks'] = [],
  overrides: Partial<StageSnapshotUpdatedEvent['payload']> = {}
): StageSnapshotUpdatedEvent => ({
  type: 'stageSnapshotUpdated',
  payload: {
    stageId,
    tasks,
    stageStartedAt: 1,
    stageInactiveMs: 0,
    ...overrides,
  },
});

describe('resolveSnapshotTargetStages', () => {
  it('extracts stages from tasks when tasks are present', () => {
    const event = makeSnapshot('source', [
      { taskId: 't1', version: 1, stage: 'source', status: 'queued', progress: 0 },
      { taskId: 't2', version: 1, stage: 'geometry', status: 'queued', progress: 0 },
    ]);
    const stages = resolveSnapshotTargetStages(event);
    expect(stages).toContain('source');
    expect(stages).toContain('geometry');
    expect(stages).not.toContain('tileEmit');
  });

  it('deduplicates stages from multiple tasks in same stage', () => {
    const event = makeSnapshot('source', [
      { taskId: 't1', version: 1, stage: 'source', status: 'queued', progress: 0 },
      { taskId: 't2', version: 2, stage: 'source', status: 'running', progress: 50 },
    ]);
    const stages = resolveSnapshotTargetStages(event);
    expect(stages).toEqual(['source']);
  });

  it('falls back to event.payload.stageId when tasks are empty and stageId is valid', () => {
    const event = makeSnapshot('geometry', []);
    const stages = resolveSnapshotTargetStages(event);
    expect(stages).toEqual(['geometry']);
  });

  it('falls back to all three stages when tasks are empty and stageId is unknown', () => {
    const event = makeSnapshot('unknown-stage', []);
    const stages = resolveSnapshotTargetStages(event);
    expect(stages).toContain('source');
    expect(stages).toContain('geometry');
    expect(stages).toContain('tileEmit');
    expect(stages).toHaveLength(3);
  });

  it('ignores unknown stage values in tasks and falls back to all stages', () => {
    const event = makeSnapshot('unknown-stage', [
      { taskId: 't1', version: 1, stage: 'unknown-stage', status: 'queued', progress: 0 },
    ]);
    // unknown stage is filtered out → snapshotStages empty → stageId also unknown → all 3
    const stages = resolveSnapshotTargetStages(event);
    expect(stages).toHaveLength(3);
  });

  it('includes tileEmit stage from tasks', () => {
    const event = makeSnapshot('tileEmit', [
      { taskId: 't1', version: 1, stage: 'tileEmit', status: 'running', progress: 10 },
    ]);
    const stages = resolveSnapshotTargetStages(event);
    expect(stages).toEqual(['tileEmit']);
  });
});
