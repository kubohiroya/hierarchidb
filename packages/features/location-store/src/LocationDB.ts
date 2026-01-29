/**
 * LocationDB - storage for Location plugin artifacts
 */

import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeContainerNodeId } from '@hierarchidb/shape-store';
import { Dexie, type Table } from 'dexie';
import type {
  LocationGroupItemData,
  LocationRelationMeta,
} from './index.js';

export type LocationFeature = {
  nodeId: NodeId;
  id: string;
  type?: string;
  mortonKey?: string;
  data?: LocationGroupItemData;
  centroidForShapeId?: number;
  centroidForShapeContainerNodeId?: ShapeContainerNodeId;
  updatedAt?: number;
};

export type LocationRelation = {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: LocationRelationMeta;
  updatedAt?: number;
};

export class LocationDB extends Dexie {
  features!: Table<LocationFeature, [NodeId, string]>;
  relations!: Table<LocationRelation, [NodeId, string, NodeId]>;

  constructor() {
    super(getDBName('location'));

    this.version(9).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&id, nodeId, [z+x+y], timestamp',
      pendingSessions: '&nodeId, storedAt',
    }).upgrade(async (tx) => {
      await tx.table('features').clear();
      await tx.table('vectorTiles').clear();
    });
    this.version(10).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeId, [centroidForShapeId+centroidForShapeContainerNodeId], updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&id, nodeId, [z+x+y], timestamp',
      pendingSessions: '&nodeId, storedAt',
    });
    this.version(11).stores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeId, [centroidForShapeId+centroidForShapeContainerNodeId], updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });

    this.features = this.table('features');
    this.relations = this.table('relations');
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [this.features, this.relations], async () => {
      await this.features.where('nodeId').equals(nodeId).delete();
      await this.relations.where('srcNodeId').equals(nodeId).delete();
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

// Backward-compatible aliases (to be removed after migration window).
export { LocationDB as LocationDatabase };
export const getLocationDatabase = getLocationDB;
export const getEphemeralLocationDB = getLocationDB;
export const closeEphemeralLocationDB = closeLocationDB;
