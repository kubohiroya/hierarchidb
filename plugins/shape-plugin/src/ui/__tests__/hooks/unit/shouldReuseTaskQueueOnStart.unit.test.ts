import { describe, expect, it } from 'vitest';
import { shouldReuseTaskQueueOnStart } from '../../../../worker/shouldReuseTaskQueueOnStart';

describe('shouldReuseTaskQueueOnStart', () => {
  it('returns false for completed sessions', () => {
    expect(shouldReuseTaskQueueOnStart('completed')).toBe(false);
  });

  it('returns false for other statuses', () => {
    expect(shouldReuseTaskQueueOnStart('running')).toBe(false);
    expect(shouldReuseTaskQueueOnStart('paused')).toBe(false);
    expect(shouldReuseTaskQueueOnStart('failed')).toBe(false);
    expect(shouldReuseTaskQueueOnStart('startAccepted')).toBe(false);
    expect(shouldReuseTaskQueueOnStart('idle')).toBe(false);
  });

  it('returns false when session status is missing', () => {
    expect(shouldReuseTaskQueueOnStart(undefined)).toBe(false);
    expect(shouldReuseTaskQueueOnStart(null)).toBe(false);
  });
});
