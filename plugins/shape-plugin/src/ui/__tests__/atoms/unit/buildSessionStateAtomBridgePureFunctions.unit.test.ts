/**
 * Pure function unit tests for useShapeBuildSessionStateAtomBridge
 *
 * Covers: isTaskUpdateVersionAfterSnapshot, resolveTaskVersionAction,
 *         resolveTaskIdentityAction, resolveSnapshotTargetStages
 */

import { describe, expect, it } from 'vitest';
import type { StageSnapshotUpdatedEvent } from '../../../../common/types/session-events';
import {
    isTaskUpdateVersionAfterSnapshot,
    resolveTaskVersionAction,
    resolveTaskIdentityAction,
    resolveSnapshotTargetStages,
} from '../../../components/build-progress/useShapeBuildSessionStateAtomBridge';

// ---------------------------------------------------------------------------
// isTaskUpdateVersionAfterSnapshot
// ---------------------------------------------------------------------------

describe('isTaskUpdateVersionAfterSnapshot', () => {
    it('returns true when taskVersion > snapshotVersionMax', () => {
        expect(isTaskUpdateVersionAfterSnapshot(5, 6)).toBe(true);
    });

    it('returns false when taskVersion === snapshotVersionMax', () => {
        expect(isTaskUpdateVersionAfterSnapshot(5, 5)).toBe(false);
    });

    it('returns false when taskVersion < snapshotVersionMax', () => {
        expect(isTaskUpdateVersionAfterSnapshot(5, 4)).toBe(false);
    });

    it('handles version 0 boundary', () => {
        expect(isTaskUpdateVersionAfterSnapshot(0, 1)).toBe(true);
        expect(isTaskUpdateVersionAfterSnapshot(0, 0)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// resolveTaskVersionAction
// ---------------------------------------------------------------------------

describe('resolveTaskVersionAction', () => {
    it('returns "accept" when lastAppliedVersion is undefined (first time)', () => {
        expect(resolveTaskVersionAction(undefined, 1)).toBe('accept');
    });

    it('returns "accept" when nextVersion > lastAppliedVersion', () => {
        expect(resolveTaskVersionAction(3, 4)).toBe('accept');
    });

    it('returns "drop" when nextVersion === lastAppliedVersion (duplicate)', () => {
        expect(resolveTaskVersionAction(5, 5)).toBe('drop');
    });

    it('returns "error" when nextVersion < lastAppliedVersion (regression)', () => {
        expect(resolveTaskVersionAction(10, 9)).toBe('error');
    });

    it('returns "error" for large regression', () => {
        expect(resolveTaskVersionAction(100, 1)).toBe('error');
    });
});

// ---------------------------------------------------------------------------
// resolveTaskIdentityAction
// ---------------------------------------------------------------------------

describe('resolveTaskIdentityAction', () => {
    it('returns "accept-known" for known task with version after snapshot', () => {
        // snapshotVersionMax=5, taskVersion=6 → after snapshot; known task
        expect(resolveTaskIdentityAction(true, 5, 6)).toBe('accept-known');
    });

    it('returns "accept-new" for unknown task with version after snapshot', () => {
        expect(resolveTaskIdentityAction(false, 5, 6)).toBe('accept-new');
    });

    it('returns "drop-known-stale" for known task with version at or before snapshot', () => {
        // taskVersion=5 is NOT after snapshotVersionMax=5 (requires strictly greater)
        expect(resolveTaskIdentityAction(true, 5, 5)).toBe('drop-known-stale');
        expect(resolveTaskIdentityAction(true, 5, 4)).toBe('drop-known-stale');
    });

    it('returns "error-unknown-stale" for unknown task with version at or before snapshot', () => {
        expect(resolveTaskIdentityAction(false, 5, 5)).toBe('error-unknown-stale');
        expect(resolveTaskIdentityAction(false, 5, 3)).toBe('error-unknown-stale');
    });
});

// ---------------------------------------------------------------------------
// resolveSnapshotTargetStages
// ---------------------------------------------------------------------------

const makeSnapshot = (
    stageId: string,
    tasks: StageSnapshotUpdatedEvent['payload']['tasks'] = [],
    overrides: Partial<StageSnapshotUpdatedEvent['payload']> = {},
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
