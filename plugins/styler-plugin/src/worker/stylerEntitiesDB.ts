import type { NodeId } from '@hierarchidb/common-types';
import type { DialogProgressState, DialogWindowState } from '@hierarchidb/plugin-service-api';
import { getDBName } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';
import type { StylerPeerData } from '../common/types/stylerTypes.js';

export type StylerPeerRow = {
  nodeId: NodeId;
  data?: StylerPeerData;
  updatedAt?: number;
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
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
