import type { NetworkPortLike } from './ThrottledPort.js';

interface FeatureRegistryLike {
  require?(name: string): unknown;
}

export function getNetPort(): NetworkPortLike {
  try {
    const registry = resolveFeatureRegistry();
    if (registry && typeof registry.require === 'function') {
      const candidate = registry.require('net.port');
      if (isNetworkPort(candidate)) return candidate;
    }
  } catch {
    // ignore and fall back
  }

  return {
    async get(url: string, init?: RequestInit) {
      const response = await fetch(url, init);
      return {
        ok: response.ok,
        status: response.status,
        arrayBuffer: () => response.arrayBuffer(),
      };
    },
  };
}

function resolveFeatureRegistry(): FeatureRegistryLike | undefined {
  const globalRecord = globalThis as Record<string, unknown>;
  const candidates: unknown[] = [
    globalRecord.hidbFeatureRegistry,
    globalRecord.FeatureRegistry,
    globalRecord.featureRegistry,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'object' && candidate !== null) return candidate as FeatureRegistryLike;
  }
  return undefined;
}

function isNetworkPort(value: unknown): value is NetworkPortLike {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.get === 'function';
}
