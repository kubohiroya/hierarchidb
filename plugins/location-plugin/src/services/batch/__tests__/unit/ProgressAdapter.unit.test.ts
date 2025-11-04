import { describe, it, expect } from 'vitest';
import { toBatchProgressEvent } from '../ProgressAdapter.js';

describe('ProgressAdapter', () => {
  it('maps known stages to shared vocabulary and computes percentage from completed/total', () => {
    const std = toBatchProgressEvent({
      sessionId: 's1',
      stage: 'filter',
      total: 10,
      completed: 7,
    });
    expect(std.sessionId).toBe('s1');
    expect(std.stage).toBe('simplify1');
    expect(std.phase).toBe('running');
    expect(std.payload?.completed).toBe(7);
    expect(std.payload?.total).toBe(10);
  });

  it('passes through percentage when provided and preserves unknown stages', () => {
    const std = toBatchProgressEvent({
      sessionId: 's2',
      stage: 'custom-stage',
      percentage: 55,
      total: 0,
      completed: 0,
    });
    expect(std.stage).toBe('custom-stage');
    expect(std.phase).toBe('running');
    expect(std.payload?.completed).toBe(0);
  });
});
