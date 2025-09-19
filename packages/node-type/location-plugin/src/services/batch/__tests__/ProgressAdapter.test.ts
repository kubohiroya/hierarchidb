import { describe, it, expect } from 'vitest';
import { toStandardProgressEvent } from '../ProgressAdapter.js';

describe('ProgressAdapter', () => {
  it('maps known stages to shared vocabulary and computes percentage from completed/total', () => {
    const std = toStandardProgressEvent({
      sessionId: 's1',
      stage: 'filter',
      total: 10,
      completed: 7,
    });
    expect(std.sessionId).toBe('s1');
    expect(std.stage).toBe('simplify1');
    expect(std.percentage).toBe(70);
    expect(std.completed).toBe(7);
    expect(std.total).toBe(10);
  });

  it('passes through percentage when provided and preserves unknown stages', () => {
    const std = toStandardProgressEvent({
      sessionId: 's2',
      stage: 'custom-stage',
      percentage: 55,
    } as any);
    expect(std.stage).toBe('custom-stage');
    expect(std.percentage).toBe(55);
  });
});

