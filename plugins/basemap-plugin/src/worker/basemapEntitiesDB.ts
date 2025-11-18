import type { NodeId } from '@hierarchidb/common-types';
import { getDBName } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';
import type { DialogProgressState, DialogWindowState } from '@hierarchidb/plugin-service-api';
import type { BasemapPeerData } from '../common/types/BaseMapEntity.js';

// Minimal peer row for runtime-worker standard flow
export type BasemapPeerRow = {
  nodeId: NodeId;
  data?: BasemapPeerData;
  updatedAt?: number;
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
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
