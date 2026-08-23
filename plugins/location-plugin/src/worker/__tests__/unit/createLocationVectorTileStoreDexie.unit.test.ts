import type { NodeId } from '@hierarchidb/core-types';
import {
  buildLocationVectorTileId,
  LOCATION_VECTOR_TILE_CONTENT_TYPE,
  LocationDB,
  type LocationVectorTileRecord,
} from '@hierarchidb/location-store';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocationVectorTileStoreDexie } from '../../createLocationVectorTileStoreDexie.js';

const nodeId = 'location-node' as NodeId;
const otherNodeId = 'other-location-node' as NodeId;

const bufferFrom = (values: number[]): ArrayBuffer => Uint8Array.from(values).buffer;

const createItem = (
  targetNodeId: NodeId,
  z: number,
  x: number,
  y: number,
  values: number[]
): LocationVectorTileRecord & { id: string } => {
  const data = bufferFrom(values);
  const tileId = buildLocationVectorTileId(targetNodeId, z, x, y);
  return {
    id: tileId,
    tileId,
    nodeId: targetNodeId,
    z,
    x,
    y,
    data,
    size: data.byteLength,
    contentType: LOCATION_VECTOR_TILE_CONTENT_TYPE,
    timestamp: 1,
  };
};

describe('createLocationVectorTileStoreDexie', () => {
  let dbName: string;
  let db: LocationDB | null;

  beforeEach(async () => {
    dbName = `test-location-vector-store-${String(Date.now())}-${String(Math.random()).slice(2)}`;
    db = new LocationDB(dbName);
    await db.open();
  });

  afterEach(async () => {
    vi.useRealTimers();
    db?.close();
    await Dexie.delete(dbName);
  });

  it('bulk upserts, lists, deletes, and assigns timestamps', async () => {
    const store = createLocationVectorTileStoreDexie(db as LocationDB);
    const first = createItem(nodeId, 1, 0, 0, [1, 2]);
    const second = createItem(nodeId, 1, 1, 1, [3, 4, 5]);
    const beforeWrite = Date.now();

    await store.bulkUpsert(nodeId, [first, second]);

    const afterWrite = Date.now();
    const listed = await store.list(nodeId);
    expect(listed.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
    expect(
      listed.every((item) => item.timestamp >= beforeWrite && item.timestamp <= afterWrite)
    ).toBe(true);
    const listedFirst = listed.find((item) => item.id === first.id);
    expect(listedFirst).toBeDefined();
    if (!listedFirst) throw new Error('listed-first-missing');
    expect(Array.from(new Uint8Array(listedFirst.data))).toEqual([1, 2]);

    await store.bulkDelete(nodeId, [first.id]);
    await expect(db?.vectorTiles.get(first.id)).resolves.toBeUndefined();
    await expect(db?.vectorTiles.get(second.id)).resolves.toBeDefined();
  });

  it('rejects items owned by another node instead of rewriting ownership', async () => {
    const store = createLocationVectorTileStoreDexie(db as LocationDB);

    await expect(
      store.bulkUpsert(nodeId, [createItem(otherNodeId, 1, 0, 0, [1])])
    ).rejects.toThrow('location-vector-tile-node-id-mismatch');

    await expect(db?.vectorTiles.count()).resolves.toBe(0);
  });
});
