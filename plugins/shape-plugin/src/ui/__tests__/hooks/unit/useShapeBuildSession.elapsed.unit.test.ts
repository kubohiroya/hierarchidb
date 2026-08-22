import { describe, expect, it } from 'vitest';
import {
  buildElapsedByStageWithActiveStage,
  resolveSessionElapsedMs,
  resolveStageElapsedMs,
  resolveTotalElapsedMs,
} from '../../../components/build-progress/internal/useShapeBuildSessionHelpers/elapsedConstants';
import {
  resolveDisplayBuildStatus,
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
  shouldRefreshTasksSnapshot,
  shouldResetElapsedState,
} from '../../../components/build-progress/internal/useShapeBuildSessionLogic';

describe('shouldResetElapsedState', () => {
  it('returns false while build is running', () => {
    expect(
      shouldResetElapsedState({
        buildStatus: 'running',
        buildDurationMs: 0,
        sessionStageDurationByStage: {},
        localStageDurationByStage: {},
      })
    ).toBe(false);
  });

  it('returns true when both persisted and local elapsed are empty', () => {
    expect(
      shouldResetElapsedState({
        buildStatus: 'idle',
        buildDurationMs: 0,
        sessionStageDurationByStage: {},
        localStageDurationByStage: {},
      })
    ).toBe(true);
  });

  it('returns false when local elapsed snapshot exists', () => {
    expect(
      shouldResetElapsedState({
        buildStatus: 'idle',
        buildDurationMs: 0,
        sessionStageDurationByStage: {},
        localStageDurationByStage: {
          source: 2_000,
        },
      })
    ).toBe(false);
  });

  it('returns false when persisted elapsed exists', () => {
    expect(
      shouldResetElapsedState({
        buildStatus: 'completed',
        buildDurationMs: 0,
        sessionStageDurationByStage: {
          tileEmit: 1_000,
        },
        localStageDurationByStage: {},
      })
    ).toBe(false);
  });

  it('returns false when total elapsed exists', () => {
    expect(
      shouldResetElapsedState({
        buildStatus: 'failed',
        buildDurationMs: 5_000,
        sessionStageDurationByStage: {},
        localStageDurationByStage: {},
      })
    ).toBe(false);
  });

  it('rejects an invalid persisted total duration', () => {
    expect(() =>
      shouldResetElapsedState({
        buildStatus: 'completed',
        buildDurationMs: -1,
        sessionStageDurationByStage: {},
        localStageDurationByStage: {},
      })
    ).toThrowError('buildDurationMs must be a finite non-negative number');
  });
});

describe('resolveDisplayBuildStatus', () => {
  it('keeps running while base status is running even when current tasks are completed', () => {
    expect(
      resolveDisplayBuildStatus({
        baseBuildStatus: 'running',
        tasksCompletionStatus: 'completed',
        hasInFlightTasks: false,
      })
    ).toBe('running');
  });

  it('promotes to completed when base status is idle and tasks are completed', () => {
    expect(
      resolveDisplayBuildStatus({
        baseBuildStatus: 'idle',
        tasksCompletionStatus: 'completed',
        hasInFlightTasks: false,
      })
    ).toBe('completed');
  });
});

describe('shouldRefreshTasksSnapshot', () => {
  it('returns true when running but visible tasks are stale completed-only entries', () => {
    expect(
      shouldRefreshTasksSnapshot({
        displayTaskCount: 2,
        hasInFlightTasks: false,
        hasProgressTaskSignal: false,
        buildStatus: 'running',
        runtimeStatus: 'running',
        processingStatus: 'running',
        buildSessionTransitionActive: false,
      })
    ).toBe(true);
  });

  it('returns false when tasks are already running in UI', () => {
    expect(
      shouldRefreshTasksSnapshot({
        displayTaskCount: 2,
        hasInFlightTasks: true,
        hasProgressTaskSignal: true,
        buildStatus: 'running',
        runtimeStatus: 'running',
        processingStatus: 'running',
        buildSessionTransitionActive: false,
      })
    ).toBe(false);
  });
});

describe('resolveMostAdvancedRunningStageId', () => {
  it('prefers tileEmit when geometry and tileEmit both report running', () => {
    expect(
      resolveMostAdvancedRunningStageId({
        stages: [{ id: 'source' }, { id: 'geometry' }, { id: 'tileEmit' }],
        tasks: [
          { stage: 'geometry', status: 'running' },
          { stage: 'tileEmit', status: 'running' },
        ],
      })
    ).toBe('tileEmit');
  });

  it('returns null when no running tasks exist', () => {
    expect(
      resolveMostAdvancedRunningStageId({
        stages: [{ id: 'source' }, { id: 'geometry' }, { id: 'tileEmit' }],
        tasks: [{ stage: 'source', status: 'completed' }],
      })
    ).toBeNull();
  });

  it('uses canonical stage priority even when stage array order is stale', () => {
    expect(
      resolveMostAdvancedRunningStageId({
        stages: [{ id: 'source' }, { id: 'tileEmit' }, { id: 'geometry' }],
        tasks: [
          { stage: 'geometry', status: 'running' },
          { stage: 'tileEmit', status: 'running' },
        ],
      })
    ).toBe('tileEmit');
  });
});

