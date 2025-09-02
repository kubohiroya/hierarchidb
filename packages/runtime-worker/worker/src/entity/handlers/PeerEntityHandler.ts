import type { NodeId } from '@hierarchidb/common-type';
import type { PeerEntity } from '../types';

// Lightweight handler that expects coreDB.peerEntities having Dexie-like API
// with get/put/delete methods. In tests, provide a stub with the same surface.
export class PeerEntityHandler {
  constructor(private coreDB: any) {}

  async copyPeer(originalId: NodeId, wcId: NodeId): Promise<void> {
    const src: PeerEntity | undefined = await this.coreDB.peerEntities?.get?.(originalId);
    const copy: PeerEntity = { nodeId: wcId, data: src?.data, updatedAt: Date.now() };
    await this.coreDB.peerEntities?.put?.(copy);
  }

  async upsertPeer(targetId: NodeId, fromWcId: NodeId): Promise<void> {
    const src: PeerEntity | undefined = await this.coreDB.peerEntities?.get?.(fromWcId);
    const next: PeerEntity = { nodeId: targetId, data: src?.data, updatedAt: Date.now() };
    await this.coreDB.peerEntities?.put?.(next);
  }

  async deletePeer(nodeId: NodeId): Promise<void> {
    await this.coreDB.peerEntities?.delete?.(nodeId);
  }
}

