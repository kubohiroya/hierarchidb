import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker-worker/entity/store';

// Dev-only in-memory PeerStore for the folder plugin.
// Replace with a Dexie-backed implementation in production:
//  - DB name: `folder-plugin-entities`
//  - Table: peerEntities `&nodeId, updatedAt`
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
  // Optional optimization hook for handlers that probe bulkUpsert
  // bulkUpsert?: async (entities: PeerEntity<any>[]) => void,
};

export function __clearFolderPeerStore() {
  mem.clear();
}

