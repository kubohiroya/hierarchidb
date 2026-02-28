import { describe, expect, it } from 'vitest';
import { resolveTaskListViewPhase } from '../../../components/build-progress/internal/useShapeBuildStepStageState';

describe('resolveTaskListViewPhase', () => {
  it('returns idle when no tasks and no loading/progress signals', () => {
    expect(resolveTaskListViewPhase({
      baseBuildStatus: 'idle',
      displayTaskCount: 0,
      isLoading: false,
      hasProgressTaskSignal: false,
      hasAnyTaskSnapshot: false,
    })).toBe('idle');
  });

  it('does not force awaitingSnapshot only from running status', () => {
    expect(resolveTaskListViewPhase({
      baseBuildStatus: 'running',
      displayTaskCount: 0,
      isLoading: false,
      hasProgressTaskSignal: false,
      hasAnyTaskSnapshot: false,
    })).toBe('settledEmpty');
  });

  it('returns awaitingSnapshot when loading is true', () => {
    expect(resolveTaskListViewPhase({
      baseBuildStatus: 'idle',
      displayTaskCount: 0,
      isLoading: true,
      hasProgressTaskSignal: false,
      hasAnyTaskSnapshot: false,
    })).toBe('awaitingSnapshot');
  });

  it('returns streaming when task list is present', () => {
    expect(resolveTaskListViewPhase({
      baseBuildStatus: 'running',
      displayTaskCount: 1,
      isLoading: false,
      hasProgressTaskSignal: false,
      hasAnyTaskSnapshot: true,
    })).toBe('streaming');
  });
});
