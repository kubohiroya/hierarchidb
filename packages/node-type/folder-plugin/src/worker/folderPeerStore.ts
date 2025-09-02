import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker/entity/store';

// Development-only in-memory PeerStore for the folder plugin.
// Replace with Dexie-backed implementation in production:
//  DB name: `folder-plugin-entities`, table: `peerEntities('&nodeId, updatedAt')`
const mem = new Map<string, PeerEntity<any>>();

export const folderPeerStore: PeerStore<any> = {
  async get(nodeId: NodeId) {
    return mem.get(nodeId as unknown as string);
  },
  async put(entity: PeerEntity<any>) {
    mem.set(entity.nodeId as unknown as string, { ...entity, updatedAt: Date.now() });
  },
  async delete(nodeId: NodeId) {
    mem.delete(nodeId as unknown as string);
  },
  async bulkUpsert(entities: PeerEntity<any>[]) {
    const now = Date.now();
    for (const e of entities) mem.set(e.nodeId as unknown as string, { ...e, updatedAt: now });
  },
};

// Test helper
export function __clearFolderPeerStore() {
  mem.clear();
}
