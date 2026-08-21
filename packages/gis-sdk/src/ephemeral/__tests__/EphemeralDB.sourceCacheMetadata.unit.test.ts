import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EphemeralDB } from '../EphemeralDB.js';

describe('EphemeralDB source cache metadata mirror', () => {
  let db: EphemeralDB;

  beforeEach(async () => {
    db = new EphemeralDB('test-source-cache-metadata-mirror');
    await db.open();
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('mirrors every source artifact field except the binary payload', async () => {
    const nodeId = 'route-source-node' as NodeId;
    await db.transaction('rw', [db.sourceCache, db.sourceCacheMeta], async () => {
      await db.sourceCache.put({
        id: 'route-source-artifact',
        nodeId,
        domainType: 'route',
        sourceKey: 'road:from:to',
        data: new Uint8Array([1, 2, 3]).buffer,
        format: 'geojson',
        compression: 'none',
        featureCount: 1,
        inputFeatureCount: 1,
        bbox: [139, 35, 140, 36],
        downloadTime: 12,
        size: 3,
        contentHash: 'sha3-256:artifact',
        vertexCount: 2,
        polygonCount: 0,
        inputVertexCount: 2,
        inputPolygonCount: 0,
        metadata: { inputHash: 'route-input-hash' },
        timestamp: 123,
      });
    });

    await expect(db.sourceCacheMeta.get('route-source-artifact')).resolves.toEqual({
      id: 'route-source-artifact',
      nodeId,
      domainType: 'route',
      sourceKey: 'road:from:to',
      format: 'geojson',
      compression: 'none',
      featureCount: 1,
      inputFeatureCount: 1,
      bbox: [139, 35, 140, 36],
      downloadTime: 12,
      size: 3,
      contentHash: 'sha3-256:artifact',
      vertexCount: 2,
      polygonCount: 0,
      inputVertexCount: 2,
      inputPolygonCount: 0,
      metadata: { inputHash: 'route-input-hash' },
      timestamp: 123,
    });
  });
});
