import { describe, expect, it } from 'vitest';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressTypes';
import {
  resolveDisplayTasks,
  shouldClearPersistedTasksOnReset,
} from '../../../components/build-progress/internal/useShapeBuildSessionStageState';

describe('shouldClearPersistedTasksOnReset', () => {
  it('returns true when runtime is idle and tasks are empty', () => {
    expect(
      shouldClearPersistedTasksOnReset({
        runtimePhase: 'idle',
        taskCount: 0,
      })
    ).toBe(true);
  });

  it('returns false when tasks remain', () => {
    expect(
      shouldClearPersistedTasksOnReset({
        runtimePhase: 'idle',
        taskCount: 1,
      })
    ).toBe(false);
  });

  it('returns false when runtime is not idle', () => {
    expect(
      shouldClearPersistedTasksOnReset({
        runtimePhase: 'running',
        taskCount: 0,
      })
    ).toBe(false);
  });
});

describe('resolveDisplayTasks', () => {
  const persistedTask = { taskId: 'persisted' } as ShapeBuildTaskSummary;
  const currentTask = { taskId: 'current' } as ShapeBuildTaskSummary;

  it('hides retained terminal tasks in the same render that the runtime resets to idle', () => {
    expect(
      resolveDisplayTasks({
        runtimePhase: 'idle',
        tasks: [],
        persistedTasks: [persistedTask],
      })
    ).toEqual([]);
  });

  it('retains the previous snapshot while a non-idle runtime has no current tasks', () => {
    expect(
      resolveDisplayTasks({
        runtimePhase: 'completed',
        tasks: [],
        persistedTasks: [persistedTask],
      })
    ).toEqual([persistedTask]);
  });

  it('prefers the current authoritative task snapshot', () => {
    expect(
      resolveDisplayTasks({
        runtimePhase: 'idle',
        tasks: [currentTask],
        persistedTasks: [persistedTask],
      })
    ).toEqual([currentTask]);
  });
});
