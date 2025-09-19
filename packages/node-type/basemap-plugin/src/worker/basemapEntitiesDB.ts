import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';

// Minimal peer row for runtime-worker standard flow
export type BasemapPeerRow = {
  nodeId: NodeId;
  data?: any;
  updatedAt?: number;
  displayMode?: 'standard' | 'maximized' | 'fullscreen';
  dialogPosition?: { x: number; y: number };
  dialogSize?: { width: number; height: number };
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
