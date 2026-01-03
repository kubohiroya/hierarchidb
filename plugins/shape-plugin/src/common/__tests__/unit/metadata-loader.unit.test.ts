import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataLoader } from '../../../services/metadata/MetadataLoader.js';
import * as chunkStore from '../../../services/utils/chunkStore.js';

const getOrFetchForNode = vi.fn(async (_nodeId: string, url: string) => {
  if (url.includes('maps.html')) {
    return { key: url, value: '<a href="https://gadm.org/maps/JPN.html">Japan</a>' };
  }
  if (url.includes('JPN.html')) {
    return { key: url, value: 'GeoJSON: level-0, level-1, level-2' };
  }
  return {
    key: url,
    value: [
      { boundaryISO: 'JPN', boundaryType: 'ADM0', boundaryName: 'Japan' },
      { boundaryISO: 'JPN', boundaryType: 'ADM1', boundaryName: 'Japan' },
    ],
  };
});

vi.mock('../../../services/utils/chunkStore.js', () => ({
  buildShapeCacheKey: vi.fn((prefix: string, url: string) => `${prefix}:${url}`),
  createShapeChunkStore: vi.fn(() => ({ getOrFetchForNode })),
  jsonSerializer: vi.fn(),
  jsonDeserializer: vi.fn(),
  SHARED_SHAPE_NODE_ID: 'shape-shared',
  textSerializer: vi.fn(),
  textDeserializer: vi.fn(),
}));

describe('MetadataLoader', () => {
  beforeEach(() => {
    metadataLoader.clearCache();
    vi.clearAllMocks();
  });

  it('loads metadata for lowercase geoBoundaries', async () => {
    const result = await metadataLoader.loadMetadata('geoboundaries');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(chunkStore.createShapeChunkStore).toHaveBeenCalled();
    expect(getOrFetchForNode).toHaveBeenCalled();
  });

  it('normalizes casing and reuses cache without warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await metadataLoader.loadMetadata('geoboundaries');
    const second = await metadataLoader.loadMetadata('GeoBoundaries');
    expect(second.length).toBeGreaterThan(0);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(getOrFetchForNode).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('throws on openstreetmap', async () => {
    await expect(metadataLoader.loadMetadata('openstreetmap')).rejects.toThrow(
      'OpenStreetMap is not supported in Step3 country selection.',
    );
  });
});
