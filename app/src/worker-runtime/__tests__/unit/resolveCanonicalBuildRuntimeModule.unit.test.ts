import {
  CanonicalBuildRuntimeError,
  canonicalBuildRuntimeAdapterMethodNames,
  canonicalPluginBuildAPIMethodNames,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { resolveCanonicalBuildRuntimeModule } from '../../resolveCanonicalBuildRuntimeModule.js';

const nodeType = 'location' as NodeType;

const createAPI = (): Record<string, unknown> =>
  Object.fromEntries(canonicalPluginBuildAPIMethodNames.map((methodName) => [methodName, vi.fn()]));

const createAdapter = (): Record<string, unknown> => ({
  nodeType,
  ...Object.fromEntries(
    canonicalBuildRuntimeAdapterMethodNames.map((methodName) => [methodName, vi.fn()])
  ),
  getSession: vi.fn(async () => null),
  listSessions: vi.fn(async () => []),
  subscribeSessions: vi.fn(() => () => undefined),
  deleteSession: vi.fn(async (_nodeId: NodeId) => undefined),
});

describe('resolveCanonicalBuildRuntimeModule', () => {
  it('resolves paired canonical build API and runtime adapter exports', () => {
    const canonicalBuildAPI = createAPI();
    const canonicalBuildRuntimeAdapter = createAdapter();

    expect(
      resolveCanonicalBuildRuntimeModule({ canonicalBuildAPI, canonicalBuildRuntimeAdapter })
    ).toEqual({
      buildAPI: canonicalBuildAPI,
      runtimeAdapter: canonicalBuildRuntimeAdapter,
    });
  });

  it('allows canonical build API without runtime adapter during rollout', () => {
    const canonicalBuildAPI = createAPI();

    expect(resolveCanonicalBuildRuntimeModule({ canonicalBuildAPI })).toEqual({
      buildAPI: canonicalBuildAPI,
      runtimeAdapter: null,
    });
  });

  it('rejects runtime adapter exports without canonical build API', () => {
    expect(() =>
      resolveCanonicalBuildRuntimeModule({ canonicalBuildRuntimeAdapter: createAdapter() })
    ).toThrow(CanonicalBuildRuntimeError);
  });

  it('rejects malformed runtime adapter exports with typed errors', () => {
    expect(() =>
      resolveCanonicalBuildRuntimeModule({
        canonicalBuildAPI: createAPI(),
        canonicalBuildRuntimeAdapter: {},
      })
    ).toThrow(CanonicalBuildRuntimeError);
  });
});
