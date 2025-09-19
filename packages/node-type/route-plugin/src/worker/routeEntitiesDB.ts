import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';
import type { RoutePeerData } from '../types/index.js';

export type RoutePeerRow = {
  nodeId: NodeId;
  data?: RoutePeerData;
  updatedAt?: number;
  displayMode?: 'standard' | 'maximized' | 'fullscreen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
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
