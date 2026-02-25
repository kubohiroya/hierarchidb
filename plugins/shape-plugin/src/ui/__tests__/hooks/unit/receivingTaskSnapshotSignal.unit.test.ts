import { describe, expect, it } from 'vitest';
import { hasReceivingTaskSnapshotSignal } from '../../../components/build-progress/receivingTaskSnapshotSignal';

describe('hasReceivingTaskSnapshotSignal', () => {
  it('returns true when started task exists', () => {
    expect(hasReceivingTaskSnapshotSignal({
      hasStartedTasks: true,
      hasQueuedTasks: false,
      progressTaskId: null,
      progressTotal: 0,
    })).toBe(true);
  });

  it('returns true when queued task exists', () => {
    expect(hasReceivingTaskSnapshotSignal({
      hasStartedTasks: false,
      hasQueuedTasks: true,
      progressTaskId: null,
      progressTotal: 0,
    })).toBe(true);
  });

  it('returns true when progress task id is present', () => {
    expect(hasReceivingTaskSnapshotSignal({
      hasStartedTasks: false,
      hasQueuedTasks: false,
      progressTaskId: 'task-1',
      progressTotal: 0,
    })).toBe(true);
  });

  it('returns true when progress total is positive', () => {
    expect(hasReceivingTaskSnapshotSignal({
      hasStartedTasks: false,
      hasQueuedTasks: false,
      progressTaskId: null,
      progressTotal: 1,
    })).toBe(true);
  });

  it('returns false when no signal exists', () => {
    expect(hasReceivingTaskSnapshotSignal({
      hasStartedTasks: false,
      hasQueuedTasks: false,
      progressTaskId: null,
      progressTotal: 0,
    })).toBe(false);
  });
});
