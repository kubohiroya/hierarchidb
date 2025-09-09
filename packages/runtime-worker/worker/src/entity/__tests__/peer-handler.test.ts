import { describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { PeerEntityHandler } from '../handlers/PeerEntityHandler';
import type { PeerStore } from '../store';

function makePeerStoreStub(): PeerStore<any> & { _map: Map<string, any> } {
  const map = new Map<string, any>();
  return {
    async get(id: NodeId) {
      return map.get(id as unknown as string);
    },
    async put(e: any) {
      map.set(e.nodeId as unknown as string, e);
    },
    async delete(id: NodeId) {
      map.delete(id as unknown as string);
    },
    _map: map,
  } as any;
}

describe('PeerEntityHandler', () => {
  it('copies peer entity to wc and upserts to target, then deletes wc', async () => {
    const store = makePeerStoreStub();
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
