import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataLoader } from '../../../services/metadata/MetadataLoader.js';
import * as download from '@hierarchidb/download';

vi.mock('@hierarchidb/download', () => ({
  configurePluginDownloadDefaults: vi.fn(),
  getCorsProxyBaseURL: vi.fn(),
  downloadJson: vi.fn(async () => ([
    { boundaryISO: 'JPN', boundaryType: 'ADM0', boundaryName: 'Japan' },
    { boundaryISO: 'JPN', boundaryType: 'ADM1', boundaryName: 'Japan' },
  ])),
  downloadText: vi.fn(async (pluginId: string, url: string) => {
    if (url.includes('maps.html')) {
      return '<a href=\"https://gadm.org/maps/JPN.html\">Japan</a>';
    }
    return 'GeoJSON: level-0, level-1, level-2';
  }),
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
    expect(download.downloadJson).toHaveBeenCalled();
  });

  it('normalizes casing and reuses cache without warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await metadataLoader.loadMetadata('geoboundaries');
    const second = await metadataLoader.loadMetadata('GeoBoundaries');
    expect(second.length).toBeGreaterThan(0);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(download.downloadJson).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('throws on openstreetmap', async () => {
    await expect(metadataLoader.loadMetadata('openstreetmap')).rejects.toThrow(
      'OpenStreetMap is not supported in Step3 country selection.',
    );
  });
});
