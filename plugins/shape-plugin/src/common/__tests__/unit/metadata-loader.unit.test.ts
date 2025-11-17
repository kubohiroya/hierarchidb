import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataLoader } from '../../../services/metadata/MetadataLoader.js';

describe('MetadataLoader', () => {
  beforeEach(() => {
    metadataLoader.clearCache();
  });

  it('loads metadata for lowercase geoBoundaries', async () => {
    const result = await metadataLoader.loadMetadata('geoboundaries');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('normalizes casing and reuses cache without warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await metadataLoader.loadMetadata('geoboundaries');
    const second = await metadataLoader.loadMetadata('GeoBoundaries');
    expect(second.length).toBeGreaterThan(0);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
