import { describe, expect, it } from 'vitest';
import { shouldReuseTaskQueueOnStart } from '~/worker/shouldReuseTaskQueueOnStart';

describe('shouldReuseTaskQueueOnStart', () => {
  it('returns false for completed sessions', () => {
    expect(shouldReuseTaskQueueOnStart('completed')).toBe(false);
  });

  it('returns true for non-completed sessions', () => {
    expect(shouldReuseTaskQueueOnStart('running')).toBe(true);
    expect(shouldReuseTaskQueueOnStart('paused')).toBe(true);
    expect(shouldReuseTaskQueueOnStart('failed')).toBe(true);
    expect(shouldReuseTaskQueueOnStart('idle')).toBe(false);
  });

  it('returns false when session status is missing', () => {
    expect(shouldReuseTaskQueueOnStart(undefined)).toBe(false);
    expect(shouldReuseTaskQueueOnStart(null)).toBe(false);
  });
});
