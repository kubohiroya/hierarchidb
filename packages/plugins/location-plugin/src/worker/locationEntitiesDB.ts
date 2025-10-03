import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-type';
import type { LocationGroupItemData, LocationPeerData, LocationRelationMeta } from '../types/entities.js';

export type LocationPeerRow = {
  nodeId: NodeId;
  data?: LocationPeerData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number };
  dialogSize?: { width: number; height: number };
  dialogState?: MultiStepDialogState | null;
};
export type LocationGroupRow = { nodeId: NodeId; id: string; data?: LocationGroupItemData; updatedAt?: number };
export type LocationRelationRow = {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: LocationRelationMeta;
  updatedAt?: number
};

export class LocationEntitiesDB extends Dexie {
  peerEntities!: Table<LocationPeerRow, NodeId>;
  groupEntities!: Table<LocationGroupRow, [NodeId, string]>;
  relations!: Table<LocationRelationRow, [NodeId, string, NodeId]>;

  constructor(name = getDBName('location-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
      groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
    this.version(2).upgrade(() => {
      // Reserved for future schema migrations; implement transforms here.
    });
  }
}
