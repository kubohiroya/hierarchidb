import { describe, expect, it } from 'vitest';
import { resolveCanonicalBuildFeatureFlags } from '../canonicalBuildFeatureFlags.js';

describe('resolveCanonicalBuildFeatureFlags', () => {
  it('defaults canonicalBuildInputEnvelope to false', () => {
    expect(resolveCanonicalBuildFeatureFlags({})).toEqual({
      canonicalBuildInputEnvelope: false,
      canonicalBuildRuntimeAdapter: false,
      locationMvt: false,
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

  it('accepts only 0 or 1 for canonicalBuildRuntimeAdapter', () => {
    expect(
      resolveCanonicalBuildFeatureFlags({ VITE_CANONICAL_BUILD_RUNTIME_ADAPTER: '0' })
        .canonicalBuildRuntimeAdapter
    ).toBe(false);
    expect(
      resolveCanonicalBuildFeatureFlags({ VITE_CANONICAL_BUILD_RUNTIME_ADAPTER: '1' })
        .canonicalBuildRuntimeAdapter
    ).toBe(true);
    expect(() =>
      resolveCanonicalBuildFeatureFlags({ VITE_CANONICAL_BUILD_RUNTIME_ADAPTER: 'true' })
    ).toThrow('VITE_CANONICAL_BUILD_RUNTIME_ADAPTER must be unset, 0, or 1');
  });

  it('accepts only 0 or 1 for locationMvt', () => {
    expect(resolveCanonicalBuildFeatureFlags({ VITE_LOCATION_MVT: '0' }).locationMvt).toBe(false);
    expect(resolveCanonicalBuildFeatureFlags({ VITE_LOCATION_MVT: '1' }).locationMvt).toBe(true);
    expect(() => resolveCanonicalBuildFeatureFlags({ VITE_LOCATION_MVT: 'true' })).toThrow(
      'VITE_LOCATION_MVT must be unset, 0, or 1'
    );
  });
});
