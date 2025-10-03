import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-type';
import type { BasemapPeerData } from '../types/BaseMapEntity.js';

// Minimal peer row for runtime-worker standard flow
export type BasemapPeerRow = {
  nodeId: NodeId;
  data?: BasemapPeerData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
  dialogState?: MultiStepDialogState | null;
};

export class BasemapEntitiesDB extends Dexie {
  peerEntities!: Table<BasemapPeerRow, NodeId>;

  constructor(name = getDBName('basemap-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
    this.version(2).upgrade(() => {
      // reserved for future schema migrations
    });
  }
}
