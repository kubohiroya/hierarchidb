import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker';
import { FolderPeerData } from '../common/types/types.ts';

// Development-only in-memory PeerStore for the folder plugin.
// Replace with Dexie-backed implementation in production:
//  DB name: `folder-plugin-entities`, table: `peerEntities('&nodeId, updatedAt')`
const mem = new Map<string, PeerEntity<FolderPeerData>>();

export const folderPeerStore: PeerStore<FolderPeerData> = {
  async get(nodeId: NodeId) {
    return mem.get(nodeId as string);
  },
  async put(entity: PeerEntity<FolderPeerData>) {
    const data = normalizeFolderPeerData(entity.data);
    mem.set(entity.nodeId as string, { ...entity, data, updatedAt: Date.now() });
  },
  async delete(nodeId: NodeId) {
    mem.delete(nodeId as string);
  },
  async bulkUpsert(entities: PeerEntity<FolderPeerData>[]) {
    const now = Date.now();
    for (const e of entities) {
      const data = normalizeFolderPeerData(e.data);
      mem.set(e.nodeId as string, { ...e, data, updatedAt: now });
    }
  },
};

// Test helper
export function __clearFolderPeerStore() {
  mem.clear();
}

export function normalizeFolderPeerData(data?: FolderPeerData | null): FolderPeerData {
  return {
    schemaVersion: 1,
    domain: data?.domain ?? {},
  };
}
