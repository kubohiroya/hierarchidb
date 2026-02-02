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

    // Legacy schemas retained for migration compatibility only.
    this.version(9).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], updatedAt',
      vectorTiles: '&id, nodeId, [z+x+y], timestamp',
      pendingSessions: '&nodeId, storedAt',
    }).upgrade(async (tx) => {
      await tx.table('features').clear();
      await tx.table('vectorTiles').clear();
    });
    this.version(10).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeId, [centroidForShapeId+centroidForShapeContainerNodeId], updatedAt',
      vectorTiles: '&id, nodeId, [z+x+y], timestamp',
      pendingSessions: '&nodeId, storedAt',
    });
    this.version(11).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeId, [centroidForShapeId+centroidForShapeContainerNodeId], updatedAt',
    });
    this.version(12).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeId, [centroidForShapeId+centroidForShapeContainerNodeId], updatedAt',
    });
    this.version(13).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeId, centroidForShapeContainerNodeId, [centroidForShapeId+centroidForShapeContainerNodeId], updatedAt',
    });
    this.version(14).stores({
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
