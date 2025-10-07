import type { NodeId } from '@hierarchidb/common-types';
import type { PeerEntity, PeerStore } from '../store.js';

// Lightweight handler that expects coreDB.peerEntities having Dexie-like API
// with get/put/delete methods. In tests, provide a stub with the same surface.
export class PeerEntityHandler {
  constructor(private store: PeerStore<any>) {
  }

  async copyPeer(originalId: NodeId, wcId: NodeId): Promise<void> {
    const src: PeerEntity | undefined = await this.store.get(originalId);
    const copy: PeerEntity = { nodeId: wcId, data: src?.data, displayMode: src?.displayMode, updatedAt: Date.now() };
    await this.store.put(copy);
  }

  async upsertPeer(targetId: NodeId, fromWcId: NodeId): Promise<void> {
    const src: PeerEntity | undefined = await this.store.get(fromWcId);
    const next: PeerEntity = { nodeId: targetId, data: src?.data, displayMode: src?.displayMode, updatedAt: Date.now() };
    await this.store.put(next);
  }

  async deletePeer(nodeId: NodeId): Promise<void> {
    await this.store.delete(nodeId);
  }

  async bulkUpsertFromIds(pairs: Array<{ targetId: NodeId; fromId: NodeId }>): Promise<void> {
    // If store supports bulkUpsert, collect and forward; otherwise fall back to per-item upsert
    if (this.store.bulkUpsert) {
      const entities: PeerEntity[] = [];
      for (const { targetId, fromId } of pairs) {
        const src: PeerEntity | undefined = await this.store.get(fromId);
        entities.push({ nodeId: targetId, data: src?.data, displayMode: src?.displayMode, updatedAt: Date.now() });
      }
      await this.store.bulkUpsert(entities);
      return;
    }
    for (const p of pairs) await this.upsertPeer(p.targetId, p.fromId);
  }
}
