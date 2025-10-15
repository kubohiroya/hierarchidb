import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-types';
import type { RoutePeerData } from '../types/index.js';

export type RoutePeerRow = {
  nodeId: NodeId;
  data?: RoutePeerData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
  dialogState?: MultiStepDialogState | null;
};

export class RouteEntitiesDB extends Dexie {
  peerEntities!: Table<RoutePeerRow, NodeId>;

  constructor(name = getDBName('route-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}
