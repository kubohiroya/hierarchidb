import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import {
  buildLocationVectorTileId,
  clearLocationDatabases,
  closeLocationDB,
  initializeLocationDB,
  LOCATION_VECTOR_TILE_CONTENT_TYPE,
} from '@hierarchidb/location-store';
import { getVTStoreRegistry, resetWorkerContainerForTesting } from '@hierarchidb/runtime-worker';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerLocationWorkerStores } from '../../factory/registerLocationWorkerStores.js';

const nodeId = 'location-node' as NodeId;

describe('registerLocationWorkerStores', () => {
  let dbName: string;

  beforeEach(() => {
    dbName = `test-location-vt-registry-${String(Date.now())}-${String(Math.random()).slice(2)}`;
    initializeLocationDB(dbName);
  });

  afterEach(async () => {
    getVTStoreRegistry().clearForTesting();
    resetWorkerContainerForTesting();
    await closeLocationDB();
    await clearLocationDatabases(dbName);
  });

  it('registers the location vector tile store in VTStoreRegistry', async () => {
    await registerLocationWorkerStores();

    const store = getVTStoreRegistry().requireVectorTiles('location');
    const data = Uint8Array.from([1, 2, 3]).buffer;
    const tileId = buildLocationVectorTileId(nodeId, 1, 0, 0);
    await store.bulkUpsert(nodeId, [
      {
        id: tileId,
        tileId,
        nodeId,
        z: 1,
        x: 0,
        y: 0,
        data,
        size: data.byteLength,
        contentType: LOCATION_VECTOR_TILE_CONTENT_TYPE,
        timestamp: 0,
      },
    ]);

    const rows = await store.list(nodeId);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(tileId);
    expect(Array.from(new Uint8Array(rows[0]?.data ?? new ArrayBuffer(0)))).toEqual([1, 2, 3]);
  });
});
