import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { LocationGroupItemData, LocationRelationMeta } from '../common/types/entities.js';

export type LocationGroupRow = { nodeId: NodeId; id: string; data?: LocationGroupItemData; updatedAt?: number };
export type LocationRelationRow = {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: LocationRelationMeta;
  updatedAt?: number
};

export class LocationEntitiesDB extends Dexie {
  groupEntities!: Table<LocationGroupRow, [NodeId, string]>;
  relations!: Table<LocationRelationRow, [NodeId, string, NodeId]>;

  constructor(name = getDBName('location')) {
    super(name);
    this.version(1).stores({
      groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
    this.version(2).upgrade(() => {
      // Reserved for future schema migrations; implement transforms here.
    });
  }
}
