/**
 * LocationDB - storage for persistent Location features.
 */

import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import { Dexie, type Table } from 'dexie';
import type { LocationFeature } from '@hierarchidb/location-api';


export class LocationDB extends Dexie {
  features!: Table<LocationFeature, [NodeId, string]>;

  constructor() {
    super(getDBName('location'));
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

export function getLocationDB(): LocationDB {
  if (!singleton) singleton = new LocationDB();
  return singleton;
}

export async function closeLocationDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearLocationDatabases(): Promise<void> {
  await Dexie.delete(getDBName('location'));
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
