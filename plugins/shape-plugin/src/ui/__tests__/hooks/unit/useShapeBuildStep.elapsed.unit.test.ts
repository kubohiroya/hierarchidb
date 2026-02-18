import { describe, expect, it } from 'vitest';
import {
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
  resolveDisplayBuildStatus,
  shouldRefreshTasksSnapshot,
  shouldResetElapsedState,
} from '../../../components/build-progress/useShapeBuildStep.js';

describe('shouldResetElapsedState', () => {
  it('returns false while build is running', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'running',
      buildElapsedMs: 0,
      stageElapsedByStage: {},
      localElapsedByStage: {},
    })).toBe(false);
  });

  it('returns true when both persisted and local elapsed are empty', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'idle',
      buildElapsedMs: 0,
      stageElapsedByStage: {},
      localElapsedByStage: {},
    })).toBe(true);
  });

  it('returns false when local elapsed snapshot exists', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'idle',
      buildElapsedMs: 0,
      stageElapsedByStage: {},
      localElapsedByStage: {
        fetch: 2_000,
      },
    })).toBe(false);
  });

  it('returns false when persisted elapsed exists', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'completed',
      buildElapsedMs: 0,
      stageElapsedByStage: {
        vt: 1_000,
      },
      localElapsedByStage: {},
    })).toBe(false);
  });

  it('returns false when total elapsed exists', () => {
    expect(shouldResetElapsedState({
      buildStatus: 'failed',
      buildElapsedMs: 5_000,
      stageElapsedByStage: {},
      localElapsedByStage: {},
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
      processingStatus: 'processing',
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
      processingStatus: 'processing',
      buildSessionTransitionActive: false,
    })).toBe(false);
  });
});

describe('resolveMostAdvancedRunningStageId', () => {
  it('prefers vt when transform and vt both report running', () => {
    expect(resolveMostAdvancedRunningStageId({
      stages: [{ id: 'fetch' }, { id: 'transform' }, { id: 'vt' }],
      tasks: [
        { stage: 'transform', taskType: 'transform', type: 'transform', status: 'running' },
        { stage: 'vt', taskType: 'fetch', type: 'fetch', status: 'running' },
      ],
    })).toBe('vt');
  });

  it('returns null when no running tasks exist', () => {
    expect(resolveMostAdvancedRunningStageId({
      stages: [{ id: 'fetch' }, { id: 'transform' }, { id: 'vt' }],
      tasks: [
        { stage: 'fetch', taskType: 'fetch', type: 'fetch', status: 'completed' },
      ],
    })).toBeNull();
  });

  it('uses canonical stage priority even when stage array order is stale', () => {
    expect(resolveMostAdvancedRunningStageId({
      stages: [{ id: 'fetch' }, { id: 'vt' }, { id: 'transform' }],
      tasks: [
        { stage: 'transform', taskType: 'transform', type: 'transform', status: 'running' },
        { stage: 'vt', taskType: 'vt', type: 'vt', status: 'running' },
      ],
    })).toBe('vt');
  });
});

describe('resolveMostAdvancedInFlightStageId', () => {
  it('promotes queued transform above completed fetch during handoff', () => {
    expect(resolveMostAdvancedInFlightStageId({
      stages: [{ id: 'fetch' }, { id: 'transform' }, { id: 'vt' }],
      tasks: [
        { stage: 'fetch', taskType: 'fetch', type: 'fetch', status: 'completed' },
        { stage: 'transform', taskType: 'transform', type: 'transform', status: 'queued' },
      ],
    })).toBe('transform');
  });
});
