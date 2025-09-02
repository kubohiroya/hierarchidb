import { describe, it, expect } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { PeerEntityHandler } from '~/entity/handlers/PeerEntityHandler';

function makeCoreStub() {
  const map = new Map<string, any>();
  return {
    peerEntities: {
      async get(id: NodeId) { return map.get(id as unknown as string); },
      async put(e: any) { map.set(e.nodeId as unknown as string, e); },
      async delete(id: NodeId) { map.delete(id as unknown as string); },
    },
    _map: map,
  } as any;
}

describe('PeerEntityHandler', () => {
  it('copies peer entity to wc and upserts to target, then deletes wc', async () => {
    const core = makeCoreStub();
    const handler = new PeerEntityHandler(core);
    const originalId = 'n1' as NodeId;
    const wcId = 'wc1' as NodeId;
    const targetId = 't1' as NodeId;

    // Seed original entity
    await core.peerEntities.put({ nodeId: originalId, data: { foo: 1 } });

    // Copy to WC
    await handler.copyPeer(originalId, wcId);
    expect((await core.peerEntities.get(wcId))?.data?.foo).toBe(1);

    // Commit WC to target
    await handler.upsertPeer(targetId, wcId);
    expect((await core.peerEntities.get(targetId))?.data?.foo).toBe(1);

    // Discard WC entity
    await handler.deletePeer(wcId);
    expect(await core.peerEntities.get(wcId)).toBeUndefined();
  });
});

