import {
  type CanonicalPluginBuildAPI,
  canonicalPluginBuildAPIMethodNames,
} from '@hierarchidb/build-api';

export const resolveCanonicalPluginBuildAPI = (
  moduleValue: unknown
): CanonicalPluginBuildAPI | null => {
  if (
    moduleValue === null ||
    (typeof moduleValue !== 'object' && typeof moduleValue !== 'function')
  ) {
    return null;
  }
  const candidate = (moduleValue as Record<string, unknown>).canonicalBuildAPI;
  if (candidate === undefined) return null;
  if (candidate === null || typeof candidate !== 'object') {
    throw new Error('[worker bootstrap] canonicalBuildAPI export must be an object');
  }
  const record = candidate as Record<string, unknown>;
  for (const methodName of canonicalPluginBuildAPIMethodNames) {
    if (typeof record[methodName] !== 'function') {
      throw new Error(`[worker bootstrap] canonicalBuildAPI.${methodName} must be a function`);
    }
  }
  return candidate as CanonicalPluginBuildAPI;
};
