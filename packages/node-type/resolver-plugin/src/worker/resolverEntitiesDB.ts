import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';

export type ResolverPeerRow = { nodeId: NodeId; data?: unknown; updatedAt?: number; displayMode?: 'standard' | 'maximized' | 'fullscreen' };

export class ResolverEntitiesDB extends Dexie {
  peerEntities!: Table<ResolverPeerRow, NodeId>;

  constructor(name = getDBName('resolver-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}
