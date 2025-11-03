import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-types';
import { getDBName } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';
import type { StylerPeerData } from '../common/types/stylerTypes.js';

export type StylerPeerRow = {
  nodeId: NodeId;
  data?: StylerPeerData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
  dialogState?: MultiStepDialogState | null;
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
