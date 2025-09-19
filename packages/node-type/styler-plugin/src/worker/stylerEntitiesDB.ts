import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';

export type StylerPeerRow = {
  nodeId: NodeId;
  updatedAt?: number;
  displayMode?: 'standard' | 'maximized' | 'fullscreen';
  dialogPosition?: { x: number; y: number };
  dialogSize?: { width: number; height: number };
};

export class StylerEntitiesDB extends Dexie {
  peerEntities!: Table<StylerPeerRow, NodeId>;

  constructor(name = getDBName('styler-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
    this.version(2).upgrade(() => {
      // reserved for future schema migrations
    });
  }
}
