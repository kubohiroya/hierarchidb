/**
 * LocationDB - storage for persistent Location features.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeature } from '@hierarchidb/location-api';
import { Dexie, type Table } from 'dexie';

export class LocationDB extends Dexie {
  features!: Table<LocationFeature, [NodeId, string]>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      features:
        '&[nodeId+id], nodeId, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeContainerNodeId',
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

const requireLocationDatabaseName = (databaseName: unknown): string => {
  if (typeof databaseName !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(databaseName)) {
    throw new Error('location-database-name-invalid');
  }
  return databaseName;
};

export function initializeLocationDB(databaseName: string): LocationDB {
  const exactDatabaseName = requireLocationDatabaseName(databaseName);
  if (!singleton) singleton = new LocationDB(exactDatabaseName);
  if (singleton.name !== exactDatabaseName) {
    throw new Error('location-database-name-mismatch');
  }
  return singleton;
}

export function getLocationDB(): LocationDB {
  if (!singleton) throw new Error('location-database-not-initialized');
  return singleton;
}

export async function closeLocationDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearLocationDatabases(databaseName: string): Promise<void> {
  await Dexie.delete(requireLocationDatabaseName(databaseName));
}

export async function hasLocationReferencesToShapes(shapeNodeIds: NodeId[]): Promise<boolean> {
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
