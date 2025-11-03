import type { NodeId } from '@hierarchidb/common-types';
import { describe, expect, it } from 'vitest';
import { PeerEntityHandler } from '../handlers/PeerEntityHandler.js';
import type { PeerEntity, PeerStore } from '../store.js';

function makePeerStoreStub<TData>(): PeerStore<TData> & { map: Map<NodeId, PeerEntity<TData>> } {
  const map = new Map<NodeId, PeerEntity<TData>>();
  return {
    async get(id: NodeId) {
      return map.get(id);
    },
    async put(entity: PeerEntity<TData>) {
      map.set(entity.nodeId, { ...entity });
    },
    async delete(id: NodeId) {
      map.delete(id);
    },
    map,
  };
}

describe('PeerEntityHandler', () => {
  it('copies peer entity to wc and upserts to target, then deletes wc', async () => {
    const store = makePeerStoreStub<{ foo: number }>();
    const handler = new PeerEntityHandler(store);
    const originalId = 'n1' as NodeId;
    const wcId = 'wc1' as NodeId;
    const targetId = 't1' as NodeId;

    // Seed original entity
    await store.put({ nodeId: originalId, data: { foo: 1 } });

    // Copy to WC
    await handler.copyPeer(originalId, wcId);
    expect((await store.get(wcId))?.data?.foo).toBe(1);

    // Commit WC to target
    await handler.upsertPeer(targetId, wcId);
    expect((await store.get(targetId))?.data?.foo).toBe(1);

    // Discard WC entity
    await handler.deletePeer(wcId);
    expect(await store.get(wcId)).toBeUndefined();
  });
});
