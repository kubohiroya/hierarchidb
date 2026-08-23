import type { CanonicalBuildRuntimeAdapter, CanonicalPluginBuildAPI } from '@hierarchidb/build-api';
import { CanonicalBuildRuntimeError } from '@hierarchidb/build-api';
import { CanonicalBuildRuntimeAdapterRegistry } from '@hierarchidb/build-runtime-services';
import { resolveCanonicalPluginBuildAPI } from './resolveCanonicalPluginBuildAPI.js';

export interface CanonicalBuildRuntimeModuleResolution {
  buildAPI: CanonicalPluginBuildAPI | null;
  runtimeAdapter: CanonicalBuildRuntimeAdapter | null;
}

export const resolveCanonicalBuildRuntimeModule = (
  moduleValue: unknown
): CanonicalBuildRuntimeModuleResolution => {
  const buildAPI = resolveCanonicalPluginBuildAPI(moduleValue);
  const runtimeAdapter = resolveCanonicalBuildRuntimeAdapter(moduleValue);
  if (runtimeAdapter !== null && buildAPI === null) {
    throw new CanonicalBuildRuntimeError(
      '[worker bootstrap] canonicalBuildRuntimeAdapter export requires canonicalBuildAPI export',
      { code: 'CANONICAL_BUILD_RUNTIME_MODULE_API_MISSING' }
    );
  }
  return { buildAPI, runtimeAdapter };
};

const resolveCanonicalBuildRuntimeAdapter = (
  moduleValue: unknown
): CanonicalBuildRuntimeAdapter | null => {
  if (
    moduleValue === null ||
    (typeof moduleValue !== 'object' && typeof moduleValue !== 'function')
  ) {
    return null;
  }
  const candidate = (moduleValue as Record<string, unknown>).canonicalBuildRuntimeAdapter;
  if (candidate === undefined) return null;
  if (candidate === null || typeof candidate !== 'object') {
    throw new CanonicalBuildRuntimeError(
      '[worker bootstrap] canonicalBuildRuntimeAdapter export must be an object',
      {
        code: 'CANONICAL_BUILD_RUNTIME_ADAPTER_INVALID_NODE_TYPE',
        field: 'canonicalBuildRuntimeAdapter',
      }
    );
  }
  const registry = new CanonicalBuildRuntimeAdapterRegistry([
    candidate as CanonicalBuildRuntimeAdapter,
  ]);
  return registry.require((candidate as CanonicalBuildRuntimeAdapter).nodeType);
};
