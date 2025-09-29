import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';

export interface TimelinePeerRow {
  nodeId: NodeId;
  flamePerSecond: number;
  restartIntervalInMsec: number;
  updatedAt?: number;
}

export class TimelineEntitiesDB extends Dexie {
  peerEntities!: Table<TimelinePeerRow, NodeId>;

  constructor(name = getDBName('timeline-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}

