import { describe, expect, it } from 'vitest';
import { shouldUpdateElapsedSnapshot } from '../../../components/build-progress/useBuildProgressPanelState.ts';

describe('shouldUpdateElapsedSnapshot', () => {
  it('returns true when there is no snapshot yet', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: null,
      totalElapsedMs: 0,
      buildStatus: 'idle',
    })).toBe(true);
  });

  it('returns false when elapsed decreases while running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { elapsedMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 9_000,
      buildStatus: 'running',
    })).toBe(false);
  });

  it('returns true when reset sets elapsed to zero during running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { elapsedMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 0,
      buildStatus: 'running',
    })).toBe(true);
  });

  it('returns true when build is not running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { elapsedMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 8_000,
      buildStatus: 'paused',
    })).toBe(true);
  });
});
