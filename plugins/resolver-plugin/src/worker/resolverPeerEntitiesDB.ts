import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { DialogProgressState, DialogWindowState } from '@hierarchidb/plugin-service-api';
import type { ResolverPeerData } from '../common/types/index.js';

export type ResolverPeerRow = {
  nodeId: NodeId;
  data?: ResolverPeerData;
  updatedAt?: number;
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
};

export class ResolverPeerEntitiesDB extends Dexie {
  peerEntities!: Table<ResolverPeerRow, NodeId>;

  constructor(name = getDBName('resolver-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}
