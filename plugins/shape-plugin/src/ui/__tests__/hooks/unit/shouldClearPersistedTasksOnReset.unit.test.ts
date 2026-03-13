import { describe, expect, it } from 'vitest';
import { shouldClearPersistedTasksOnReset } from '../../../components/build-progress/internal/useShapeBuildStepStageState';

describe('shouldClearPersistedTasksOnReset', () => {
  it('returns true when runtime is reset state and tasks are empty', () => {
    expect(shouldClearPersistedTasksOnReset({
      runtimePhase: 'idle',
      taskCount: 0,
    })).toBe(true);
  });

  it('returns false when tasks remain', () => {
    expect(shouldClearPersistedTasksOnReset({
      runtimePhase: 'idle',
      taskCount: 1,
    })).toBe(false);
  });

  it('returns false when phase is not idle', () => {
    expect(shouldClearPersistedTasksOnReset({
      runtimePhase: 'running',
      taskCount: 0,
    })).toBe(false);
  });
});