describe('resolveMostAdvancedInFlightStageId', () => {
  it('promotes queued geometry above completed source during handoff', () => {
    expect(
      resolveMostAdvancedInFlightStageId({
        stages: [{ id: 'source' }, { id: 'geometry' }, { id: 'tileEmit' }],
        tasks: [
          { stage: 'source', status: 'completed' },
          { stage: 'geometry', status: 'queued' },
        ],
      })
    ).toBe('geometry');
  });
});

describe('buildElapsedByStageWithActiveStage', () => {
  it('applies live elapsed to running stage when larger than current snapshot', () => {
    const result = buildElapsedByStageWithActiveStage({
      stageDurationByStage: {
        source: 5_000,
        geometry: 2_000,
      },
      timingStageId: 'geometry',
      timingStageElapsedMs: 8_000,
    });
    expect(result).toEqual({
      source: 5_000,
      geometry: 8_000,
    });
  });
});

describe('resolveTotalElapsedMs', () => {
  it('uses sum of per-stage elapsed while running', () => {
    const total = resolveTotalElapsedMs({
      buildStatus: 'running',
      stageDurationByStage: {
        source: 10_000,
        geometry: 20_000,
      },
      sessionDurationMs: 99_000,
    });
    expect(total).toBe(30_000);
  });

  it('keeps larger of stage-sum and session elapsed after running stops', () => {
    const total = resolveTotalElapsedMs({
      buildStatus: 'completed',
      stageDurationByStage: {
        source: 10_000,
        geometry: 20_000,
      },
      sessionDurationMs: 40_000,
    });
    expect(total).toBe(40_000);
  });
});

describe('timing contract validation', () => {
  it('calculates valid stage and session elapsed time', () => {
    expect(
      resolveStageElapsedMs({
        stageStartedAt: 1_000,
        stageInactiveMs: 100,
        endAt: 1_600,
      })
    ).toBe(500);
    expect(
      resolveSessionElapsedMs({
        buildStatus: 'completed',
        startedAt: 1_000,
        inactiveMs: 100,
        completedAt: 2_000,
        now: 3_000,
      })
    ).toBe(900);
  });

  it('requires phase-specific session timestamps', () => {
    expect(() =>
      resolveSessionElapsedMs({
        buildStatus: 'running',
        now: 2_000,
      })
    ).toThrowError('startedAt must be a finite non-negative number');
    expect(() =>
      resolveSessionElapsedMs({
        buildStatus: 'paused',
        startedAt: 1_000,
        now: 2_000,
      })
    ).toThrowError('heartbeatAt must be a finite non-negative number');
    expect(() =>
      resolveSessionElapsedMs({
        buildStatus: 'failed',
        startedAt: 1_000,
        now: 2_000,
      })
    ).toThrowError('completedAt must be a finite non-negative number');
  });

  it('validates supplied idle timing without requiring a start timestamp', () => {
    expect(
      resolveSessionElapsedMs({
        buildStatus: 'idle',
        now: 2_000,
      })
    ).toBe(0);
    expect(() =>
      resolveSessionElapsedMs({
        buildStatus: 'idle',
        inactiveMs: -1,
        now: 2_000,
      })
    ).toThrowError('inactiveMs must be a finite non-negative number');
    expect(() =>
      resolveSessionElapsedMs({
        buildStatus: 'idle',
        startedAt: 1_000,
        completedAt: 900,
        now: 2_000,
      })
    ).toThrowError('session duration must be finite and non-negative');
  });

  it('rejects non-finite, negative, and reversed timing values', () => {
    expect(() =>
      resolveStageElapsedMs({
        stageStartedAt: Number.POSITIVE_INFINITY,
        stageInactiveMs: 0,
        endAt: 2_000,
      })
    ).toThrowError('stageStartedAt must be a finite non-negative number');
    expect(() =>
      resolveStageElapsedMs({
        stageStartedAt: 1_000,
        stageInactiveMs: -1,
        endAt: 2_000,
      })
    ).toThrowError('stageInactiveMs must be a finite non-negative number');
    expect(() =>
      resolveStageElapsedMs({
        stageStartedAt: 1_000,
        stageInactiveMs: 100,
        endAt: 1_050,
      })
    ).toThrowError('stage duration must be finite and non-negative');
    expect(() =>
      resolveSessionElapsedMs({
        buildStatus: 'completed',
        startedAt: 1_000,
        inactiveMs: 100,
        completedAt: 1_050,
        now: 2_000,
      })
    ).toThrowError('session duration must be finite and non-negative');
  });
});
