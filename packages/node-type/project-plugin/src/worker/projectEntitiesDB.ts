import Dexie, { type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';

export type ProjectPeerRow = { nodeId: NodeId; data?: unknown; updatedAt?: number; displayMode?: 'standard' | 'maximized' | 'fullscreen' };

export class ProjectEntitiesDB extends Dexie {
  peerEntities!: Table<ProjectPeerRow, NodeId>;

  constructor(name = getDBName('project-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
    });
  }
}

