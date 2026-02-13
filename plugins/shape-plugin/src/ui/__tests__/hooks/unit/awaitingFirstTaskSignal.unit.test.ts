import { describe, expect, it } from 'vitest';
import { hasAwaitingFirstTaskSignal } from '../../../components/build-progress/awaitingFirstTaskSignal.ts';

describe('hasAwaitingFirstTaskSignal', () => {
  it('returns true when started task exists', () => {
    expect(hasAwaitingFirstTaskSignal({
      hasStartedTasks: true,
      hasQueuedTasks: false,
      progressTaskId: null,
      progressTotal: 0,
    })).toBe(true);
  });

  it('returns true when queued task exists', () => {
    expect(hasAwaitingFirstTaskSignal({
      hasStartedTasks: false,
      hasQueuedTasks: true,
      progressTaskId: null,
      progressTotal: 0,
    })).toBe(true);
  });

  it('returns true when progress task id is present', () => {
    expect(hasAwaitingFirstTaskSignal({
      hasStartedTasks: false,
      hasQueuedTasks: false,
      progressTaskId: 'task-1',
      progressTotal: 0,
    })).toBe(true);
  });

  it('returns true when progress total is positive', () => {
    expect(hasAwaitingFirstTaskSignal({
      hasStartedTasks: false,
      hasQueuedTasks: false,
      progressTaskId: null,
      progressTotal: 1,
    })).toBe(true);
  });

  it('returns false when no signal exists', () => {
    expect(hasAwaitingFirstTaskSignal({
      hasStartedTasks: false,
      hasQueuedTasks: false,
      progressTaskId: null,
      progressTotal: 0,
    })).toBe(false);
  });
});
