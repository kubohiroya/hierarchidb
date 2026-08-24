import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import { createStagedFolderActionRunRecord, updateStagedFolderActionRunRecord } from '../index.js';

describe('staged folder action progress record', () => {
  it('uses a generic running-action phase with action-specific progress data', () => {
    const record = createStagedFolderActionRunRecord({
      runId: 'run-1' as NodeId,
      sourceNodeId: 'source-1' as NodeId,
      now: 100,
    });

    const updated = updateStagedFolderActionRunRecord(record, {
      status: 'running',
      phase: 'running-action',
      currentAction: {
        actionIndex: 0,
        actionType: 'build',
        phase: 'queue-started',
        percentage: 25,
      },
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 25,
      },
      updatedAt: 120,
    });

    expect(updated.phase).toBe('running-action');
    expect(updated.currentAction).toMatchObject({
      actionType: 'build',
      phase: 'queue-started',
    });
    expect(updated.revision).toBe(1);
  });

  it('rejects invalid progress percentages instead of clamping', () => {
    const record = createStagedFolderActionRunRecord({
      runId: 'run-1' as NodeId,
      sourceNodeId: 'source-1' as NodeId,
      now: 100,
    });

    expect(() =>
      updateStagedFolderActionRunRecord(record, {
        phase: 'running-action',
        progress: {
          total: 1,
          completed: 0,
          failed: 0,
          skipped: 0,
          percentage: 101,
        },
        updatedAt: 120,
      })
    ).toThrow(/finite number in 0\.\.100/);
  });
});
