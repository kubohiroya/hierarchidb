import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeature, LocationFeatureId, LocationPointId } from '@hierarchidb/location-api';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocationDB } from '../LocationDB.js';
import {
  buildLocationVectorTileId,
  LOCATION_VECTOR_TILE_CONTENT_TYPE,
  type LocationVectorTileRecord,
} from '../LocationVectorTileRecord.js';

const nodeId = 'location-node' as NodeId;
const otherNodeId = 'location-other-node' as NodeId;

const createFeature = (): LocationFeature => ({
  nodeId,
  id: 'feature-a' as LocationFeatureId,
  type: 'airport',
  data: {
    schemaVersion: 2,
    pointId: 'point-a' as LocationPointId,
    name: 'Airport A',
    latitude: 35,
    longitude: 139,
    type: 'airport',
    renderRank: 1,
    importance: 0.9,
    iconKey: 'flight_takeoff',
    labelClass: 'major',
    minZoom: 3,
  },
  mortonKey: '0123456789abcdef',
  updatedAt: 1,
});

const bufferFrom = (values: number[]): ArrayBuffer => Uint8Array.from(values).buffer;

const createTile = (
  targetNodeId: NodeId,
  values: number[],
  overrides: Partial<LocationVectorTileRecord> = {}
): LocationVectorTileRecord => {
  const data = bufferFrom(values);
  const z = 2;
  const x = 1;
  const y = 3;
  return {
    tileId: buildLocationVectorTileId(targetNodeId, z, x, y),
    nodeId: targetNodeId,
    z,
    x,
    y,
    data,
    size: data.byteLength,
    contentType: LOCATION_VECTOR_TILE_CONTENT_TYPE,
    timestamp: 10,
    ...overrides,
  };
};

describe('LocationDB vector tile storage', () => {
  let dbName: string;
  let db: LocationDB | null;

  beforeEach(() => {
    dbName = `test-location-vector-tiles-${String(Date.now())}-${String(Math.random()).slice(2)}`;
    db = null;
  });

  afterEach(async () => {
    db?.close();
    await Dexie.delete(dbName);
  });

  it('opens a v1 feature database as v2 without rewriting points and stores vector tiles', async () => {
    const dbV1 = new Dexie(dbName);
    dbV1.version(1).stores({
      features:
        '&[nodeId+id], nodeId, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeContainerNodeId',
    });
    await dbV1.open();
    await dbV1.table('features').put(createFeature());
    dbV1.close();

    db = new LocationDB(dbName);
    await db.open();

    await expect(db.features.get([nodeId, 'feature-a'])).resolves.toMatchObject({
      nodeId,
      id: 'feature-a',
      type: 'airport',
    });

    const tile = createTile(nodeId, [1, 2, 3, 4]);
    await db.storeVectorTile(tile);
    const stored = await db.getVectorTile(nodeId, 2, 1, 3);

    expect(stored?.tileId).toBe(tile.tileId);
    expect(stored?.contentType).toBe(LOCATION_VECTOR_TILE_CONTENT_TYPE);
    expect(stored?.size).toBe(4);
    expect(Array.from(new Uint8Array(stored?.data ?? new ArrayBuffer(0)))).toEqual([1, 2, 3, 4]);
  });

  it('keeps node lookups isolated and clears vector tiles without deleting features', async () => {
    db = new LocationDB(dbName);
    await db.open();
    await db.features.put(createFeature());
    await db.storeVectorTile(createTile(nodeId, [1, 2]));
    await db.storeVectorTile(createTile(otherNodeId, [9, 8]));

    await expect(db.getVectorTile(nodeId, 2, 1, 3)).resolves.toMatchObject({ nodeId });
    await expect(db.getVectorTile(otherNodeId, 2, 1, 3)).resolves.toMatchObject({
      nodeId: otherNodeId,
    });

    await db.clearNodeVectorTiles(nodeId);

    await expect(db.getVectorTile(nodeId, 2, 1, 3)).resolves.toBeUndefined();
    await expect(db.getVectorTile(otherNodeId, 2, 1, 3)).resolves.toMatchObject({
      nodeId: otherNodeId,
    });
    await expect(db.features.get([nodeId, 'feature-a'])).resolves.toBeDefined();
  });

  it('rejects corrupt vector tile records and rolls back failed transactions', async () => {
    db = new LocationDB(dbName);
    await db.open();
    const valid = createTile(nodeId, [1, 2, 3]);
    const corrupt = createTile(nodeId, [4, 5], { size: 99 });

    await expect(
      db.transaction('rw', db.vectorTiles, async () => {
        await db.storeVectorTile(valid);
        await db.storeVectorTile(corrupt);
      })
    ).rejects.toThrow('location-vector-tile-size-mismatch');

    await expect(db.vectorTiles.where('nodeId').equals(nodeId).count()).resolves.toBe(0);

    await db.vectorTiles.put(corrupt);
    await expect(db.getVectorTile(nodeId, 2, 1, 3)).rejects.toThrow(
      'location-vector-tile-size-mismatch'
    );
  });
});
