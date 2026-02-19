import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import * as chunkStore from '~/services/utils/chunkStore';

const cache = new Map<string, { value: unknown; metadata?: unknown }>();
const relationsByNode = new Map<string, Set<string>>();

const getOrFetchForNode = vi.fn(async (_nodeId: string, url: string) => {
  if (url.includes('maps.html')) {
    const entry = { key: url, value: '<a href="https://gadm.org/maps/JPN.html">Japan</a>' };
    cache.set(url, { value: entry.value });
    return entry;
  }
  if (url.includes('JPN.html')) {
    const entry = { key: url, value: 'GeoJSON: level-0, level-1, level-2' };
    cache.set(url, { value: entry.value });
    return entry;
  }
  const entry = {
    key: url,
    value: [
      { boundaryISO: 'JPN', boundaryType: 'ADM0', boundaryName: 'Japan', Continent: 'AS' },
      { boundaryISO: 'JPN', boundaryType: 'ADM1', boundaryName: 'Japan', Continent: 'AS' },
    ],
  };
  cache.set(url, { value: entry.value });
  return entry;
});

vi.mock('../../../services/utils/chunkStore.js', () => ({
  buildShapeCacheKey: vi.fn((prefix: string, url: string) => `${prefix}:${url}`),
  createShapeChunkStore: vi.fn(() => ({
    getOrFetchForNode,
    get: vi.fn(async (key: string) => {
      const entry = cache.get(key);
      return entry ? { key, value: entry.value, metadata: entry.metadata } : undefined;
    }),
    hasRelationForNode: vi.fn(async (nodeId: string, key: string) => {
      return relationsByNode.get(nodeId)?.has(key) ?? false;
    }),
    setForNode: vi.fn(async (nodeId: string, key: string, value: unknown, metadata?: unknown) => {
      cache.set(key, { value, metadata });
      const set = relationsByNode.get(nodeId) ?? new Set<string>();
      set.add(key);
      relationsByNode.set(nodeId, set);
    }),
  })),
  createShapeChunkStoreWithNetworkPort: vi.fn(() => ({
    getOrFetchForNode,
    get: vi.fn(async (key: string) => {
      const entry = cache.get(key);
      return entry ? { key, value: entry.value, metadata: entry.metadata } : undefined;
    }),
    hasRelationForNode: vi.fn(async (nodeId: string, key: string) => {
      return relationsByNode.get(nodeId)?.has(key) ?? false;
    }),
    setForNode: vi.fn(async (nodeId: string, key: string, value: unknown, metadata?: unknown) => {
      cache.set(key, { value, metadata });
      const set = relationsByNode.get(nodeId) ?? new Set<string>();
      set.add(key);
      relationsByNode.set(nodeId, set);
    }),
  })),
  createShapeNetworkPort: vi.fn(() => ({
    fetch: vi.fn(),
  })),
  jsonSerializer: vi.fn(),
  jsonDeserializer: vi.fn(),
  textSerializer: vi.fn(),
  textDeserializer: vi.fn(),
}));

describe('MetadataLoader', () => {
  beforeEach(() => {
    metadataLoader.clearCache();
    vi.clearAllMocks();
    cache.clear();
    relationsByNode.clear();
  });

  it('loads metadata for lowercase geoBoundaries', async () => {
    const result = await metadataLoader.loadMetadata('geoboundaries', 'node-1');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(chunkStore.createShapeChunkStoreWithNetworkPort).toHaveBeenCalled();
    expect(getOrFetchForNode).toHaveBeenCalled();
  });

  it('reuses cache for the same data source', async () => {
    await metadataLoader.loadMetadata('geoboundaries', 'node-1');
    const second = await metadataLoader.loadMetadata('geoboundaries', 'node-1');
    expect(second.length).toBeGreaterThan(0);
    expect(getOrFetchForNode).toHaveBeenCalledTimes(1);
  });

});
