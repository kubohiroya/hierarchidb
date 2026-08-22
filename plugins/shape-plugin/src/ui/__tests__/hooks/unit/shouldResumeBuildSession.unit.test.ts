import { describe, expect, it } from 'vitest';
import { shouldResumeBuildSession } from '../../../components/build-progress/shouldResumeBuildSession';

describe('shouldResumeBuildSession', () => {
  it('returns true when build status is paused', () => {
    expect(
      shouldResumeBuildSession({
        buildStatus: 'paused',
        runtimeStatus: 'running',
      })
    ).toBe(true);
  });

  it('returns true when runtime status is paused', () => {
    expect(
      shouldResumeBuildSession({
        buildStatus: 'idle',
        runtimeStatus: 'paused',
      })
    ).toBe(true);
  });

  it('returns false when forceRestart is true', () => {
    expect(
      shouldResumeBuildSession({
        forceRestart: true,
        buildStatus: 'paused',
        runtimeStatus: 'paused',
      })
    ).toBe(false);
  });
});
