/**
 * @file RouteDB.ts
 * @description Database schema and operations for Route plugin
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';

import type { RouteFeature } from '@hierarchidb/route-api';

export type RouteVectorTileRecord = {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  contentType: 'application/vnd.mapbox-vector-tile';
  timestamp: number;
};

export type RouteTileIndexRecord = {
  id: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  lineIds: string[];
  updatedAt: number;
};

export class RouteDB extends VectorTileDbBase {
  features!: Table<RouteFeature, RouteFeature['id']>;
  vectorTiles!: Table<RouteVectorTileRecord, string>;
  tileIndex!: Table<RouteTileIndexRecord, string>;

  constructor(dbName: string = getDBName('route')) {
    super(dbName);
    this.version(4).stores(this.mergeVectorTileStores({
      features:
        '&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], z, timestamp',
      tileIndex: '&id, nodeId, [nodeId+z+x+y], z, x, y, updatedAt',
    }));
    this.version(5).stores(this.mergeVectorTileStores({
      features: '&id, nodeId, startLocationId, endLocationId',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileIndex: '&id, nodeId, [nodeId+z+x+y]',
    }));

    this.features = this.table('features');
    this.vectorTiles = this.table('vectorTiles');
    this.tileIndex = this.table('tileIndex');
    this.initVectorTileTables();
  }

}

let singleton: RouteDB | null = null;

export function getRouteDB(): RouteDB {
  if (!singleton) singleton = new RouteDB();
  return singleton;
}

export async function closeRouteDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearRouteDatabases(): Promise<void> {
  await Dexie.delete(getDBName('route'));
}

export async function hasRouteReferencesToLocations(
  locationNodeIds: NodeId[]
): Promise<boolean> {
  if (!locationNodeIds.length) return false;
  const db = getRouteDB();
  await db.open?.();
  const startMatch = await db.features
    .where('startLocationId')
    .anyOf(locationNodeIds)
    .limit(1)
    .toArray();
  if (startMatch.length > 0) return true;
  const endMatch = await db.features
    .where('endLocationId')
    .anyOf(locationNodeIds)
    .limit(1)
    .toArray();
  return endMatch.length > 0;
}

export async function countRouteReferencesToLocations(
  locationNodeIds: NodeId[]
): Promise<number> {
  if (!locationNodeIds.length) return 0;
  const db = getRouteDB();
  await db.open?.();
  const startIds = await db.features
    .where('startLocationId')
    .anyOf(locationNodeIds)
    .primaryKeys();
  const endIds = await db.features
    .where('endLocationId')
    .anyOf(locationNodeIds)
    .primaryKeys();
  const unique = new Set([...startIds, ...endIds]);
  return unique.size;
}
