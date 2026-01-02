import { describe, expect, it } from 'vitest';
import { computeBaseCounts, computePercentage } from './stageProgress.js';

describe('stageProgress', () => {
  it('clamps base counts safely', () => {
    expect(computeBaseCounts({ total: 10, completedCount: 12, failedCount: 5 })).toEqual({
      total: 10,
      baseCompleted: 10,
      baseFailed: 0,
    });

    expect(computeBaseCounts({ total: 10, completedCount: -1, failedCount: -2 })).toEqual({
      total: 10,
      baseCompleted: 0,
      baseFailed: 0,
    });
  });

  it('computes percentage with skipped', () => {
    expect(computePercentage({ total: 10, completed: 3, failed: 2, skipped: 5 })).toBe(100);
    expect(computePercentage({ total: 0, completed: 0, failed: 0 })).toBe(0);
  });
});

