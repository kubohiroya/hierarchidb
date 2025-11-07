import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-types';
import type { ResolverPeerData } from '../common/types/index.js';

export type ResolverPeerRow = {
  nodeId: NodeId;
  data?: ResolverPeerData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
  dialogState?: MultiStepDialogState | null;
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
