import { describe, expect, it, vi } from 'vitest';
import { resolveShapeBuildRuntimeAdapterHooks } from '../../resolveShapeBuildRuntimeAdapterHooks.js';

const createHooks = () => ({
  configureShapeCanonicalBuildRuntimeAdapter: vi.fn(),
  setShapeBuildRuntimeInputSource: vi.fn(),
  setShapeBuildRuntimeTransientStatus: vi.fn(),
  clearShapeBuildRuntimeTransientStatus: vi.fn(),
});

describe('resolveShapeBuildRuntimeAdapterHooks', () => {
  it('resolves the shape runtime adapter hook exports', () => {
    const hooks = createHooks();

    expect(resolveShapeBuildRuntimeAdapterHooks(hooks)).toBe(hooks);
  });

  it('rejects missing hook exports', () => {
    expect(() => resolveShapeBuildRuntimeAdapterHooks({})).toThrow(
      'shape runtime adapter hook configureShapeCanonicalBuildRuntimeAdapter must be a function'
    );
  });
});
