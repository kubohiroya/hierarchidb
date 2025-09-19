import Dexie, { type DexieConstructor, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';
import type { FolderPeerData } from '../shared/types.js';

export type FolderGroupRow = {
  nodeId: NodeId;
  id: string; // stable item id
  data?: unknown;
  updatedAt?: number;
};

export type FolderRelationRow = {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: unknown;
  updatedAt?: number;
};

export type FolderPeerRow = {
  nodeId: NodeId;
  data?: FolderPeerData;
  updatedAt?: number;
  displayMode?: 'standard' | 'maximized' | 'fullscreen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
};

const DexieBase = Dexie as unknown as DexieConstructor;

export class FolderEntitiesDB extends DexieBase {
  peerEntities!: Table<FolderPeerRow, NodeId>;
  groupEntities!: Table<FolderGroupRow, [NodeId, string]>;
  relations!: Table<FolderRelationRow, [NodeId, string, NodeId]>;

  constructor(name = getDBName('folder-entities-db')) {
    super(name);
    this.version(1).stores({
      peerEntities: '&nodeId, updatedAt',
      // composite unique keys
      groupEntities: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
    });
  }
}
