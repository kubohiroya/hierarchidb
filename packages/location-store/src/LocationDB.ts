/**
 * LocationDB - storage for persistent Location features.
 */

import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import { Dexie, type Table } from 'dexie';
import type { LocationFeature } from '@hierarchidb/location-api';


export class LocationDB extends Dexie {
  features!: Table<LocationFeature, [NodeId, string]>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      features: '&[nodeId+id], nodeId, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeContainerNodeId',
    });

    this.features = this.table('features');
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [this.features], async () => {
      await this.features.where('nodeId').equals(nodeId).delete();
    });
  }
}

let singleton: LocationDB | null = null;

export function getLocationDB(databaseName?: string): LocationDB {
  const exactDatabaseName =
    databaseName ?? getDBName(getBuildDatabasePrefix(), 'location');
  if (!singleton) singleton = new LocationDB(exactDatabaseName);
  if (singleton.name !== exactDatabaseName) {
    throw new Error('location-database-name-mismatch');
  }
  return singleton;
}

export async function closeLocationDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearLocationDatabases(): Promise<void> {
  await Dexie.delete(getDBName(getBuildDatabasePrefix(), 'location'));
}

export async function hasLocationReferencesToShapes(
  shapeNodeIds: NodeId[]
): Promise<boolean> {
  if (!shapeNodeIds.length) return false;
  const db = getLocationDB();
  await db.open?.();
  const matches = await db.features
    .where('centroidForShapeContainerNodeId')
    .anyOf(shapeNodeIds)
    .limit(1)
    .toArray();
  return matches.length > 0;
}

// No ephemeral database is currently implemented for Location.
