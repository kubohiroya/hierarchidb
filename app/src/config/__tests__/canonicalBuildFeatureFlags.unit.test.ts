import { describe, expect, it } from 'vitest';
import { resolveCanonicalBuildFeatureFlags } from '../canonicalBuildFeatureFlags.js';

describe('resolveCanonicalBuildFeatureFlags', () => {
  it('defaults canonicalBuildInputEnvelope to false', () => {
    expect(resolveCanonicalBuildFeatureFlags({})).toEqual({
      canonicalBuildInputEnvelope: false,
    });
  });

  it('accepts only 0 or 1 for canonicalBuildInputEnvelope', () => {
    expect(
      resolveCanonicalBuildFeatureFlags({ VITE_CANONICAL_BUILD_INPUT_ENVELOPE: '0' })
        .canonicalBuildInputEnvelope
    ).toBe(false);
    expect(
      resolveCanonicalBuildFeatureFlags({ VITE_CANONICAL_BUILD_INPUT_ENVELOPE: '1' })
        .canonicalBuildInputEnvelope
    ).toBe(true);
    expect(() =>
      resolveCanonicalBuildFeatureFlags({ VITE_CANONICAL_BUILD_INPUT_ENVELOPE: 'true' })
    ).toThrow('VITE_CANONICAL_BUILD_INPUT_ENVELOPE must be unset, 0, or 1');
  });
});
