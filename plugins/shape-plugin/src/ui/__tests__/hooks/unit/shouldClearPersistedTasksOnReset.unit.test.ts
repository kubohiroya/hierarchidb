import { describe, expect, it } from 'vitest';
import { shouldClearPersistedTasksOnReset } from '../../../components/build-progress/internal/useShapeBuildStepStageState';

describe('shouldClearPersistedTasksOnReset', () => {
  it('returns true when runtime is reset state and tasks are empty', () => {
    expect(shouldClearPersistedTasksOnReset({
      runtimePhase: 'idle',
      lastAcceptedEventVersion: 0,
      taskCount: 0,
    })).toBe(true);
  });

  it('returns false when tasks remain', () => {
    expect(shouldClearPersistedTasksOnReset({
      runtimePhase: 'idle',
      lastAcceptedEventVersion: 0,
      taskCount: 1,
    })).toBe(false);
  });

  it('returns false when event version is not reset', () => {
    expect(shouldClearPersistedTasksOnReset({
      runtimePhase: 'idle',
      lastAcceptedEventVersion: 10,
      taskCount: 0,
    })).toBe(false);
  });
});

