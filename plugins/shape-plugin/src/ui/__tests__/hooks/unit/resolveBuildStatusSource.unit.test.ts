import { describe, expect, it } from 'vitest';
import { resolveBuildStatusSource } from '../../../components/build-progress/resolveBuildStatusSource.ts';

describe('resolveBuildStatusSource', () => {
  it('uses persisted completed when runtime status is stale processing', () => {
    expect(resolveBuildStatusSource('completed', 'processing')).toBe('completed');
  });

  it('uses persisted failed when runtime status is stale queued', () => {
    expect(resolveBuildStatusSource('failed', 'queued')).toBe('failed');
  });

  it('keeps runtime processing when persisted status is idle', () => {
    expect(resolveBuildStatusSource('idle', 'processing')).toBe('processing');
  });
});
