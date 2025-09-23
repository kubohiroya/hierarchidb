import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';
import type { ResolverPeerData } from '../types/index.js';

export type ResolverPeerRow = {
  nodeId: NodeId;
  data?: ResolverPeerData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
};

export class ResolverEntitiesDB extends Dexie {
  peerEntities!: Table<ResolverPeerRow, NodeId>;

  constructor(name = getDBName('resolver-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}
