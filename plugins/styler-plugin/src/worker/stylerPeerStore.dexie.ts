import type { NodeId } from '@hierarchidb/common-types';
import type { StylerEntitiesDB, StylerPeerRow } from './stylerEntitiesDB.js';
import type { StylerPeerData } from '../types/stylerTypes.js';

interface StylerPeerEntity<TData = StylerPeerData> {
  nodeId: NodeId;
  data: TData;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
}

interface StylerPeerStore<TData = StylerPeerData> {
  get(nodeId: NodeId): Promise<StylerPeerEntity<TData> | undefined>;
  put(entity: StylerPeerEntity<TData>): Promise<void>;
  delete(nodeId: NodeId): Promise<void>;
  bulkUpsert(entities: StylerPeerEntity<TData>[]): Promise<void>;
}

const normalizeStylerPeerData = (data?: StylerPeerData | null): StylerPeerData => ({
  schemaVersion: 1,
  lastAppliedConfig: data?.lastAppliedConfig,
  metadata: data?.metadata ?? {},
});

export function createStylerPeerStoreDexie(db: StylerEntitiesDB): StylerPeerStore<StylerPeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      const entity: StylerPeerEntity<StylerPeerData> = {
        ...row,
        data: normalizeStylerPeerData(row.data),
      };
      return entity;
    },
    async put(e: StylerPeerEntity<StylerPeerData>) {
      const row: StylerPeerRow = {
        ...e,
        data: normalizeStylerPeerData(e.data),
        updatedAt: Date.now(),
      };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: StylerPeerEntity<StylerPeerData>[]) {
      const now = Date.now();
      const rows: StylerPeerRow[] = entities.map((e) => ({
        ...e,
        data: normalizeStylerPeerData(e.data),
        updatedAt: now,
      }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}
