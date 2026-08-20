import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { CacheValidator } from '../../services/CacheValidator.js';

const nodeId = 'cache-validator-unit' as NodeId;

describe('CacheValidator', () => {
  const validator = new CacheValidator();

  beforeEach(async () => {
    await ephemeralDB.clearNodeData(nodeId);
  });

  it('preserves timestamp-zero cache data when matching metadata exists', async () => {
    await ephemeralDB.transaction(
      'rw',
      [ephemeralDB.sourceCache, ephemeralDB.sourceCacheMeta],
      async () => {
        await ephemeralDB.sourceCache.put({
          id: 'complete-source-cache',
          nodeId,
          domainType: 'shape',
          sourceKey: 'JP:0',
          data: new ArrayBuffer(8),
          featureCount: 1,
          bbox: [0, 0, 1, 1],
          downloadTime: 1,
          size: 8,
          metadata: { rawSourceCacheKey: 'download:test:jp:0' },
          timestamp: 0,
        });
      }
    );

    await expect(validator.cleanupInvalidEntries(nodeId)).resolves.toEqual({
      geometryDeleted: 0,
      sourceDeleted: 0,
    });
    expect(await ephemeralDB.sourceCache.get('complete-source-cache')).toBeDefined();
  });

  it('deletes timestamp-zero geometry data when metadata is missing', async () => {
    await ephemeralDB.geometryCache.put({
      id: 'incomplete-geometry-cache',
      nodeId,
      domainType: 'shape',
      bandIndex: 0,
      sourceKey: 'JP:0',
      data: new ArrayBuffer(8),
      featureCount: 1,
      vertexCount: 4,
      polygonCount: 1,
      extractionRatio: 1,
      tolerance: 0,
      timestamp: 0,
    });
    await ephemeralDB.geometryCacheMeta.delete('incomplete-geometry-cache');

    await expect(validator.cleanupInvalidEntries(nodeId)).resolves.toEqual({
      geometryDeleted: 1,
      sourceDeleted: 0,
    });
    expect(await ephemeralDB.geometryCache.get('incomplete-geometry-cache')).toBeUndefined();
  });
});
