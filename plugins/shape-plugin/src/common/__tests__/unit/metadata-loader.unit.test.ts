import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataLoader } from '../../../services/metadata/MetadataLoader';
import * as chunkStore from '../../../services/utils/createShapeChunkStore';
import { GEOBOUNDARIES_ALL_METADATA_URL } from '../../../services/utils/geoboundariesEndpoints';

const cache = new Map<string, { value: unknown; metadata?: unknown }>();
const relationsByNode = new Map<string, Set<string>>();

type FetchOptions = {
  cacheKey?: string;
};

const getOrFetchForNode = vi.fn(async (nodeId: string, url: string, options?: FetchOptions) => {
  if (!options?.cacheKey) {
    throw new Error('Metadata fetch must provide an explicit cacheKey.');
  }
  const key = options.cacheKey;
  let value: unknown;
  if (url.includes('maps.html')) {
    value = '<a href="https://gadm.org/maps/JPN.html">Japan</a>';
  } else if (url.includes('JPN.html')) {
    value = 'GeoJSON: level-0, level-1, level-2';
  } else {
    value = [
      { boundaryISO: 'JPN', boundaryType: 'ADM0', boundaryName: 'Japan', Continent: 'AS' },
      { boundaryISO: 'JPN', boundaryType: 'ADM1', boundaryName: 'Japan', Continent: 'AS' },
    ];
  }

  cache.set(key, { value });
  const relations = relationsByNode.get(nodeId) ?? new Set<string>();
  relations.add(key);
  relationsByNode.set(nodeId, relations);
  return { key, value };
});

const isoMocks = vi.hoisted(() => ({
  normalizeCountryCodeForDataSource: vi.fn(async (code: string) =>
    code.toUpperCase() === 'JPN' ? 'JP' : code.toUpperCase()
  ),
  resolveCountryContinentName: vi.fn(async () => 'Asia'),
  resolveCountryContinentCode: vi.fn(async () => 'AS'),
}));

vi.mock('../../../services/utils/iso3166.js', () => ({
  DEFAULT_ISO3166_CSV_URL: 'https://example.test/iso3166.csv',
  ...isoMocks,
}));

vi.mock('../../../services/utils/createShapeChunkStore.js', () => ({
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
  jsonSerializer: vi.fn(),
  jsonDeserializer: vi.fn(),
  textSerializer: vi.fn(),
  textDeserializer: vi.fn(),
}));

vi.mock('../../../services/utils/createShapeNetworkPort.js', () => ({
  createShapeNetworkPort: vi.fn(() => ({
    fetch: vi.fn(),
  })),
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
    expect(result).toEqual([
      {
        countryCode: 'JP',
        countryName: 'Japan',
        continent: 'Asia',
        availableAdminLevels: [0, 1],
        iso2: 'JP',
        iso3: 'JPN',
        dataQuality: 'medium',
      },
    ]);
    expect(chunkStore.createShapeChunkStoreWithNetworkPort).toHaveBeenCalled();
    expect(getOrFetchForNode).toHaveBeenCalledWith(
      'node-1',
      GEOBOUNDARIES_ALL_METADATA_URL,
      expect.objectContaining({
        accept: 'application/json',
        cacheKey: `geoboundaries:metadata:all:${GEOBOUNDARIES_ALL_METADATA_URL}`,
      })
    );
    expect(isoMocks.normalizeCountryCodeForDataSource).toHaveBeenCalledWith('JPN', 'iso2', {
      csvUrl: 'https://example.test/iso3166.csv',
    });
    expect(isoMocks.resolveCountryContinentName).toHaveBeenCalledWith('JP', {
      csvUrl: 'https://example.test/iso3166.csv',
    });
    expect(isoMocks.resolveCountryContinentCode).toHaveBeenCalledWith('JP', {
      csvUrl: 'https://example.test/iso3166.csv',
    });
  });

  it('reuses the in-memory cache for the same data source and node', async () => {
    const first = await metadataLoader.loadMetadata('geoboundaries', 'node-1');
    const second = await metadataLoader.loadMetadata('geoboundaries', 'node-1');
    expect(second).toBe(first);
    expect(getOrFetchForNode).toHaveBeenCalledTimes(1);
  });
});
