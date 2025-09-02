import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity, PeerStore } from '@hierarchidb/runtime-worker/entity/store';
import type { FolderPeerData } from '../types/entities';

// Development-only in-memory PeerStore for the folder plugin.
// Replace with Dexie-backed implementation in production:
//  DB name: `folder-plugin-entities`, table: `peerEntities('&nodeId, updatedAt')`
const mem = new Map<string, PeerEntity<FolderPeerData>>();

export const folderPeerStore: PeerStore<FolderPeerData> = {
  async get(nodeId: NodeId) {
    return mem.get(nodeId as unknown as string);
  },
  async put(entity: PeerEntity<FolderPeerData>) {
    const data = normalizeV1(entity.data);
    mem.set(entity.nodeId as unknown as string, { ...entity, data, updatedAt: Date.now() });
  },
  async delete(nodeId: NodeId) {
    mem.delete(nodeId as unknown as string);
  },
  async bulkUpsert(entities: PeerEntity<FolderPeerData>[]) {
    const now = Date.now();
    for (const e of entities) {
      const data = normalizeV1(e.data);
      mem.set(e.nodeId as unknown as string, { ...e, data, updatedAt: now });
    }
  },
};

// Test helper
export function __clearFolderPeerStore() {
  mem.clear();
}

function normalizeV1(data?: FolderPeerData): FolderPeerData {
  if (!data) return { schemaVersion: 1, domain: {} } as FolderPeerData;
  if ((data as any).schemaVersion === 1) return data;
  if ((data as any).schemaVersion === undefined) {
    return { ...data, schemaVersion: 1 } as FolderPeerData;
  }
  throw new Error(`Unsupported FolderPeerData schemaVersion: ${(data as any).schemaVersion}`);
}
