import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import type { FolderEntitiesDB, FolderPeerRow } from './folderEntitiesDB.ts';
import { normalizeFolderPeerData } from './folderPeerStore.ts';
import { FolderPeerData } from '../common/types/types.ts';

export function createFolderPeerStoreDexie(db: FolderEntitiesDB): PeerStore<FolderPeerData> {
  return {
    async get(nodeId: NodeId) {
      const row = await db.peerEntities.get(nodeId);
      if (!row) return undefined;
      const { data, ...rest } = row;
      const entity: PeerEntity<FolderPeerData> = {
        ...rest,
        data: normalizeFolderPeerData(data),
      };
      return entity;
    },
    async put(entity: PeerEntity<FolderPeerData>) {
      const row: FolderPeerRow = {
        ...entity,
        data: normalizeFolderPeerData(entity.data),
        updatedAt: Date.now(),
      };
      await db.peerEntities.put(row);
    },
    async delete(nodeId: NodeId) {
      await db.peerEntities.delete(nodeId);
    },
    async bulkUpsert(entities: PeerEntity<FolderPeerData>[]) {
      const now = Date.now();
      const rows: FolderPeerRow[] = entities.map((entity) => ({
        ...entity,
        data: normalizeFolderPeerData(entity.data),
        updatedAt: now,
      }));
      await db.peerEntities.bulkPut(rows);
    },
  };
}
