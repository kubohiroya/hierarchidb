import { canonicalPluginBuildAPIMethodNames } from '@hierarchidb/build-api';
import { describe, expect, it, vi } from 'vitest';
import { resolveCanonicalPluginBuildAPI } from '../../resolveCanonicalPluginBuildAPI.js';

const createAPI = (): Record<string, unknown> =>
  Object.fromEntries(canonicalPluginBuildAPIMethodNames.map((methodName) => [methodName, vi.fn()]));

describe('resolveCanonicalPluginBuildAPI', () => {
  it('resolves only the explicit canonicalBuildAPI export', () => {
    const canonicalBuildAPI = createAPI();
    expect(resolveCanonicalPluginBuildAPI({ canonicalBuildAPI })).toBe(canonicalBuildAPI);
  });

  it('does not fall back to legacy Shape export names', () => {
    const legacyAPI = createAPI();
    expect(resolveCanonicalPluginBuildAPI({ shapeBuildAPI: legacyAPI })).toBeNull();
    expect(
      resolveCanonicalPluginBuildAPI({
        ShapeWorkerPlugin: { build: legacyAPI },
      })
    ).toBeNull();
  });

  it('rejects an incomplete canonical export', () => {
    expect(() => resolveCanonicalPluginBuildAPI({ canonicalBuildAPI: {} })).toThrow(
      'canonicalBuildAPI.startBuildSession must be a function'
    );
  });
});
