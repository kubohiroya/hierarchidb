import { describe, expect, it } from 'vitest';
import { shouldResetElapsedState } from '../../../components/build-progress/useShapeBuildStep.ts';

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
