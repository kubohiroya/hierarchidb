import { describe, expect, it } from 'vitest';
import {
  isTaskUpdateVersionAfterSnapshot,
  resolveTaskIdentityAction,
  resolveSnapshotTargetStages,
  resolveTaskVersionAction,
} from '../../../components/build-progress/useShapeBuildSessionStateAtomBridge';

describe('useShapeBuildSessionStateAtomBridge contract helpers', () => {
  it('accepts only task versions greater than snapshotVersionMax', () => {
    expect(isTaskUpdateVersionAfterSnapshot(10, 11)).toBe(true);
    expect(isTaskUpdateVersionAfterSnapshot(10, 10)).toBe(false);
    expect(isTaskUpdateVersionAfterSnapshot(10, 9)).toBe(false);
  });

  it('resolves snapshot target stage from explicit stage when tasks are empty', () => {
    const stages = resolveSnapshotTargetStages({
      type: 'snapshot',
      nodeId: 'n1',
      tasks: [],
      version: 0,
      stage: 'geometry',
    });
    expect(stages).toEqual(['geometry']);
  });

  it('resolves all stages when empty snapshot has no explicit stage', () => {
    const stages = resolveSnapshotTargetStages({
      type: 'snapshot',
      nodeId: 'n1',
      tasks: [],
      version: 0,
    });
    expect(stages).toEqual(['source', 'geometry', 'tileEmit']);
  });

  it('returns version action by monotonic contract', () => {
    expect(resolveTaskVersionAction(undefined, 3)).toBe('accept');
    expect(resolveTaskVersionAction(3, 4)).toBe('accept');
    expect(resolveTaskVersionAction(3, 3)).toBe('drop');
    expect(resolveTaskVersionAction(3, 2)).toBe('error');
  });

  it('accepts unknown taskId only when task version is after snapshot boundary', () => {
    expect(resolveTaskIdentityAction(false, 10, 11)).toBe('accept-new');
    expect(resolveTaskIdentityAction(false, 10, 10)).toBe('error-unknown-stale');
    expect(resolveTaskIdentityAction(false, 10, 9)).toBe('error-unknown-stale');
  });

  it('drops known stale task updates at or before snapshot boundary', () => {
    expect(resolveTaskIdentityAction(true, 10, 11)).toBe('accept-known');
    expect(resolveTaskIdentityAction(true, 10, 10)).toBe('drop-known-stale');
    expect(resolveTaskIdentityAction(true, 10, 9)).toBe('drop-known-stale');
  });
});
