import type { BuildSessionStatus } from '@hierarchidb/build-api';
import { describe, expect, it } from 'vitest';
import { resolveRuntimeStatusFromBuildSession } from '../../resolveRuntimeStatusFromBuildSession.js';

describe('resolveRuntimeStatusFromBuildSession', () => {
  it.each<[BuildSessionStatus['status'], ReturnType<typeof resolveRuntimeStatusFromBuildSession>]>([
    ['idle', 'idle'],
    ['queued', 'starting'],
    ['running', 'running'],
    ['pausing', 'pausing'],
    ['paused', 'paused'],
    ['canceling', 'canceling'],
    ['canceled', 'canceled'],
    ['completed', 'completed'],
    ['failed', 'failed'],
  ])('maps %s to %s', (status, expected) => {
    expect(resolveRuntimeStatusFromBuildSession(status)).toBe(expected);
  });

  it('rejects recycled as an invalid session status', () => {
    expect(() => resolveRuntimeStatusFromBuildSession('recycled')).toThrow(
      '[worker bootstrap] recycled is not a valid build session status'
    );
  });
});
