import Dexie, { type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';

export type RoutePeerRow = { nodeId: NodeId; data?: unknown; updatedAt?: number; displayMode?: 'standard' | 'maximized' | 'fullscreen' };

export class RouteEntitiesDB extends Dexie {
  peerEntities!: Table<RoutePeerRow, NodeId>;

  constructor(name = getDBName('route-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}

