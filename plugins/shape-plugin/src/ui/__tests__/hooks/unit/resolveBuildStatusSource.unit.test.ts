import { describe, expect, it } from 'vitest';
import { resolveBuildStatusSource } from '../../../components/build-progress/resolveBuildStatusSource';

describe('resolveBuildStatusSource', () => {
  it('prefers runtime completed over persisted running', () => {
    expect(resolveBuildStatusSource('running', 'completed')).toBe('completed');
  });

  it('prefers runtime idle over persisted running', () => {
    expect(resolveBuildStatusSource('running', 'idle')).toBe('idle');
  });

  it('uses persisted completed when runtime status is stale running', () => {
    expect(resolveBuildStatusSource('completed', 'running')).toBe('completed');
  });

  it('uses persisted failed when runtime status is stale queued', () => {
    expect(resolveBuildStatusSource('failed', 'queued')).toBe('failed');
  });

  it('keeps runtime running when persisted status is idle', () => {
    expect(resolveBuildStatusSource('idle', 'running')).toBe('running');
  });
});
