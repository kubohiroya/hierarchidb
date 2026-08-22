/**
 * @file RouteDB.ts
 * @description Database schema and operations for Route plugin
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { RouteFeature } from '@hierarchidb/route-api';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';
import { Dexie, type Table } from 'dexie';

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

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores(
      this.mergeVectorTileStores({
        features: '&id, nodeId, startLocationId, endLocationId',
        vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
        tileIndex: '&id, nodeId, [nodeId+z+x+y]',
      })
    );

    this.features = this.table('features');
    this.vectorTiles = this.table('vectorTiles');
    this.tileIndex = this.table('tileIndex');
    this.initVectorTileTables();
  }
}

let singleton: RouteDB | null = null;

const requireRouteDatabaseName = (databaseName: unknown): string => {
  if (typeof databaseName !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(databaseName)) {
    throw new Error('route-database-name-invalid');
  }
  return databaseName;
};

export function initializeRouteDB(databaseName: string): RouteDB {
  const exactDatabaseName = requireRouteDatabaseName(databaseName);
  if (!singleton) singleton = new RouteDB(exactDatabaseName);
  if (singleton.name !== exactDatabaseName) {
    throw new Error('route-database-name-mismatch');
  }
  return singleton;
}

export function getRouteDB(): RouteDB {
  if (!singleton) throw new Error('route-database-not-initialized');
  return singleton;
}

export async function closeRouteDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearRouteDatabases(databaseName: string): Promise<void> {
  await Dexie.delete(requireRouteDatabaseName(databaseName));
}

export async function hasRouteReferencesToLocations(locationNodeIds: NodeId[]): Promise<boolean> {
  if (!locationNodeIds.length) return false;
  const db = getRouteDB();
  await db.open?.();
  const locationIdSet = new Set(locationNodeIds.map((id) => String(id)));
  const hasStartReference = await db.features
    .where('startLocationId')
    .anyOf(locationNodeIds)
    .limit(1)
    .count();
  if (hasStartReference > 0) return true;
  const hasEndReference = await db.features
    .where('endLocationId')
    .anyOf(locationNodeIds)
    .limit(1)
    .count();
  if (hasEndReference > 0) return true;

  const legacyRows = await db.features.toArray();
  return legacyRows.some((row) => {
    const startLocationId = row.startPoint?.locationId;
    const endLocationId = row.endPoint?.locationId;
    return (
      (startLocationId !== undefined && locationIdSet.has(String(startLocationId))) ||
      (endLocationId !== undefined && locationIdSet.has(String(endLocationId)))
    );
  });
}

export async function countRouteReferencesToLocations(locationNodeIds: NodeId[]): Promise<number> {
  if (!locationNodeIds.length) return 0;
  const db = getRouteDB();
  await db.open?.();
  const locationIdSet = new Set(locationNodeIds.map((id) => String(id)));
  const startIds = await db.features.where('startLocationId').anyOf(locationNodeIds).primaryKeys();
  const endIds = await db.features.where('endLocationId').anyOf(locationNodeIds).primaryKeys();
  const uniqueIds = new Set<string>([...startIds.map(String), ...endIds.map(String)]);

  const legacyRows = await db.features.toArray();
  for (const row of legacyRows) {
    const startLocationId = row.startPoint?.locationId;
    const endLocationId = row.endPoint?.locationId;
    if (
      (startLocationId !== undefined && locationIdSet.has(String(startLocationId))) ||
      (endLocationId !== undefined && locationIdSet.has(String(endLocationId)))
    ) {
      uniqueIds.add(String(row.id));
    }
  }
  return uniqueIds.size;
}
