import { describe, expect, it } from 'vitest';
import {
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
  resolveDisplayBuildStatus,
  shouldRefreshTasksSnapshot,
  shouldResetElapsedState,
} from '../../../components/build-progress/internal/useShapeBuildSessionLogic';
import {
  buildElapsedByStageWithActiveStage,
  resolveTotalElapsedMs,
} from '../../../components/build-progress/internal/useShapeBuildSessionHelpers/elapsed';

describe('shouldResetElapsedState', () => {
  it('returns false while build is running', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'running',
      buildDurationMs: 0,
      sessionStageDurationByStage: {},
      localStageDurationByStage: {},
    })).toBe(false);
  });

  it('returns true when both persisted and local elapsed are empty', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'idle',
      buildDurationMs: 0,
      sessionStageDurationByStage: {},
      localStageDurationByStage: {},
    })).toBe(true);
  });

  it('returns false when local elapsed snapshot exists', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'idle',
      buildDurationMs: 0,
      sessionStageDurationByStage: {},
      localStageDurationByStage: {
        source: 2_000,
      },
    })).toBe(false);
  });

  it('returns false when persisted elapsed exists', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'completed',
      buildDurationMs: 0,
      sessionStageDurationByStage: {
        tileEmit: 1_000,
      },
      localStageDurationByStage: {},
    })).toBe(false);
  });

  it('returns false when total elapsed exists', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'failed',
      buildDurationMs: 5_000,
      sessionStageDurationByStage: {},
      localStageDurationByStage: {},
    })).toBe(false);
  });
});

describe('resolveDisplayBuildStatus', () => {
  it('keeps running while base status is running even when current tasks are completed', () => {
    expect(resolveDisplayBuildStatus({
      baseBuildStatus: 'running',
      tasksCompletionStatus: 'completed',
      hasInFlightTasks: false,
    })).toBe('running');
  });

  it('promotes to completed when base status is idle and tasks are completed', () => {
    expect(resolveDisplayBuildStatus({
      baseBuildStatus: 'idle',
      tasksCompletionStatus: 'completed',
      hasInFlightTasks: false,
    })).toBe('completed');
  });
});

describe('shouldRefreshTasksSnapshot', () => {
  it('returns true when running but visible tasks are stale completed-only entries', () => {
    expect(shouldRefreshTasksSnapshot({
      displayTaskCount: 2,
      hasInFlightTasks: false,
      hasProgressTaskSignal: false,
      buildStatus: 'running',
      runtimeStatus: 'running',
      processingStatus: 'running',
      buildSessionTransitionActive: false,
    })).toBe(true);
  });

  it('returns false when tasks are already running in UI', () => {
    expect(shouldRefreshTasksSnapshot({
      displayTaskCount: 2,
      hasInFlightTasks: true,
      hasProgressTaskSignal: true,
      buildStatus: 'running',
      runtimeStatus: 'running',
      processingStatus: 'running',
      buildSessionTransitionActive: false,
    })).toBe(false);
  });
});

describe('resolveMostAdvancedRunningStageId', () => {
  it('prefers tileEmit when geometry and tileEmit both report running', () => {
    expect(resolveMostAdvancedRunningStageId({
      stages: [{ id: 'source' }, { id: 'geometry' }, { id: 'tileEmit' }],
      tasks: [
        { stage: 'geometry', status: 'running' },
        { stage: 'tileEmit', status: 'running' },
      ],
    })).toBe('tileEmit');
  });

  it('returns null when no running tasks exist', () => {
    expect(resolveMostAdvancedRunningStageId({
      stages: [{ id: 'source' }, { id: 'geometry' }, { id: 'tileEmit' }],
      tasks: [
        { stage: 'source', status: 'completed' },
      ],
    })).toBeNull();
  });

  it('uses canonical stage priority even when stage array order is stale', () => {
    expect(resolveMostAdvancedRunningStageId({
      stages: [{ id: 'source' }, { id: 'tileEmit' }, { id: 'geometry' }],
      tasks: [
        { stage: 'geometry', status: 'running' },
        { stage: 'tileEmit', status: 'running' },
      ],
    })).toBe('tileEmit');
  });
});

describe('resolveMostAdvancedInFlightStageId', () => {
  it('promotes queued geometry above completed source during handoff', () => {
    expect(resolveMostAdvancedInFlightStageId({
      stages: [{ id: 'source' }, { id: 'geometry' }, { id: 'tileEmit' }],
      tasks: [
        { stage: 'source', status: 'completed' },
        { stage: 'geometry', status: 'queued' },
      ],
    })).toBe('geometry');
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
